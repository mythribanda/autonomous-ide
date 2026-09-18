import os
import json
import asyncio
from pathlib import Path
from typing import Dict, Any, List, Optional, Set, Tuple
from collections import Counter

from backend.schemas import ProjectScanResult

# Directories to skip entirely during scan
IGNORED_DIRS: Set[str] = {
    "node_modules",
    ".git",
    "__pycache__",
    "dist",
    "build",
    ".next",
    ".nuxt",
    ".output",
    "target",
    "vendor",
    ".venv",
    "venv",
    ".idea",
    ".vscode",
    "coverage",
    ".pytest_cache",
    ".turbo",
    ".cache"
}

# Extension to language mapping
EXTENSION_MAP: Dict[str, str] = {
    ".ts": "TypeScript",
    ".tsx": "TypeScript",
    ".js": "JavaScript",
    ".jsx": "JavaScript",
    ".mjs": "JavaScript",
    ".cjs": "JavaScript",
    ".py": "Python",
    ".rs": "Rust",
    ".go": "Go",
    ".java": "Java",
    ".c": "C",
    ".h": "C",
    ".cpp": "C++",
    ".hpp": "C++",
    ".cc": "C++",
    ".cxx": "C++",
    ".cs": "C#",
    ".rb": "Ruby",
    ".php": "PHP",
    ".swift": "Swift",
    ".kt": "Kotlin",
    ".kts": "Kotlin",
    ".dart": "Dart",
    ".scala": "Scala",
    ".html": "HTML",
    ".css": "CSS",
    ".scss": "CSS",
    ".sass": "CSS",
    ".less": "CSS",
    ".sql": "SQL",
    ".sh": "Shell",
    ".bash": "Shell",
    ".ps1": "PowerShell"
}

# Common entry point candidates
ENTRY_POINT_CANDIDATES: List[str] = [
    # Frontend
    "src/main.tsx",
    "src/index.tsx",
    "src/main.ts",
    "src/index.ts",
    "src/App.tsx",
    "src/app.tsx",
    "index.html",
    "pages/index.tsx",
    "app/page.tsx",
    "app/layout.tsx",
    # Electron
    "electron/main.ts",
    "electron/main.js",
    # Python
    "backend/main.py",
    "src/main.py",
    "main.py",
    "app.py",
    "server.py",
    "run.py",
    # Node / JS
    "index.js",
    "server.js",
    "app.js",
    "src/index.js",
    "src/server.js",
    # Rust / Go
    "src/main.rs",
    "main.go",
    "cmd/main.go"
]


class ProjectScanner:
    """
    High-performance project analyzer that inspects codebases,
    detects languages, frameworks, package managers, test setups,
    databases, APIs, entry points, and directory structures.
    """

    async def scan(self, project_path: str) -> ProjectScanResult:
        p = Path(project_path).resolve()
        if not p.exists() or not p.is_dir():
            return ProjectScanResult()

        # Run CPU/disk bound scanning in thread pool for maximum speed
        return await asyncio.to_thread(self._scan_sync, p)

    def _scan_sync(self, root: Path) -> ProjectScanResult:
        file_count = 0
        lang_counter: Counter = Counter()
        all_relative_files: List[str] = []
        root_entries: Set[str] = set()

        # Fast traversal with os.scandir skipping heavy directories
        for dirpath, dirnames, filenames in os.walk(root):
            # Prune ignored directories in-place so os.walk skips descending into them
            dirnames[:] = [d for d in dirnames if d not in IGNORED_DIRS]

            rel_dir = os.path.relpath(dirpath, root)
            if rel_dir == ".":
                root_entries = set(filenames).union(set(dirnames))

            for fname in filenames:
                file_count += 1
                rel_path = os.path.normpath(os.path.join(rel_dir, fname)).replace("\\", "/")
                all_relative_files.append(rel_path)

                _, ext = os.path.splitext(fname.lower())
                if ext in EXTENSION_MAP:
                    lang_counter[EXTENSION_MAP[ext]] += 1

        # Determine sorted languages by frequency
        languages = [lang for lang, _ in lang_counter.most_common()]

        # Package manager detection
        package_manager = self._detect_package_manager(root)

        # Config files parsing (skipping .env!)
        config_files = self._parse_config_files(root)

        # Framework, test framework, database, and API style detection
        frameworks, test_framework, detected_database, api_style = self._detect_ecosystem(
            root, all_relative_files
        )

        # Entry point detection
        entry_points = [ep for ep in ENTRY_POINT_CANDIDATES if (root / ep).exists()]

        # Docker, Git, CI flags
        has_docker = self._detect_docker(root)
        has_git = (root / ".git").exists()
        has_ci = self._detect_ci(root)

        # Directory structure (depth 3 max)
        directory_structure = self._build_directory_tree(root, max_depth=3)

        return ProjectScanResult(
            languages=languages,
            frameworks=frameworks,
            package_manager=package_manager,
            entry_points=entry_points,
            config_files=config_files,
            test_framework=test_framework,
            has_docker=has_docker,
            has_git=has_git,
            has_ci=has_ci,
            file_count=file_count,
            directory_structure=directory_structure,
            detected_database=detected_database,
            api_style=api_style
        )

    def _detect_package_manager(self, root: Path) -> Optional[str]:
        if (root / "package-lock.json").exists():
            return "npm"
        if (root / "yarn.lock").exists():
            return "yarn"
        if (root / "pnpm-lock.yaml").exists():
            return "pnpm"
        if (root / "bun.lockb").exists() or (root / "bun.lock").exists():
            return "bun"
        if (root / "poetry.lock").exists():
            return "poetry"
        if (root / "Pipfile.lock").exists() or (root / "Pipfile").exists():
            return "pipenv"
        if (root / "Cargo.lock").exists() or (root / "Cargo.toml").exists():
            return "cargo"
        if (root / "go.sum").exists() or (root / "go.mod").exists():
            return "go"
        if (root / "pom.xml").exists():
            return "maven"
        if (root / "build.gradle").exists() or (root / "build.gradle.kts").exists():
            return "gradle"
        if (root / "requirements.txt").exists() or (root / "pyproject.toml").exists():
            return "pip"
        if (root / "package.json").exists():
            return "npm"
        return None

    def _detect_docker(self, root: Path) -> bool:
        docker_indicators = [
            "Dockerfile",
            "docker-compose.yml",
            "docker-compose.yaml",
            "compose.yaml",
            "compose.yml",
            ".dockerignore"
        ]
        return any((root / ind).exists() for ind in docker_indicators)

    def _detect_ci(self, root: Path) -> bool:
        ci_indicators = [
            root / ".github" / "workflows",
            root / ".gitlab-ci.yml",
            root / ".circleci",
            root / "Jenkinsfile",
            root / ".travis.yml",
            root / "azure-pipelines.yml"
        ]
        return any(ind.exists() for ind in ci_indicators)

    def _parse_config_files(self, root: Path) -> Dict[str, str]:
        configs: Dict[str, str] = {}

        # 1. package.json
        pkg_path = root / "package.json"
        if pkg_path.exists():
            try:
                with open(pkg_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    scripts = list(data.get("scripts", {}).keys())
                    deps_count = len(data.get("dependencies", {}))
                    dev_deps_count = len(data.get("devDependencies", {}))
                    name = data.get("name", "app")
                    version = data.get("version", "1.0.0")
                    configs["package.json"] = (
                        f"name: {name}, version: {version}, "
                        f"scripts: [{', '.join(scripts[:6])}], "
                        f"dependencies: {deps_count}, devDependencies: {dev_deps_count}"
                    )
            except Exception as e:
                configs["package.json"] = f"Error reading package.json: {str(e)}"

        # 2. tsconfig.json
        tsconfig_path = root / "tsconfig.json"
        if tsconfig_path.exists():
            try:
                content = tsconfig_path.read_text(encoding="utf-8", errors="replace")
                # Strip comments for naive parse
                clean_lines = [line for line in content.splitlines() if not line.strip().startswith("//")]
                ts_data = json.loads("\n".join(clean_lines))
                opts = ts_data.get("compilerOptions", {})
                target = opts.get("target", "default")
                module = opts.get("module", "default")
                jsx = opts.get("jsx", "none")
                configs["tsconfig.json"] = f"target: {target}, module: {module}, jsx: {jsx}"
            except Exception:
                configs["tsconfig.json"] = "TypeScript configuration present"

        # 3. requirements.txt (root or backend/)
        for candidate in ["requirements.txt", "backend/requirements.txt"]:
            req_path = root / candidate
            if req_path.exists():
                try:
                    lines = [
                        l.strip().split("==")[0].split(">=")[0].split("<=")[0]
                        for l in req_path.read_text(encoding="utf-8", errors="replace").splitlines()
                        if l.strip() and not l.strip().startswith("#")
                    ]
                    configs["requirements.txt"] = f"packages: {', '.join(lines[:8])}{'...' if len(lines) > 8 else ''}"
                    break
                except Exception:
                    configs["requirements.txt"] = "Python requirements file present"
                    break

        # 4. pyproject.toml
        for candidate in ["pyproject.toml", "backend/pyproject.toml"]:
            pyproject_path = root / candidate
            if pyproject_path.exists():
                try:
                    text = pyproject_path.read_text(encoding="utf-8", errors="replace")
                    configs["pyproject.toml"] = f"size: {len(text)} bytes"
                    break
                except Exception:
                    configs["pyproject.toml"] = "pyproject.toml present"
                    break

        # 5. .env.example (NEVER read .env!)
        for candidate in [".env.example", "backend/.env.example"]:
            env_example_path = root / candidate
            if env_example_path.exists():
                try:
                    keys = [
                        line.split("=")[0].strip()
                        for line in env_example_path.read_text(encoding="utf-8", errors="replace").splitlines()
                        if line.strip() and not line.strip().startswith("#") and "=" in line
                    ]
                    configs[".env.example"] = f"keys: [{', '.join(keys[:8])}]"
                    break
                except Exception:
                    configs[".env.example"] = ".env.example present"
                    break

        # 6. vite.config.ts / vite.config.js
        for vite_name in ["vite.config.ts", "vite.config.js"]:
            if (root / vite_name).exists():
                configs[vite_name] = "Vite build tool configuration"
                break

        return configs

    def _detect_ecosystem(
        self, root: Path, all_files: List[str]
    ) -> Tuple[List[str], Optional[str], Optional[str], Optional[str]]:
        frameworks: List[str] = []
        test_framework: Optional[str] = None
        detected_database: Optional[str] = None
        api_style: Optional[str] = None

        all_deps: Set[str] = set()
        scripts: Dict[str, str] = {}

        # 1. Inspect package.json
        for pkg_candidate in ["package.json", "frontend/package.json"]:
            pkg_path = root / pkg_candidate
            if pkg_path.exists():
                try:
                    with open(pkg_path, "r", encoding="utf-8") as f:
                        pkg_data = json.load(f)
                        scripts.update(pkg_data.get("scripts", {}))
                        deps = {**pkg_data.get("dependencies", {}), **pkg_data.get("devDependencies", {})}
                        for d in deps.keys():
                            all_deps.add(d.lower())
                except Exception:
                    pass

        # 2. Inspect requirements.txt and pyproject.toml
        for req_candidate in ["requirements.txt", "backend/requirements.txt"]:
            req_path = root / req_candidate
            if req_path.exists():
                try:
                    for line in req_path.read_text(encoding="utf-8", errors="replace").splitlines():
                        cleaned = line.strip().lower()
                        if cleaned and not cleaned.startswith("#"):
                            pkg = cleaned.split("==")[0].split(">=")[0].split("<=")[0].split("[")[0].strip()
                            all_deps.add(pkg)
                except Exception:
                    pass

        for pyproj_candidate in ["pyproject.toml", "backend/pyproject.toml"]:
            pyproj_path = root / pyproj_candidate
            if pyproj_path.exists():
                try:
                    content = pyproj_path.read_text(encoding="utf-8", errors="replace").lower()
                    for indicator in ["fastapi", "django", "flask", "pytest", "sqlalchemy"]:
                        if indicator in content:
                            all_deps.add(indicator)
                except Exception:
                    pass

        # Framework detection
        if "next" in all_deps:
            frameworks.append("Next.js")
        elif "react" in all_deps:
            frameworks.append("React (Vite)" if "vite" in all_deps else "React")

        if "vue" in all_deps:
            frameworks.append("Vue")
        if "svelte" in all_deps:
            frameworks.append("Svelte")
        if "electron" in all_deps:
            frameworks.append("Electron")
        if "fastapi" in all_deps:
            frameworks.append("FastAPI")
        if "django" in all_deps:
            frameworks.append("Django")
        if "flask" in all_deps:
            frameworks.append("Flask")
        if "express" in all_deps:
            frameworks.append("Express")
        if "nest" in all_deps or "@nestjs/core" in all_deps:
            frameworks.append("NestJS")
        if "tailwindcss" in all_deps:
            frameworks.append("Tailwind CSS")

        # Test framework detection
        script_text = " ".join(scripts.values()).lower()
        if "vitest" in all_deps or "vitest" in script_text:
            test_framework = "vitest"
        elif "jest" in all_deps or "jest" in script_text:
            test_framework = "jest"
        elif "playwright" in all_deps or "@playwright/test" in all_deps or "playwright" in script_text:
            test_framework = "playwright"
        elif "cypress" in all_deps or "cypress" in script_text:
            test_framework = "cypress"
        elif "pytest" in all_deps:
            test_framework = "pytest"
        elif any(f.endswith("_test.go") for f in all_files):
            test_framework = "go test"
        elif (root / "Cargo.toml").exists():
            test_framework = "cargo test"

        # Database detection
        if any(d in all_deps for d in ["sqlite", "aiosqlite", "sqlite3"]):
            detected_database = "sqlite"
        elif any(d in all_deps for d in ["postgresql", "psycopg2", "psycopg2-binary", "asyncpg", "pg"]):
            detected_database = "postgresql"
        elif any(d in all_deps for d in ["mongodb", "pymongo", "mongoose", "motor"]):
            detected_database = "mongodb"
        elif any(d in all_deps for d in ["mysql", "mysqlclient", "aiomysql", "mysql2"]):
            detected_database = "mysql"
        elif "redis" in all_deps:
            detected_database = "redis"

        # API Style detection
        if any(d in all_deps for d in ["graphql", "apollo-server", "graphene"]):
            api_style = "GraphQL"
        elif any(d in all_deps for d in ["@trpc/server", "@trpc/client"]):
            api_style = "tRPC"
        elif any(d in all_deps for d in ["grpcio", "grpc", "@grpc/grpc-js"]):
            api_style = "gRPC"
        elif any(f in frameworks for f in ["FastAPI", "Express", "Flask", "Django", "NestJS"]):
            api_style = "REST"

        return frameworks, test_framework, detected_database, api_style

    def _build_directory_tree(self, root: Path, max_depth: int = 3) -> Dict[str, Any]:
        """
        Builds a nested tree of folders up to max_depth, ignoring heavy dirs.
        """
        def build_node(path: Path, current_depth: int) -> Dict[str, Any]:
            node: Dict[str, Any] = {
                "name": path.name or str(path),
                "type": "directory"
            }
            if current_depth >= max_depth:
                return node

            children: List[Dict[str, Any]] = []
            try:
                entries = sorted(os.scandir(path), key=lambda e: (not e.is_dir(), e.name.lower()))
                for entry in entries:
                    if entry.name in IGNORED_DIRS:
                        continue
                    if entry.is_dir():
                        children.append(build_node(Path(entry.path), current_depth + 1))
                    else:
                        children.append({
                            "name": entry.name,
                            "type": "file"
                        })
            except (PermissionError, OSError):
                pass

            node["children"] = children
            return node

        return build_node(root, 0)


# Backward compatibility helper
def scan_project_metadata(project_path: str) -> Dict[str, Optional[str]]:
    scanner = ProjectScanner()
    p = Path(project_path).resolve()
    res = scanner._scan_sync(p)
    return {
        "language": res.languages[0] if res.languages else "Unknown",
        "framework": res.frameworks[0] if res.frameworks else "Standard"
    }
