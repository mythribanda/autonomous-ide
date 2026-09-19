from backend.services.project_scanner import ProjectScanner, scan_project_metadata
from backend.services.ai_agent import AutonomousAgent, AIAgentManager, agent_manager
from backend.services.git_service import git_service
from backend.services.ast_analyzer import ASTAnalyzer, ast_analyzer
from backend.services.knowledge_graph import KnowledgeGraph, knowledge_graph
from backend.services.impact_analyzer import ImpactAnalyzer, impact_analyzer
from backend.services.prompt_compiler import PromptCompiler, prompt_compiler
from backend.services.verification import VerificationService, verification_service
from backend.services.permission_service import PermissionService, permission_service
from backend.services.agent_tools import (
    execute_tool,
    AgentToolRegistry,
    TOOL_REGISTRY,
    TOOL_PERMISSIONS,
    read_file,
    write_file,
    list_files,
    search_in_files,
    create_file,
    delete_file,
    get_file_diff,
    run_command,
    git_status,
    git_checkpoint,
    git_diff,
    git_rollback,
    read_ast_info,
    get_relevant_files,
)

__all__ = [
    "ProjectScanner",
    "scan_project_metadata",
    "AutonomousAgent",
    "AIAgentManager",
    "agent_manager",
    "git_service",
    "ASTAnalyzer",
    "ast_analyzer",
    "KnowledgeGraph",
    "knowledge_graph",
    "ImpactAnalyzer",
    "impact_analyzer",
    "PromptCompiler",
    "prompt_compiler",
    "VerificationService",
    "verification_service",
    "PermissionService",
    "permission_service",
    "execute_tool",
    "AgentToolRegistry",
    "TOOL_REGISTRY",
    "TOOL_PERMISSIONS",
    "read_file",
    "write_file",
    "list_files",
    "search_in_files",
    "create_file",
    "delete_file",
    "get_file_diff",
    "run_command",
    "git_status",
    "git_checkpoint",
    "git_diff",
    "git_rollback",
    "read_ast_info",
    "get_relevant_files",
]
