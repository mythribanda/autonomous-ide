import json
from typing import Optional
from backend.services.evaluation_service import evaluation_service, EvaluationMetrics


class ReportGenerator:
    """
    Academic Export Generator:
    Produces publication-quality LaTeX tables, markdown comparison matrices,
    and comprehensive evaluation reports for final B.Tech thesis defense and research dissemination.
    """

    async def generate_latex_tables(self, project_id: Optional[str] = None) -> str:
        """
        Generates clean, camera-ready LaTeX tabular code for evaluation metrics.
        """
        metrics = await evaluation_service.compute_metrics(project_id or "default")

        latex = f"""% ==============================================================================
% TABLE 1: Autonomous Developer Workspace Empirical Evaluation
% ==============================================================================
\\begin{{table}}[htbp]
\\centering
\\caption{{Performance and Convergence Metrics of Autonomous Developer Workspace}}
\\label{{tab:autonomous_eval_metrics}}
\\begin{{tabular}}{{llr}}
\\hline
\\textbf{{Category}} & \\textbf{{Metric}} & \\textbf{{Observed Value}} \\\\
\\hline
Execution Efficiency & Task Completion Rate & {metrics.task_completion_rate:.1f}\\% \\\\
                     & Mean Execution Latency & {metrics.avg_execution_time_seconds:.2f} s \\\\
                     & Median Execution Latency & {metrics.median_execution_time_seconds:.2f} s \\\\
                     & Avg. Files Modified / Task & {metrics.avg_files_changed_per_task:.1f} \\\\
\\hline
Reliability & Test Success Rate & {metrics.test_success_rate:.1f}\\% \\\\
            & Verification Pipeline Pass Rate & {metrics.verification_success_rate:.1f}\\% \\\\
            & Fault Self-Recovery Rate & {metrics.recovery_rate:.1f}\\% \\\\
            & Avg. Recovery Iterations & {metrics.avg_recovery_iterations:.2f} \\\\
\\hline
Human Oversight & Human Intervention Rate & {metrics.human_intervention_rate:.1f}\\% \\\\
                & Total Human Approval Triggers & {metrics.total_human_interventions} \\\\
\\hline
AI Inference & Average LLM Inference Latency & {metrics.model_avg_latency_ms:.1f} ms \\\\
             & Total Evaluated Tasks & {metrics.total_tasks} \\\\
\\hline
\\end{{tabular}}
\\end{{table}}

% ==============================================================================
% TABLE 2: Autonomy Mode Comparative Latency and Reliability
% ==============================================================================
\\begin{{table}}[htbp]
\\centering
\\caption{{Supervisory Autonomy Operating Modes Comparison}}
\\label{{tab:autonomy_modes}}
\\begin{{tabular}}{{lrrrr}}
\\hline
\\textbf{{Mode}} & \\textbf{{Tasks}} & \\textbf{{Completion Rate}} & \\textbf{{Mean Latency (s)}} & \\textbf{{Supervisory Friction}} \\\\
\\hline
"""
        for mode, mdata in metrics.by_mode.items():
            fric = "Low" if mode == "Guided" else "High" if mode == "Assist" else "Zero"
            latex += f"{mode} & {mdata.task_count} & {mdata.completion_rate:.1f}\\% & {mdata.avg_time:.1f} & {fric} \\\\\n"

        latex += """\\hline
\\end{tabular}
\\end{table}
"""
        return latex.strip()

    def generate_comparison_table(self, project_id: Optional[str] = None) -> str:
        """
        Generates Markdown comparison matrix between this work and existing AI coding assistants
        (GitHub Copilot, Cursor, Devin, Claude Engineer).
        """
        return """# Architectural Comparison Matrix: Autonomous Developer Workspace vs. State-of-the-Art

| Capability / Dimension | This Work (Autonomous IDE) | GitHub Copilot | Cursor IDE | Devin / Cognition |
| :--- | :---: | :---: | :---: | :---: |
| **Fully Autonomous Execution Loop** | **✓ (Closed-Loop)** | ✗ (Inline Completion) | ✗ (Prompt-in-Editor) | ✓ (Cloud Agent) |
| **Local Private Execution (Ollama)** | **✓ (100% Local Air-Gapped)** | ✗ (Cloud Only) | ✗ (Cloud Only) | ✗ (Cloud Only) |
| **AST Symbol & Dependency Knowledge Graph** | **✓ (Tree-Sitter Incremental)** | ✗ (Heuristic Context) | ✗ (Vector Embeddings) | Partial (Remote Index) |
| **Iterative Self-Healing & Bug Repair** | **✓ (Multi-Turn Reflection)** | ✗ | ✗ (Manual Retries) | ✓ |
| **Self-Healing Pattern Cache (Memory)** | **✓ (0.8 Similarity Match)** | ✗ | ✗ | ✗ |
| **Granular Human Permission Gating** | **✓ (Three Autonomy Modes)** | ✗ (N/A) | Partial (Terminal prompt) | ✗ (All or nothing) |
| **Headless Browser UI Verification** | **✓ (Playwright Chromium)** | ✗ | ✗ | ✓ |
| **Deterministic Code Checkpointing (Git)** | **✓ (Automated Rollback)** | ✗ | ✗ | Partial |
| **Multi-Cloud Deployment Orchestration** | **✓ (Vercel / Fly / Railway)** | ✗ | ✗ | ✗ |
| **Cost / Zero API Token Dependency** | **✓ ($0 Operational Cost)** | Subscription ($10-19/mo) | Subscription ($20/mo) | Enterprise ($500+/mo) |
"""


report_generator = ReportGenerator()
