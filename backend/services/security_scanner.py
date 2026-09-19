import asyncio
import json
import logging
import os
import re
import shutil
from pathlib import Path
from typing import List, Dict, Any, Optional, Set
from pydantic import BaseModel, Field

logger = logging.getLogger("autonomous_dev.security_scanner")


class SecurityException(Exception):
    """Raised when a git commit or operation is blocked due to security violations."""
    pass


class SecretMatch(BaseModel):
    file_path: str
    line_number: int
    secret_type: str
    redacted_preview: str
    severity: str = "HIGH"  # CRITICAL, HIGH, MEDIUM


class SecretScanResult(BaseModel):
    secrets_found: List[SecretMatch] = Field(default_factory=list)
    files_scanned: int = 0
    has_env_example_but_no_env: bool = False
    env_in_gitignore: bool = True


class Vulnerability(BaseModel):
    package: str
    version: str
    severity: str  # critical, high, moderate, low
    description: str
    fix_version: Optional[str] = None


class DependencyScanResult(BaseModel):
    vulnerabilities: List[Vulnerability] = Field(default_factory=list)
    total_deps: int = 0
    outdated_count: int = 0
    scan_tool: str = "none"


class PreCommitResult(BaseModel):
    blocked: bool
    reasons: List[str] = Field(default_factory=list)
    secrets_detected: List[SecretMatch] = Field(default_factory=list)


# ─── Secret Scanning Rules ───────────────────────────────────────────────────

SECRET_PATTERNS = [
    {
        "type": "AWS Access Key",
        "pattern": re.compile(r"\b(AKIA[0-9A-Z]{16})\b"),
        "severity": "CRITICAL"
    },
    {
        "type": "Private Key",
        "pattern": re.compile(r"-----BEGIN (?:RSA|EC|OPENSSH|DSA|PGP) PRIVATE KEY-----"),
        "severity": "CRITICAL"
    },
    {
        "type": "JSON Web Token (JWT)",
        "pattern": re.compile(r"\b(eyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,})\b"),
        "severity": "HIGH"
    },
    {
        "type": "API Key / Hardcoded Secret",
        "pattern": re.compile(
            r"""(?i)(?:api_key|secret_key|auth_token|access_token|password|credential)\s*[:=]\s*["']?([a-zA-Z0-9_\-\.\$]{12,})["']?"""
        ),
        "severity": "HIGH"
    },
    {
        "type": "Generic Secret Variable",
        "pattern": re.compile(
            r"""[a-zA-Z_]*(API_KEY|SECRET|TOKEN|PASSWORD|CREDENTIAL)[a-zA-Z_]*\s*=\s*["']?([^\s"']{8,})"""
        ),
        "severity": "HIGH"
    }
]

SKIP_DIRS = {
    ".git",
    "node_modules",
    "dist",
    "build",
    ".next",
    ".turbo",
    "venv",
    ".venv",
    "__pycache__",
    ".idea",
    ".vscode",
    "data"
}

SKIP_FILES = {
    ".env.example",
    ".env.template",
    ".env.sample",
    "package-lock.json",
    "pnpm-lock.yaml",
    "yarn.lock",
    "poetry.lock"
}

BINARY_EXTENSIONS = {
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".svg",
    ".exe", ".dll", ".so", ".dylib", ".bin", ".iso",
    ".zip", ".tar", ".gz", ".7z", ".rar",
    ".pdf", ".docx", ".xlsx",
    ".pyc", ".db", ".sqlite", ".sqlite3"
}


def redact_secret(val: str) -> str:
    """Redacts secret value, keeping at most first 2 and last 2 characters."""
    val = val.strip().strip("'\"")
    if len(val) <= 6:
        return "******"
    return f"{val[:2]}****{val[-2:]}"


class SecurityScanner:
    """
    Performs static security analysis:
    - Secret scanning across project files and git pre-commit hooks
    - Dependency vulnerability scanning via npm audit / pip-audit
    - Hygiene checks for .env and .gitignore
    """

    def is_binary_file(self, filepath: Path) -> bool:
        if filepath.suffix.lower() in BINARY_EXTENSIONS:
            return True
        try:
            with open(filepath, "rb") as f:
                chunk = f.read(1024)
                if b"\0" in chunk:
                    return True
        except Exception:
            return True
        return False

    def scan_file_for_secrets(self, filepath: Path, base_dir: Path) -> List[SecretMatch]:
        """Scans a single file against secret patterns."""
        matches: List[SecretMatch] = []
        if not filepath.is_file() or self.is_binary_file(filepath):
            return matches

        # Check skip file names
        if filepath.name.lower() in SKIP_FILES:
            return matches

        try:
            rel_path = filepath.relative_to(base_dir).as_posix()
        except Exception:
            rel_path = str(filepath)

        try:
            with open(filepath, "r", encoding="utf-8", errors="replace") as f:
                lines = f.readlines()

            for line_idx, line in enumerate(lines, start=1):
                stripped = line.strip()
                line_lower = line.lower()
                if (stripped.startswith(("#", "//", "/*", "*", ";")) and ("example" in line_lower or "placeholder" in line_lower)) or "your_api_key_here" in line_lower:
                    continue

                for rule in SECRET_PATTERNS:
                    found = rule["pattern"].search(line)
                    if found:
                        secret_raw = found.group(0)
                        preview = redact_secret(secret_raw)

                        matches.append(SecretMatch(
                            file_path=rel_path,
                            line_number=line_idx,
                            secret_type=rule["type"],
                            redacted_preview=f"Line {line_idx}: {preview}",
                            severity=rule["severity"]
                        ))
                        # Limit to one match per line
                        break
        except Exception as ex:
            logger.warning(f"Error scanning file {filepath}: {ex}")

        return matches

    def scan_for_secrets(self, project_path: str) -> SecretScanResult:
        """
        Scans all source files in the project for secrets and checks .env hygiene.
        """
        base_dir = Path(project_path).resolve()
        if not base_dir.exists() or not base_dir.is_dir():
            return SecretScanResult(
                secrets_found=[],
                files_scanned=0,
                has_env_example_but_no_env=False,
                env_in_gitignore=True
            )

        all_matches: List[SecretMatch] = []
        files_scanned = 0

        # Hygiene checks
        has_env_example = (base_dir / ".env.example").exists() or (base_dir / ".env.template").exists()
        has_env = (base_dir / ".env").exists()
        has_env_example_but_no_env = has_env_example and not has_env

        env_in_gitignore = True
        gitignore_path = base_dir / ".gitignore"
        if gitignore_path.exists():
            try:
                git_text = gitignore_path.read_text(encoding="utf-8", errors="replace")
                env_in_gitignore = bool(re.search(r"^\s*\.env(\s|$)", git_text, re.MULTILINE))
            except Exception:
                env_in_gitignore = False
        else:
            # If no .gitignore exists but .env does, warn
            if has_env:
                env_in_gitignore = False

        # Traverse directory
        for root, dirs, files in os.walk(base_dir):
            # Prune skipped directories
            dirs[:] = [d for d in dirs if d not in SKIP_DIRS and not d.startswith(".")]

            for file in files:
                fpath = Path(root) / file
                if fpath.name.lower() in SKIP_FILES:
                    continue

                matches = self.scan_file_for_secrets(fpath, base_dir)
                if matches:
                    all_matches.extend(matches)
                files_scanned += 1

        return SecretScanResult(
            secrets_found=all_matches,
            files_scanned=files_scanned,
            has_env_example_but_no_env=has_env_example_but_no_env,
            env_in_gitignore=env_in_gitignore
        )

    async def scan_dependencies(self, project_path: str) -> DependencyScanResult:
        """
        Audits project dependencies using npm audit or pip-audit / safety.
        """
        base_dir = Path(project_path).resolve()
        if not base_dir.exists():
            return DependencyScanResult(vulnerabilities=[], total_deps=0, outdated_count=0, scan_tool="none")

        # 1. NPM Project Audit
        pkg_json = base_dir / "package.json"
        if pkg_json.exists():
            return await self._scan_npm_dependencies(base_dir)

        # 2. Python Project Audit
        req_txt = base_dir / "requirements.txt"
        pipfile = base_dir / "Pipfile"
        pyproject = base_dir / "pyproject.toml"
        if req_txt.exists() or pipfile.exists() or pyproject.exists():
            return await self._scan_python_dependencies(base_dir)

        return DependencyScanResult(
            vulnerabilities=[],
            total_deps=0,
            outdated_count=0,
            scan_tool="none (no package manifest detected)"
        )

    async def _scan_npm_dependencies(self, base_dir: Path) -> DependencyScanResult:
        """Runs npm audit --json on a Node/JS project."""
        vulnerabilities: List[Vulnerability] = []
        total_deps = 0

        # Read package.json to estimate total dependencies
        try:
            pkg_data = json.loads((base_dir / "package.json").read_text(encoding="utf-8"))
            deps = pkg_data.get("dependencies", {})
            dev_deps = pkg_data.get("devDependencies", {})
            total_deps = len(deps) + len(dev_deps)
        except Exception:
            pass

        npm_executable = shutil.which("npm") or shutil.which("npm.cmd")
        if not npm_executable:
            return DependencyScanResult(
                vulnerabilities=[],
                total_deps=total_deps,
                outdated_count=0,
                scan_tool="npm (not found in PATH)"
            )

        try:
            proc = await asyncio.create_subprocess_exec(
                npm_executable,
                "audit",
                "--json",
                cwd=str(base_dir),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout_bytes, _ = await asyncio.wait_for(proc.communicate(), timeout=25.0)
            stdout_text = stdout_bytes.decode("utf-8", errors="replace")

            if stdout_text.strip():
                try:
                    audit_json = json.loads(stdout_text)
                    vuln_dict = audit_json.get("vulnerabilities", {})
                    for pkg_name, vuln_info in vuln_dict.items():
                        severity = vuln_info.get("severity", "moderate")
                        via_list = vuln_info.get("via", [])
                        desc = ""
                        if isinstance(via_list, list) and via_list:
                            if isinstance(via_list[0], dict):
                                desc = via_list[0].get("title", "")
                            elif isinstance(via_list[0], str):
                                desc = via_list[0]
                        if not desc:
                            desc = f"Vulnerability detected in {pkg_name}"

                        fix_avail = vuln_info.get("fixAvailable")
                        fix_ver = None
                        if isinstance(fix_avail, dict):
                            fix_ver = fix_avail.get("version")
                        elif fix_avail is True:
                            fix_ver = "latest"

                        installed_range = vuln_info.get("range", "unknown")

                        vulnerabilities.append(Vulnerability(
                            package=pkg_name,
                            version=installed_range,
                            severity=severity,
                            description=desc,
                            fix_version=fix_ver
                        ))
                except Exception as parse_err:
                    logger.warning(f"Failed to parse npm audit json: {parse_err}")

        except asyncio.TimeoutError:
            logger.warning("npm audit timed out after 25s")
        except Exception as ex:
            logger.warning(f"Error running npm audit: {ex}")

        return DependencyScanResult(
            vulnerabilities=vulnerabilities,
            total_deps=total_deps,
            outdated_count=len(vulnerabilities),
            scan_tool="npm audit"
        )

    async def _scan_python_dependencies(self, base_dir: Path) -> DependencyScanResult:
        """Runs pip-audit or checks requirements against known vulnerable patterns."""
        vulnerabilities: List[Vulnerability] = []
        total_deps = 0

        req_file = base_dir / "requirements.txt"
        if req_file.exists():
            try:
                for line in req_file.read_text(encoding="utf-8").splitlines():
                    cleaned = line.strip()
                    if cleaned and not cleaned.startswith("#"):
                        total_deps += 1
            except Exception:
                pass

        pip_audit = shutil.which("pip-audit") or shutil.which("pip-audit.exe")
        if pip_audit and req_file.exists():
            try:
                proc = await asyncio.create_subprocess_exec(
                    pip_audit,
                    "-r",
                    str(req_file),
                    "-f",
                    "json",
                    cwd=str(base_dir),
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE
                )
                stdout_bytes, _ = await asyncio.wait_for(proc.communicate(), timeout=20.0)
                audit_data = json.loads(stdout_bytes.decode("utf-8", errors="replace"))

                for item in audit_data.get("dependencies", []):
                    pkg_name = item.get("name")
                    ver = item.get("version")
                    for v in item.get("vulns", []):
                        vulnerabilities.append(Vulnerability(
                            package=pkg_name,
                            version=ver,
                            severity="high",
                            description=v.get("description", v.get("id", "Vulnerability")),
                            fix_version=v.get("fix_versions", [None])[0] if v.get("fix_versions") else None
                        ))

                return DependencyScanResult(
                    vulnerabilities=vulnerabilities,
                    total_deps=total_deps,
                    outdated_count=len(vulnerabilities),
                    scan_tool="pip-audit"
                )
            except Exception as e:
                logger.warning(f"pip-audit failed: {e}")

        # Static sanity check for legacy/critical outdated python packages
        known_issues = {
            "urllib3<1.26.18": ("urllib3", "moderate", "Cookie leak on redirect", "1.26.18"),
            "requests<2.31.0": ("requests", "high", "Leaked Proxy-Authorization headers", "2.31.0"),
            "jinja2<3.1.3": ("jinja2", "moderate", "HTML attribute injection vulnerability", "3.1.3"),
            "werkzeug<3.0.1": ("werkzeug", "high", "Denial of Service via multipart parsing", "3.0.1"),
        }

        if req_file.exists():
            try:
                content = req_file.read_text(encoding="utf-8")
                for rule, (pkg, sev, desc, fix) in known_issues.items():
                    target_pkg = pkg.lower()
                    for line in content.splitlines():
                        line_clean = line.strip().lower()
                        if line_clean.startswith(f"{target_pkg}==") or line_clean.startswith(f"{target_pkg}<"):
                            ver_val = line_clean.split("=")[-1]
                            vulnerabilities.append(Vulnerability(
                                package=pkg,
                                version=ver_val,
                                severity=sev,
                                description=desc,
                                fix_version=fix
                            ))
            except Exception:
                pass

        return DependencyScanResult(
            vulnerabilities=vulnerabilities,
            total_deps=total_deps,
            outdated_count=len(vulnerabilities),
            scan_tool="pip requirements inspection"
        )

    def scan_before_commit(self, project_path: str, staged_files: List[str]) -> PreCommitResult:
        """
        Pre-commit security gate: scans only staged files for secrets.
        Blocks checkpoint if unredacted secrets are present.
        """
        base_dir = Path(project_path).resolve()
        detected_secrets: List[SecretMatch] = []
        reasons: List[str] = []

        for rel_file in staged_files:
            target_path = base_dir / rel_file
            if not target_path.exists() or not target_path.is_file():
                continue

            matches = self.scan_file_for_secrets(target_path, base_dir)
            if matches:
                detected_secrets.extend(matches)
                for m in matches:
                    reasons.append(
                        f"Secret detected in {m.file_path}:{m.line_number} ({m.secret_type})"
                    )

        blocked = len(detected_secrets) > 0
        return PreCommitResult(
            blocked=blocked,
            reasons=reasons,
            secrets_detected=detected_secrets
        )


# Global singleton instance
security_scanner = SecurityScanner()
