from pathlib import Path
import json
from typing import Dict, Any, Tuple, Optional

def scan_project_metadata(project_path: str) -> Dict[str, Optional[str]]:
    """
    Scans a folder and auto-detects primary language and framework.
    """
    p = Path(project_path)
    if not p.exists() or not p.is_dir():
        return {"language": None, "framework": None}

    language: Optional[str] = None
    framework: Optional[str] = None

    # Check for JavaScript / TypeScript
    pkg_json_path = p / "package.json"
    if pkg_json_path.exists():
        language = "TypeScript" if (p / "tsconfig.json").exists() else "JavaScript"
        try:
            with open(pkg_json_path, "r", encoding="utf-8") as f:
                pkg = json.load(f)
                deps = {**pkg.get("dependencies", {}), **pkg.get("devDependencies", {})}
                if "next" in deps:
                    framework = "Next.js"
                elif "react" in deps:
                    framework = "React (Vite)" if "vite" in deps else "React"
                elif "vue" in deps:
                    framework = "Vue"
                elif "electron" in deps:
                    framework = "Electron"
                elif "express" in deps:
                    framework = "Express"
        except Exception:
            framework = None

    # Check for Python
    elif (p / "requirements.txt").exists() or (p / "pyproject.toml").exists() or (p / "Pipfile").exists():
        language = "Python"
        req_path = p / "requirements.txt"
        if req_path.exists():
            try:
                content = req_path.read_text(encoding="utf-8").lower()
                if "fastapi" in content:
                    framework = "FastAPI"
                elif "django" in content:
                    framework = "Django"
                elif "flask" in content:
                    framework = "Flask"
            except Exception:
                pass

    # Check for Rust
    elif (p / "Cargo.toml").exists():
        language = "Rust"
        framework = "Cargo"

    # Check for Go
    elif (p / "go.mod").exists():
        language = "Go"
        framework = "Go Module"

    return {
        "language": language or "Unknown",
        "framework": framework or "Standard"
    }
