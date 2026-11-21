import re
import shutil
import subprocess
import tempfile
from typing import Optional, Tuple

import docker


def _sanitize_image_tag(app_name: str) -> str:
    tag = re.sub(r"[^a-z0-9_.-]+", "-", app_name.lower()).strip("-_.")
    return tag or "app"


def deploy_repo(
    repo_url: str,
    app_name: str,
    port: int,
) -> Tuple[Optional[str], Optional[str]]:
    temp_dir: Optional[str] = None

    try:
        if not repo_url or not repo_url.strip():
            raise ValueError("repo_url must not be empty")
        if not isinstance(port, int) or isinstance(port, bool) or not 1 <= port <= 65535:
            raise ValueError("port must be an integer between 1 and 65535")

        temp_dir = tempfile.mkdtemp(prefix="campus-cloud-")
        subprocess.run(
            ["git", "clone", repo_url, temp_dir],
            check=True,
            capture_output=True,
            text=True,
        )

        image_tag = _sanitize_image_tag(app_name)
        client = docker.from_env()
        client.images.build(path=temp_dir, tag=image_tag, rm=True)
        container = client.containers.run(
            image_tag,
            detach=True,
            ports={"8000/tcp": port},
        )
        return container.id, None
    except subprocess.CalledProcessError as exc:
        details = (exc.stderr or exc.stdout or str(exc)).strip()
        return None, f"Git clone failed: {details}"
    except (docker.errors.DockerException, OSError, ValueError) as exc:
        return None, str(exc)
    except Exception as exc:
        return None, f"Deployment failed: {exc}"
    finally:
        if temp_dir:
            shutil.rmtree(temp_dir, ignore_errors=True)


def get_container_logs(container_id: str) -> str:
    if not container_id or not container_id.strip():
        raise ValueError("container_id must not be empty")

    try:
        client = docker.from_env()
        container = client.containers.get(container_id)
        logs = container.logs(tail=100, stdout=True, stderr=True)
        if isinstance(logs, bytes):
            return logs.decode("utf-8", errors="replace")
        return str(logs)
    except (docker.errors.DockerException, OSError) as exc:
        raise RuntimeError(f"Failed to get container logs: {exc}") from exc


def restart_container(container_id: str) -> None:
    if not container_id or not container_id.strip():
        raise ValueError("container_id must not be empty")

    try:
        client = docker.from_env()
        client.containers.get(container_id).restart()
    except docker.errors.DockerException as exc:
        raise RuntimeError(f"Failed to restart container: {exc}") from exc


def remove_container(container_id: str) -> None:
    if not container_id or not container_id.strip():
        raise ValueError("container_id must not be empty")

    try:
        client = docker.from_env()
        container = client.containers.get(container_id)
        container.stop()
        container.remove(force=True)
    except docker.errors.DockerException as exc:
        raise RuntimeError(f"Failed to remove container: {exc}") from exc
