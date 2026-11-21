# CampusCloud — Self-Hosted Mini PaaS

Deploy GitHub repositories to Docker containers with a polished control dashboard.

[![Python](https://img.shields.io/badge/Python-3.14-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-Backend-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=20232A)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)](https://vite.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-38B2AC?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Docker](https://img.shields.io/badge/Docker-Engine-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![SQLite](https://img.shields.io/badge/SQLite-Database-003B57?logo=sqlite&logoColor=white)](https://sqlite.org/)

## Overview

CampusCloud is a lightweight, self-hosted platform-as-a-service for Ubuntu/Linux workstations and development servers. It provides a React dashboard for cloning a GitHub repository, building a Docker image, starting a container, assigning a host port, and managing the deployed application's lifecycle.

The automated flow is:

```text
GitHub repository
      |
      | git clone
      v
Temporary project directory
      |
      | Dockerfile build
      v
Docker image
      |
      | Detached run on port 8000 -> host port 8001+
      v
Live localhost deployment
```

CampusCloud exists to make the basic cloud deployment loop understandable and accessible: submit a repository, build it in Docker, view logs, restart it, or remove it without leaving the browser.

## Key Features

- One-click GitHub repository deployments from the React dashboard.
- Automatic host port allocation starting at `8001`; each used database port is skipped.
- Docker image tags derived from the app name and sanitized to lowercase.
- Five-second automatic deployment status polling.
- Live status states: `building`, `running`, and `failed`, plus `stopped`.
- Terminal-style modal for the last 100 lines of container stdout/stderr.
- Container restart and forced removal lifecycle controls.
- CORS-enabled FastAPI API for local dashboard and external tooling access.
- SQLite persistence in `backend/campuscloud.db`.
- One-command startup through `./start.sh`.

## System Architecture

```text
+------------------------------------------------------+
|                 React Dashboard                      |
|              frontend/src/App.jsx                    |
|                                                      |
|  Deploy form  ->  5-second polling  ->  Cards/logs   |
+--------------------------+---------------------------+
                           |
                           | Axios
                           | http://localhost:8000
                           v
+------------------------------------------------------+
|                   FastAPI Backend                    |
|                  backend/main.py                     |
|                                                      |
|  +-------------------+      +----------------------+ |
|  | SQLAlchemy Models |<---->| SQLite DB            | |
|  | Deployment records|      | campuscloud.db       | |
|  +---------+---------+      +----------------------+ |
|            |                                         |
|            | POST /deployments                       |
|            v                                         |
|  FastAPI BackgroundTasks                             |
+--------------------------+---------------------------+
                           |
                           | deploy_repo(...)
                           v
+------------------------------------------------------+
|                 Docker Integration                   |
|                backend/deployer.py                   |
|                                                      |
|  git clone -> Docker build -> docker run -d          |
|  container 8000/tcp -> localhost host port 8001+     |
+--------------------------+---------------------------+
                           |
                           v
+------------------------------------------------------+
|                  Live Docker Containers               |
|       Restart / logs / stop / force remove            |
+------------------------------------------------------+
```

## Tech Stack

| Layer | Technology | Role |
|---|---|---|
| Frontend | React 19 | Interactive deployment dashboard |
| Frontend tooling | Vite 8 | Development server and production bundling |
| Styling | Tailwind CSS 4 | Responsive dark-mode interface |
| HTTP client | Axios | Communication with the FastAPI API |
| Icons | Lucide React | Dashboard and lifecycle controls |
| Backend | Python 3.14, FastAPI | REST API and background deployment tasks |
| Data validation | Pydantic | Request validation and API response models |
| ORM | SQLAlchemy | Deployment persistence and queries |
| Database | SQLite | Stores records in `backend/campuscloud.db` |
| Infrastructure | Docker Engine / Docker SDK for Python | Clones, builds, runs, restarts, logs, and removes containers |
| Automation | Git CLI and Bash | Repository cloning and dual-server startup |

## Project Structure

```text
campus-cloud/
├── backend/
│   ├── main.py                 # FastAPI app, SQLAlchemy model, CORS, and REST endpoints
│   ├── deployer.py             # Git clone and Docker lifecycle integration
│   ├── requirements.txt        # FastAPI, Uvicorn, SQLAlchemy, Pydantic, and Docker SDK
│   ├── campuscloud.db          # SQLite database created in the backend working directory
│   └── venv/                   # Project-local Python virtual environment
├── frontend/
│   ├── src/
│   │   ├── App.jsx             # CampusCloud dashboard and 5-second polling
│   │   ├── api.js              # Axios API client for port 8000
│   │   ├── index.css           # Tailwind CSS import and global styles
│   │   └── main.jsx            # React application entry point
│   ├── vite.config.js          # React and Tailwind Vite plugins
│   └── package.json            # Frontend dependencies and scripts
├── start.sh                    # Starts and cleanly stops both development servers
└── README.md
```

## API Reference

The API listens on `http://localhost:8000`. Interactive documentation is available at `http://localhost:8000/docs`.

| Method | Endpoint | Description | Expected behavior |
|---|---|---|---|
| `GET` | `/deployments` | List deployments | Returns newest-first deployment records |
| `POST` | `/deployments` | Create a deployment | Accepts `{ "name": "...", "repo_url": "..." }`, saves a `building` record on the next free port starting from `8001`, and schedules `deploy_repo` in the background; returns `202` |
| `GET` | `/deployments/{id}/logs` | Read container logs | Returns the last 100 lines of stdout/stderr as `{ "logs": "..." }`; failed builds return `error_message` |
| `POST` | `/deployments/{id}/restart` | Restart a container | Restarts the container and updates its status to `running` |
| `DELETE` | `/deployments/{id}` | Remove a deployment | Stops and force-removes the container when present, then deletes the SQLite record; returns `204` |

Example create request:

```bash
curl -X POST http://localhost:8000/deployments \
  -H "Content-Type: application/json" \
  -d '{
    "name": "campus-demo",
    "repo_url": "https://github.com/your-user/campus-demo.git"
  }'
```

Example listing:

```bash
curl http://localhost:8000/deployments
```

## Prerequisites & Quick Start

### Ubuntu/Linux prerequisites

1. Install the system tools and Docker if they are not already present:

   ```bash
   sudo apt update
   sudo apt install -y git python3 python3-venv python3-pip nodejs npm docker.io
   ```

2. Start Docker and enable it on boot:

   ```bash
   sudo systemctl enable --now docker
   ```

3. Add the current user to the Docker group:

   ```bash
   sudo usermod -aG docker "$USER"
   ```

4. Log out and back in, or open a fresh shell, for Docker group membership to take effect.

5. Verify Docker access:

   ```bash
   docker info
   ```

### Project setup

From the repository root:

```bash
cd campus-cloud

# Create and populate the backend virtual environment
python3 -m venv backend/venv
backend/venv/bin/python -m pip install --upgrade pip
backend/venv/bin/python -m pip install -r backend/requirements.txt

# Install frontend dependencies
cd frontend
npm install
cd ..

# Make the launcher executable
chmod +x start.sh
```

### Start CampusCloud

```bash
./start.sh
```

This starts:

- FastAPI: `http://localhost:8000`
- Vite dashboard: `http://localhost:5173`

Press `Ctrl+C` once to stop both processes. The script traps `SIGINT` and `SIGTERM`, terminates the backend and frontend processes, and waits for them to exit.

## Testing Your First Deployment

Create a small public repository containing these two files.

### `Dockerfile`

```dockerfile
FROM python:3-alpine

WORKDIR /app
COPY index.html .

EXPOSE 8000

CMD ["python", "-m", "http.server", "8000", "--bind", "0.0.0.0"]
```

### `index.html`

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>CampusCloud Demo</title>
  </head>
  <body>
    <h1>CampusCloud deployment is live!</h1>
  </body>
</html>
```

Commit and push both files, then run CampusCloud, open `http://localhost:5173`, and submit:

- **App Name:** `campus-demo`
- **GitHub Repo URL:** `https://github.com/your-user/campus-demo.git`

The card should move from `building` to `running`. Once running, open the displayed live URL, normally `http://localhost:8001` for the first deployment.

## Future Roadmap

- [ ] Nginx reverse proxy and custom subdomains
- [ ] GitHub Webhooks for continuous deployment
- [ ] JWT authentication and role-based access control
- [ ] PostgreSQL for multi-service and production-grade persistence
- [ ] Kubernetes orchestration and horizontal scaling
- [ ] Prometheus metrics and Grafana dashboards
- [ ] AI DevOps log analyzer for failures and remediation suggestions
