import os
import re
import time
import asyncio
import logging
from pathlib import Path
from typing import Optional, List, Dict, Any, Callable, Awaitable

import yaml
from backend.schemas import (
    DockerConfig,
    BuildResult,
    ContainerResult,
    ContainerInfo,
    ProjectScanResult
)
from backend.services.model_provider import model_router

logger = logging.getLogger("docker_service")

try:
    import docker
    from docker.errors import DockerException, NotFound, APIError
    HAS_DOCKER_PKG = True
except ImportError:
    docker = None
    DockerException = Exception
    NotFound = Exception
    APIError = Exception
    HAS_DOCKER_PKG = False


class DockerService:
    def __init__(self):
        self._client = None
        self._last_daemon_check = 0.0
        self._cached_daemon_status = False

    def get_client(self):
        """Returns Docker SDK client if Docker is installed and daemon is responsive."""
        if not HAS_DOCKER_PKG:
            return None
        try:
            if self._client is None:
                self._client = docker.from_env()
            # Fast ping
            self._client.ping()
            return self._client
        except Exception as e:
            logger.debug(f"Docker client ping failed: {e}")
            self._client = None
            return None

    def is_daemon_running(self) -> bool:
        """Checks if Docker daemon is running with a 5-second cache to prevent hammering."""
        now = time.time()
        if now - self._last_daemon_check < 5.0:
            return self._cached_daemon_status

        self._last_daemon_check = now
        client = self.get_client()
        if client is not None:
            self._cached_daemon_status = True
            return True

        # Fallback to CLI test
        try:
            import subprocess
            res = subprocess.run(
                ["docker", "info", "--format", "{{.ServerVersion}}"],
                capture_output=True,
                text=True,
                timeout=3
            )
            self._cached_daemon_status = (res.returncode == 0)
        except Exception:
            self._cached_daemon_status = False

        return self._cached_daemon_status

    def detect_docker_config(self, project_path: str) -> DockerConfig:
        """Scans project directory for Dockerfile and docker-compose configurations."""
        root = Path(project_path)
        has_dockerfile = False
        dockerfile_base_image: Optional[str] = None
        has_compose = False
        compose_services: List[str] = []

        if not root.exists():
            return DockerConfig(
                has_dockerfile=False,
                has_compose=False,
                is_daemon_running=self.is_daemon_running()
            )

        # 1. Search for Dockerfile
        possible_dockerfiles = [
            root / "Dockerfile",
            root / "docker" / "Dockerfile",
            root / "Dockerfile.dev",
            root / "Dockerfile.prod"
        ]
        dockerfile_path = None
        for p in possible_dockerfiles:
            if p.is_file():
                has_dockerfile = True
                dockerfile_path = p
                break

        if dockerfile_path and dockerfile_path.is_file():
            try:
                content = dockerfile_path.read_text(encoding="utf-8", errors="ignore")
                for line in content.splitlines():
                    match = re.match(r"^\s*FROM\s+([^\s]+)", line, re.IGNORECASE)
                    if match:
                        dockerfile_base_image = match.group(1).strip()
                        break
            except Exception as err:
                logger.warning(f"Error reading Dockerfile {dockerfile_path}: {err}")

        # 2. Search for Docker Compose
        possible_compose = [
            root / "docker-compose.yml",
            root / "docker-compose.yaml",
            root / "compose.yml",
            root / "compose.yaml"
        ]
        compose_path = None
        for p in possible_compose:
            if p.is_file():
                has_compose = True
                compose_path = p
                break

        if compose_path and compose_path.is_file():
            try:
                raw_yaml = compose_path.read_text(encoding="utf-8", errors="ignore")
                data = yaml.safe_load(raw_yaml)
                if isinstance(data, dict) and "services" in data and isinstance(data["services"], dict):
                    compose_services = list(data["services"].keys())
            except Exception as err:
                logger.warning(f"Error parsing compose file {compose_path}: {err}")
                # Fallback to regex service extraction
                try:
                    services = re.findall(r"^\s{2}([a-zA-Z0-9_-]+):\s*$", raw_yaml, re.MULTILINE)
                    compose_services = list(dict.fromkeys(services))
                except Exception:
                    pass

        return DockerConfig(
            has_dockerfile=has_dockerfile,
            has_compose=has_compose,
            compose_services=compose_services,
            dockerfile_base_image=dockerfile_base_image,
            is_daemon_running=self.is_daemon_running()
        )

    async def generate_dockerfile(self, project_path: str, scan_result: Optional[ProjectScanResult] = None) -> str:
        """Generates a production-ready, multi-stage Dockerfile tailored to project stack."""
        frameworks = ", ".join(scan_result.frameworks) if scan_result and scan_result.frameworks else "Standard web app"
        languages = ", ".join(scan_result.languages) if scan_result and scan_result.languages else "JavaScript / TypeScript"
        package_manager = scan_result.package_manager if scan_result and scan_result.package_manager else "npm"
        entry_point = (scan_result.entry_points[0] if scan_result and scan_result.entry_points else "index.js")
        has_tests = bool(scan_result and scan_result.test_framework)

        system_prompt = "Generate a production-ready Dockerfile for the following project."
        user_prompt = (
            f"Framework: {frameworks}, Language: {languages}, Package manager: {package_manager}\n"
            f"Entry point: {entry_point}, Has tests: {has_tests}\n"
            "Generate a multi-stage Dockerfile. Return ONLY the Dockerfile content without markdown backticks or commentary."
        )

        try:
            response = await model_router.complete("coding", system_prompt, user_prompt, max_tokens=1500, temperature=0.2)
            content = response.content.strip()
            # Strip markdown formatting if returned
            content = re.sub(r"^```(?:dockerfile)?\s*", "", content, flags=re.IGNORECASE)
            content = re.sub(r"\s*```$", "", content)
            if "FROM " in content:
                return content.strip()
        except Exception as e:
            logger.warning(f"Ollama generation failed or timed out: {e}. Using intelligent fallback template.")

        # Intelligent Fallback Template
        langs_lower = [l.lower() for l in (scan_result.languages if scan_result else [])]
        fws_lower = [f.lower() for f in (scan_result.frameworks if scan_result else [])]

        if "python" in langs_lower or any("fastapi" in f or "flask" in f or "django" in f for f in fws_lower):
            return (
                "# Stage 1: Base build stage\n"
                "FROM python:3.12-slim AS base\n\n"
                "WORKDIR /app\n"
                "ENV PYTHONDONTWRITEBYTECODE=1 \\\n"
                "    PYTHONUNBUFFERED=1\n\n"
                "RUN apt-get update && apt-get install -y --no-install-recommends gcc curl && rm -rf /var/lib/apt/lists/*\n\n"
                "# Stage 2: Dependencies\n"
                "COPY requirements.txt ./\n"
                "RUN pip install --no-cache-dir --upgrade pip && \\\n"
                "    pip install --no-cache-dir -r requirements.txt\n\n"
                "# Stage 3: Runtime stage\n"
                "COPY . .\n"
                "EXPOSE 8000\n"
                'CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]\n'
            )
        elif any(x in langs_lower for x in ["typescript", "javascript"]) or any("react" in f or "vite" in f or "node" in f for f in fws_lower):
            return (
                "# Stage 1: Build stage\n"
                "FROM node:20-alpine AS builder\n\n"
                "WORKDIR /app\n"
                "COPY package*.json ./\n"
                "RUN npm ci\n\n"
                "COPY . .\n"
                "RUN npm run build || true\n\n"
                "# Stage 2: Production runner\n"
                "FROM node:20-alpine AS runner\n\n"
                "WORKDIR /app\n"
                "ENV NODE_ENV=production\n"
                "COPY --from=builder /app/package*.json ./\n"
                "RUN npm ci --only=production\n"
                "COPY --from=builder /app/dist ./dist\n"
                "COPY --from=builder /app/index.html ./dist/\n\n"
                "EXPOSE 3000\n"
                'CMD ["npx", "serve", "-s", "dist", "-l", "3000"]\n'
            )
        elif "go" in langs_lower:
            return (
                "# Stage 1: Builder\n"
                "FROM golang:1.22-alpine AS builder\n\n"
                "WORKDIR /app\n"
                "COPY go.mod go.sum* ./\n"
                "RUN go mod download\n\n"
                "COPY . .\n"
                "RUN CGO_ENABLED=0 GOOS=linux go build -o main .\n\n"
                "# Stage 2: Minimal runtime\n"
                "FROM alpine:3.19 AS runner\n\n"
                "WORKDIR /app\n"
                "COPY --from=builder /app/main .\n"
                "EXPOSE 8080\n"
                'ENTRYPOINT ["./main"]\n'
            )
        else:
            return (
                "# Multi-stage Dockerfile\n"
                "FROM alpine:3.19 AS base\n"
                "WORKDIR /app\n"
                "COPY . .\n"
                "EXPOSE 8080\n"
                'CMD ["sh"]\n'
            )

    async def generate_compose(self, project_path: str, services: Optional[List[str]] = None, db: Optional[str] = None) -> str:
        """Generates a docker-compose.yml file integrating app, database, and cache services."""
        root = Path(project_path)
        app_name = root.name.lower().replace(" ", "-") or "app"

        db_choice = (db or "postgres").lower()
        compose_dict = {
            "version": "3.8",
            "services": {
                app_name: {
                    "build": {
                        "context": ".",
                        "dockerfile": "Dockerfile"
                    },
                    "ports": ["3000:3000"],
                    "environment": [
                        "NODE_ENV=development",
                        "PORT=3000"
                    ],
                    "restart": "unless-stopped"
                }
            }
        }

        # Add Database if requested or detected
        if "postgres" in db_choice or "psql" in db_choice:
            compose_dict["services"]["postgres"] = {
                "image": "postgres:16-alpine",
                "environment": [
                    "POSTGRES_USER=postgres",
                    "POSTGRES_PASSWORD=postgres",
                    "POSTGRES_DB=app_db"
                ],
                "ports": ["5432:5432"],
                "volumes": ["postgres_data:/var/lib/postgresql/data"],
                "restart": "unless-stopped"
            }
            compose_dict["services"][app_name]["depends_on"] = ["postgres"]
            compose_dict["services"][app_name]["environment"].append(
                "DATABASE_URL=postgres://postgres:postgres@postgres:5432/app_db"
            )
            compose_dict["volumes"] = {"postgres_data": None}
        elif "mysql" in db_choice or "mariadb" in db_choice:
            compose_dict["services"]["mysql"] = {
                "image": "mysql:8.0",
                "environment": [
                    "MYSQL_ROOT_PASSWORD=root",
                    "MYSQL_DATABASE=app_db"
                ],
                "ports": ["3306:3306"],
                "volumes": ["mysql_data:/var/lib/mysql"],
                "restart": "unless-stopped"
            }
            compose_dict["services"][app_name]["depends_on"] = ["mysql"]
            compose_dict["volumes"] = {"mysql_data": None}
        elif "mongo" in db_choice:
            compose_dict["services"]["mongodb"] = {
                "image": "mongo:7.0",
                "ports": ["27017:27017"],
                "volumes": ["mongo_data:/data/db"],
                "restart": "unless-stopped"
            }
            compose_dict["services"][app_name]["depends_on"] = ["mongodb"]
            compose_dict["volumes"] = {"mongo_data": None}

        # Add Redis cache if specified in services
        if services and "redis" in [s.lower() for s in services]:
            compose_dict["services"]["redis"] = {
                "image": "redis:7-alpine",
                "ports": ["6379:6379"],
                "restart": "unless-stopped"
            }

        return yaml.dump(compose_dict, sort_keys=False, default_flow_style=False)

    async def build_image(
        self,
        project_path: str,
        tag: str = "latest",
        log_callback: Optional[Callable[[str], Awaitable[None]]] = None
    ) -> BuildResult:
        """Executes a Docker image build, streaming build progress logs in real time."""
        start_time = time.time()
        log_lines: List[str] = []

        if not self.is_daemon_running():
            msg = "Docker daemon is not running. Please launch Docker Desktop and retry."
            if log_callback:
                await log_callback(f"[ERROR] {msg}\n")
            return BuildResult(
                success=False,
                tag=tag,
                build_time_seconds=0.0,
                error=msg
            )

        cmd = ["docker", "build", "-t", tag, project_path]
        if log_callback:
            await log_callback(f"$ {' '.join(cmd)}\n")

        try:
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.STDOUT
            )

            while True:
                line = await process.stdout.readline()
                if not line:
                    break
                decoded = line.decode("utf-8", errors="replace")
                log_lines.append(decoded)
                if log_callback:
                    await log_callback(decoded)

            await process.wait()
            elapsed = round(time.time() - start_time, 2)

            if process.returncode == 0:
                # Find image ID from output if possible
                image_id = None
                for line in reversed(log_lines):
                    m = re.search(r"(?:writing image|naming to docker\.io/library/[^\s]+|Successfully tagged [^\s]+)\s+([a-f0-9:]{7,})", line, re.I)
                    if m:
                        image_id = m.group(1)
                        break
                return BuildResult(
                    success=True,
                    image_id=image_id or tag,
                    tag=tag,
                    build_time_seconds=elapsed,
                    logs="".join(log_lines)
                )
            else:
                return BuildResult(
                    success=False,
                    tag=tag,
                    build_time_seconds=elapsed,
                    error=f"Build failed with exit code {process.returncode}",
                    logs="".join(log_lines)
                )
        except Exception as e:
            elapsed = round(time.time() - start_time, 2)
            err_msg = str(e)
            if log_callback:
                await log_callback(f"\n[FATAL] {err_msg}\n")
            return BuildResult(
                success=False,
                tag=tag,
                build_time_seconds=elapsed,
                error=err_msg,
                logs="".join(log_lines)
            )

    async def start_container(
        self,
        image_tag: str,
        ports: Dict[str, str],
        env_file: Optional[str] = None,
        container_name: Optional[str] = None
    ) -> ContainerResult:
        """Starts a background container with port mapping and env configuration."""
        if not self.is_daemon_running():
            return ContainerResult(
                success=False,
                ports=ports,
                error="Docker daemon is not running."
            )

        name = container_name or f"auto-ide-{int(time.time())}"
        cmd = ["docker", "run", "-d", "--name", name]
        for host_port, container_port in ports.items():
            cmd.extend(["-p", f"{host_port}:{container_port}"])

        if env_file and os.path.exists(env_file):
            cmd.extend(["--env-file", env_file])

        cmd.append(image_tag)

        try:
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout, stderr = await process.communicate()
            if process.returncode == 0:
                container_id = stdout.decode("utf-8").strip()[:12]
                return ContainerResult(
                    success=True,
                    container_id=container_id,
                    container_name=name,
                    ports=ports
                )
            else:
                err_text = stderr.decode("utf-8").strip()
                return ContainerResult(
                    success=False,
                    ports=ports,
                    error=err_text or f"Process exited with code {process.returncode}"
                )
        except Exception as e:
            return ContainerResult(success=False, ports=ports, error=str(e))

    async def stop_container(self, container_id: str) -> bool:
        """Stops and removes a container gracefully."""
        if not self.is_daemon_running():
            return False
        try:
            process = await asyncio.create_subprocess_exec(
                "docker", "stop", container_id,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            await process.communicate()
            return process.returncode == 0
        except Exception as e:
            logger.warning(f"Error stopping container {container_id}: {e}")
            return False

    async def get_container_logs(self, container_id: str, tail: int = 100) -> str:
        """Fetches stdout/stderr logs from a container."""
        if not self.is_daemon_running():
            return "Docker daemon is not running."
        try:
            process = await asyncio.create_subprocess_exec(
                "docker", "logs", "--tail", str(tail), container_id,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.STDOUT
            )
            stdout, _ = await process.communicate()
            return stdout.decode("utf-8", errors="replace")
        except Exception as e:
            return f"Failed to retrieve container logs: {e}"

    def get_running_containers(self, project_path: Optional[str] = None) -> List[ContainerInfo]:
        """Lists running containers from the Docker daemon."""
        if not self.is_daemon_running():
            return []

        containers: List[ContainerInfo] = []
        client = self.get_client()
        if client:
            try:
                for c in client.containers.list():
                    port_map: Dict[str, str] = {}
                    if c.ports:
                        for k, v in c.ports.items():
                            if v:
                                port_map[str(v[0].get("HostPort"))] = str(k)
                    containers.append(ContainerInfo(
                        id=c.short_id,
                        name=c.name,
                        image=c.image.tags[0] if c.image.tags else str(c.image.id)[:12],
                        status=c.status,
                        ports=port_map,
                        created=str(c.attrs.get("Created", ""))[:19].replace("T", " ")
                    ))
                return containers
            except Exception as e:
                logger.warning(f"Docker SDK get_running_containers error: {e}")

        # Fallback to CLI format
        try:
            import subprocess
            res = subprocess.run(
                ["docker", "ps", "--format", "{{.ID}}|{{.Names}}|{{.Image}}|{{.Status}}|{{.Ports}}|{{.CreatedAt}}"],
                capture_output=True,
                text=True,
                timeout=5
            )
            if res.returncode == 0 and res.stdout.strip():
                for line in res.stdout.strip().splitlines():
                    parts = line.split("|")
                    if len(parts) >= 5:
                        cid, name, img, status, raw_ports = parts[0], parts[1], parts[2], parts[3], parts[4]
                        created = parts[5] if len(parts) > 5 else ""
                        containers.append(ContainerInfo(
                            id=cid[:12],
                            name=name,
                            image=img,
                            status=status,
                            ports={"raw": raw_ports} if raw_ports else {},
                            created=created[:19]
                        ))
        except Exception as e:
            logger.warning(f"docker ps CLI error: {e}")

        return containers


docker_service = DockerService()
