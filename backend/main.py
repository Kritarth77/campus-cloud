from typing import Optional

from fastapi import BackgroundTasks, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import Integer, String, create_engine, select
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column

try:
    from . import deployer
except ImportError:
    import deployer


DATABASE_URL = "sqlite:///./campuscloud.db"


class Base(DeclarativeBase):
    pass


class Deployment(Base):
    __tablename__ = "deployments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    repo_url: Mapped[str] = mapped_column(String, nullable=False)
    container_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    port: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False)
    error_message: Mapped[Optional[str]] = mapped_column(String, nullable=True)


engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
)
Base.metadata.create_all(bind=engine)


app = FastAPI(title="Campus Cloud")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


class DeploymentCreate(BaseModel):
    name: str
    repo_url: str


class DeploymentResponse(BaseModel):
    id: int
    name: str
    repo_url: str
    container_id: Optional[str] = None
    port: int
    status: str
    error_message: Optional[str] = None

    model_config = {"from_attributes": True}


def find_next_available_port(db: Session) -> int:
    used_ports = set(db.scalars(select(Deployment.port)).all())
    port = 8001
    while port in used_ports:
        port += 1
    return port


def run_deployment(deployment_id: int, name: str, repo_url: str, port: int) -> None:
    try:
        container_id, error_message = deployer.deploy_repo(repo_url, name, port)
        with Session(engine) as db:
            deployment = db.get(Deployment, deployment_id)
            if deployment is None:
                return
            if error_message:
                deployment.status = "failed"
                deployment.error_message = error_message
                deployment.container_id = None
            else:
                deployment.status = "running"
                deployment.container_id = container_id
                deployment.error_message = None
            db.commit()
    except Exception as exc:
        with Session(engine) as db:
            deployment = db.get(Deployment, deployment_id)
            if deployment is not None:
                deployment.status = "failed"
                deployment.error_message = str(exc)
                deployment.container_id = None
                db.commit()


@app.get("/deployments", response_model=list[DeploymentResponse])
def list_deployments() -> list[Deployment]:
    with Session(engine) as db:
        deployments = db.scalars(
            select(Deployment).order_by(Deployment.id.desc())
        ).all()
        db.expunge_all()
        return list(deployments)


@app.post(
    "/deployments",
    status_code=202,
    response_model=DeploymentResponse,
)
def create_deployment(
    payload: DeploymentCreate,
    background_tasks: BackgroundTasks,
) -> Deployment:
    if not payload.name.strip():
        raise HTTPException(status_code=422, detail="Name must not be empty")
    if not payload.repo_url.strip():
        raise HTTPException(status_code=422, detail="repo_url must not be empty")

    with Session(engine) as db:
        deployment = Deployment(
            name=payload.name.strip(),
            repo_url=payload.repo_url.strip(),
            container_id=None,
            port=find_next_available_port(db),
            status="building",
            error_message=None,
        )
        db.add(deployment)
        db.commit()
        db.refresh(deployment)

        deployment_id = deployment.id
        name = deployment.name
        repo_url = deployment.repo_url
        port = deployment.port
        db.expunge(deployment)

    background_tasks.add_task(
        run_deployment,
        deployment_id,
        name,
        repo_url,
        port,
    )
    return deployment


@app.get("/deployments/{deployment_id}/logs")
def deployment_logs(deployment_id: int) -> dict[str, str]:
    with Session(engine) as db:
        deployment = db.get(Deployment, deployment_id)
        if deployment is None:
            raise HTTPException(status_code=404, detail="Deployment not found")
        if deployment.status == "failed":
            return {"logs": deployment.error_message or "Deployment failed"}
        if not deployment.container_id:
            raise HTTPException(
                status_code=409,
                detail="Deployment does not have a running container",
            )
        container_id = deployment.container_id

    try:
        return {"logs": deployer.get_container_logs(container_id)}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post(
    "/deployments/{deployment_id}/restart",
    response_model=DeploymentResponse,
)
def restart_deployment(deployment_id: int) -> Deployment:
    with Session(engine) as db:
        deployment = db.get(Deployment, deployment_id)
        if deployment is None:
            raise HTTPException(status_code=404, detail="Deployment not found")
        if not deployment.container_id:
            raise HTTPException(
                status_code=409,
                detail="Deployment does not have a container to restart",
            )

        container_id = deployment.container_id
        try:
            deployer.restart_container(container_id)
        except Exception as exc:
            raise HTTPException(status_code=500, detail=str(exc)) from exc

        deployment.status = "running"
        deployment.error_message = None
        db.commit()
        db.refresh(deployment)
        db.expunge(deployment)
        return deployment


@app.delete("/deployments/{deployment_id}", status_code=204)
def delete_deployment(deployment_id: int) -> None:
    with Session(engine) as db:
        deployment = db.get(Deployment, deployment_id)
        if deployment is None:
            raise HTTPException(status_code=404, detail="Deployment not found")

        container_id = deployment.container_id
        if container_id:
            try:
                deployer.remove_container(container_id)
            except Exception as exc:
                raise HTTPException(status_code=500, detail=str(exc)) from exc

        db.delete(deployment)
        db.commit()
