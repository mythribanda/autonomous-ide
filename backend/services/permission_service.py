import os
import re
from pathlib import Path
from typing import List, Optional, Set, Tuple

from backend.schemas import (
    PermissionLevel,
    AgentPermissionConfig,
    PermissionResult,
    CommandClassification,
    SecretMatch,
)

# Regex patterns for dangerous commands
DANGEROUS_COMMAND_PATTERNS = [
    (re.compile(r"\brm\s+-(?:[a-zA-Z]*r[a-zA-Z]*f|[a-zA-Z]*f[a-zA-Z]*r)\b", re.IGNORECASE), "Recursive forceful file deletion (rm -rf)"),
    (re.compile(r"\brmdir\s+/[sq]\b", re.IGNORECASE), "Recursive directory deletion (rmdir /s)"),
    (re.compile(r"\bDROP\s+(?:TABLE|DATABASE|SCHEMA)\b", re.IGNORECASE), "Database drop table/database execution"),
    (re.compile(r"\bformat\s+[a-zA-Z]:", re.IGNORECASE), "Disk formatting command"),
    (re.compile(r"\bdd\s+if=", re.IGNORECASE), "Low-level raw device write (dd if=)"),
    (re.compile(r":\(\)\s*\{\s*:\|:&\s*\};:", re.IGNORECASE), "Bash fork bomb pattern"),
    (re.compile(r"\b(?:mkfs|fdisk|parted)\b", re.IGNORECASE), "Filesystem partition or creation tool"),
    (re.compile(r">\s*/dev/sd[a-z]", re.IGNORECASE), "Direct device overwrite"),
    (re.compile(r"\bshutdown\b|\breboot\b|\binit\s+[06]\b", re.IGNORECASE), "System shutdown or reboot"),
]

# Regex patterns for test commands
TEST_COMMAND_PATTERNS = [
    re.compile(r"\bpytest\b", re.IGNORECASE),
    re.compile(r"\bnpm\s+(?:run\s+)?test\b", re.IGNORECASE),
    re.compile(r"\byarn\s+test\b", re.IGNORECASE),
    re.compile(r"\bpnpm\s+test\b", re.IGNORECASE),
    re.compile(r"\bvitest\b", re.IGNORECASE),
    re.compile(r"\bjest\b", re.IGNORECASE),
    re.compile(r"\bgo\s+test\b", re.IGNORECASE),
    re.compile(r"\bcargo\s+test\b", re.IGNORECASE),
    re.compile(r"\bpython\s+-m\s+unittest\b", re.IGNORECASE),
]

# Regex patterns for build commands
BUILD_COMMAND_PATTERNS = [
    re.compile(r"\bnpm\s+run\s+build\b", re.IGNORECASE),
    re.compile(r"\byarn\s+build\b", re.IGNORECASE),
    re.compile(r"\bpnpm\s+build\b", re.IGNORECASE),
    re.compile(r"\btsc\b", re.IGNORECASE),
    re.compile(r"\bcargo\s+build\b", re.IGNORECASE),
    re.compile(r"\bgo\s+build\b", re.IGNORECASE),
    re.compile(r"\bmvn\s+package\b", re.IGNORECASE),
    re.compile(r"\bgradle\s+build\b", re.IGNORECASE),
    re.compile(r"\bmake\s+build\b", re.IGNORECASE),
    re.compile(r"\bvite\s+build\b", re.IGNORECASE),
    re.compile(r"\bwebpack\b", re.IGNORECASE),
    re.compile(r"\bdocker\s+build\b", re.IGNORECASE),
    re.compile(r"\bdocker\s+compose\b", re.IGNORECASE),
    re.compile(r"\bdocker-compose\b", re.IGNORECASE),
]

# Sensitive file patterns and names
SENSITIVE_FILENAMES = {
    "credentials.json",
    "id_rsa",
    "id_rsa.pub",
    "id_ed25519",
    "id_ed25519.pub",
    "id_dsa",
    "id_ecdsa",
    "authorized_keys",
    "known_hosts",
    ".htpasswd",
    ".netrc",
    "service_account.json",
    "service-account.json",
    "secrets.json",
    "secrets.yaml",
    "secrets.yml",
}

SENSITIVE_PATTERNS = [
    re.compile(r"^\.env(?:\..+)?$", re.IGNORECASE),
    re.compile(r".*\.(?:pem|key|pkcs12|pfx|p12|kdbx)$", re.IGNORECASE),
    re.compile(r".*(?:credential|secret|password|private[_-]?key).*", re.IGNORECASE),
]

# Secret match detection patterns within file contents
SECRET_DETECTION_PATTERNS = [
    ("AWS Access Key", re.compile(r"""(?:AWS_ACCESS_KEY_ID|aws_access_key_id|AWS_ACCESS_KEY)?\s*[:=]?\s*['"]?(AKIA[0-9A-Z]{16})['"]?"""), "AKIA..."),
    ("Stripe Secret Key", re.compile(r"""(?:STRIPE_SK|STRIPE_SECRET|stripe_secret_key|stripe_sk)?\s*[:=]?\s*['"]?(sk_live_[0-9a-zA-Z]{24,})['"]?"""), "sk_live_..."),
    ("API Key", re.compile(r"""(?:API_KEY|apiKey|api_key|APIKEY)\s*[:=]\s*['"]?([a-zA-Z0-9_\-]{16,})['"]?"""), "API_KEY=..."),
    ("Secret / Token", re.compile(r"""(?:SECRET|TOKEN|secret_key|SECRET_KEY|auth_token|AUTH_TOKEN)\s*[:=]\s*['"]?([a-zA-Z0-9_\-]{16,})['"]?"""), "SECRET=..."),
    ("Password", re.compile(r"""(?:PASSWORD|passwd|db_password|DB_PASSWORD|ADMIN_PASSWORD|password)\s*[:=]\s*['"]?([^\s'"\n]{6,})['"]?"""), "PASSWORD=..."),
    ("Private Key Header", re.compile(r"(-----BEGIN [A-Z ]*PRIVATE KEY-----)"), "-----BEGIN PRIVATE KEY-----"),
]


class PermissionService:
    """
    Security policy engine evaluating autonomous agent permissions,
    workspace isolation, command safety classification, and credential protection.
    """

    def scan_for_sensitive_paths(self, file_path: str) -> bool:
        """
        Returns True if file_path looks like a sensitive file:
        .env, .env.*, id_rsa, id_ed25519, *.pem, *.key, credentials.json, etc.
        """
        if not file_path:
            return False

        path_obj = Path(file_path)
        name = path_obj.name.lower()

        # Check exact sensitive filename
        if name in SENSITIVE_FILENAMES:
            return True

        # Check regex patterns
        for pattern in SENSITIVE_PATTERNS:
            if pattern.search(name):
                return True

        # Check path components
        parts = [p.lower() for p in path_obj.parts]
        for part in parts:
            if part in (".ssh", ".gnupg", ".aws", ".kube"):
                return True
            if "secret" in part or "credential" in part:
                return True

        return False

    def classify_command(self, command: str) -> CommandClassification:
        """
        Classifies shell commands into test, build, dangerous, or standard execution.
        """
        cmd_clean = command.strip()

        # 1. Dangerous command check
        for pattern, desc in DANGEROUS_COMMAND_PATTERNS:
            if pattern.search(cmd_clean):
                return CommandClassification(
                    is_test=False,
                    is_build=False,
                    is_dangerous=True,
                    required_permission=PermissionLevel.COMMAND_DANGEROUS,
                    risk_description=f"Dangerous command pattern detected: {desc}"
                )

        # 2. Test command check
        for pattern in TEST_COMMAND_PATTERNS:
            if pattern.search(cmd_clean):
                return CommandClassification(
                    is_test=True,
                    is_build=False,
                    is_dangerous=False,
                    required_permission=PermissionLevel.COMMAND_RUN,
                    risk_description="Safe automated test execution suite"
                )

        # 3. Build command check
        for pattern in BUILD_COMMAND_PATTERNS:
            if pattern.search(cmd_clean):
                return CommandClassification(
                    is_test=False,
                    is_build=True,
                    is_dangerous=False,
                    required_permission=PermissionLevel.COMMAND_RUN,
                    risk_description="Safe build/compilation task"
                )

        # 4. Standard command
        return CommandClassification(
            is_test=False,
            is_build=False,
            is_dangerous=False,
            required_permission=PermissionLevel.COMMAND_RUN,
            risk_description="Standard command execution"
        )

    def detect_secrets(self, content: str) -> List[SecretMatch]:
        """
        Scans string content for exposed credentials, API keys, tokens, or private keys.
        """
        if not content:
            return []

        matches: List[SecretMatch] = []
        lines = content.splitlines()

        for line_idx, line in enumerate(lines, start=1):
            for sec_type, pattern, preview_fmt in SECRET_DETECTION_PATTERNS:
                m = pattern.search(line)
                if m:
                    # Redact the matched secret value
                    matched_str = m.group(1) if m.groups() else m.group(0)
                    if len(matched_str) > 6:
                        redacted = f"{matched_str[:3]}***{matched_str[-2:]}"
                    else:
                        redacted = "***"

                    # Generate preview
                    redacted_preview = line.replace(matched_str, redacted).strip()
                    if len(redacted_preview) > 80:
                        redacted_preview = redacted_preview[:77] + "..."

                    matches.append(SecretMatch(
                        type=sec_type,
                        pattern=pattern.pattern,
                        line_number=line_idx,
                        redacted_preview=redacted_preview
                    ))

        return matches

    def check(
        self,
        action: PermissionLevel,
        target_path: Optional[str],
        config: AgentPermissionConfig,
        command: Optional[str] = None
    ) -> PermissionResult:
        """
        Validates whether an action is allowed, denied, or requires approval under config.
        """
        # 1. Check if action requires explicit approval
        if action in config.require_approval_for:
            # Still validate target_path boundaries/sensitive paths before asking for approval
            if target_path:
                norm_ws = os.path.normcase(os.path.abspath(config.workspace_path))
                if not os.path.isabs(target_path):
                    resolved_target = os.path.abspath(os.path.join(config.workspace_path, target_path))
                else:
                    resolved_target = os.path.abspath(target_path)
                norm_target = os.path.normcase(resolved_target)

                try:
                    common = os.path.commonpath([norm_ws, norm_target])
                    if common != norm_ws:
                        return PermissionResult(
                            allowed=False,
                            requires_approval=False,
                            reason="Path outside workspace boundary"
                        )
                except ValueError:
                    return PermissionResult(
                        allowed=False,
                        requires_approval=False,
                        reason="Path outside workspace boundary"
                    )

                for blocked in config.blocked_paths:
                    expanded_b = os.path.normcase(os.path.abspath(os.path.expanduser(blocked)))
                    try:
                        if os.path.commonpath([expanded_b, norm_target]) == expanded_b:
                            return PermissionResult(
                                allowed=False,
                                requires_approval=False,
                                reason="Path is blocked"
                            )
                    except ValueError:
                        continue

                if self.scan_for_sensitive_paths(target_path) or self.scan_for_sensitive_paths(resolved_target):
                    return PermissionResult(
                        allowed=False,
                        requires_approval=False,
                        reason="Sensitive file protection"
                    )

            return PermissionResult(
                allowed=True,
                requires_approval=True,
                reason=f"Action '{action.value}' requires explicit human approval"
            )

        # 2. If action not in config.allowed → denied
        if action not in config.allowed:
            return PermissionResult(
                allowed=False,
                requires_approval=False,
                reason=f"Action '{action.value}' not in allowed permissions"
            )

        # 3. Target path validation if provided
        if target_path:
            norm_ws = os.path.normcase(os.path.abspath(config.workspace_path))
            
            # Resolve target_path relative to workspace if relative
            if not os.path.isabs(target_path):
                resolved_target = os.path.abspath(os.path.join(config.workspace_path, target_path))
            else:
                resolved_target = os.path.abspath(target_path)
            
            norm_target = os.path.normcase(resolved_target)

            # 2b. Boundary check: must reside inside workspace_path
            try:
                common = os.path.commonpath([norm_ws, norm_target])
                if common != norm_ws:
                    return PermissionResult(
                        allowed=False,
                        requires_approval=False,
                        reason="Path outside workspace boundary"
                    )
            except ValueError:
                # Different drives on Windows
                return PermissionResult(
                    allowed=False,
                    requires_approval=False,
                    reason="Path outside workspace boundary"
                )

            # 2c. Check blocked paths
            for blocked in config.blocked_paths:
                expanded_b = os.path.normcase(os.path.abspath(os.path.expanduser(blocked)))
                try:
                    if os.path.commonpath([expanded_b, norm_target]) == expanded_b:
                        return PermissionResult(
                            allowed=False,
                            requires_approval=False,
                            reason="Path is blocked"
                        )
                except ValueError:
                    continue

            # 2d. Sensitive file protection (.env, secret, credential)
            if self.scan_for_sensitive_paths(target_path) or self.scan_for_sensitive_paths(resolved_target):
                return PermissionResult(
                    allowed=False,
                    requires_approval=False,
                    reason="Sensitive file protection"
                )

        # 4. Special case: auto-approval for test/build commands
        if action == PermissionLevel.COMMAND_RUN and command:
            classification = self.classify_command(command)
            if classification.is_dangerous:
                # Upgrade action check to COMMAND_DANGEROUS
                return self.check(
                    action=PermissionLevel.COMMAND_DANGEROUS,
                    target_path=target_path,
                    config=config,
                    command=None
                )

            if classification.is_test and config.auto_approve_test_commands:
                return PermissionResult(
                    allowed=True,
                    requires_approval=False,
                    reason="Auto-approved test command"
                )

            if classification.is_build and config.auto_approve_build_commands:
                return PermissionResult(
                    allowed=True,
                    requires_approval=False,
                    reason="Auto-approved build command"
                )

        # Action is allowed without approval
        return PermissionResult(
            allowed=True,
            requires_approval=False,
            reason="Action permitted by current policy"
        )


permission_service = PermissionService()
