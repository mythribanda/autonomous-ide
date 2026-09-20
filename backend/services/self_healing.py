import difflib
import logging
from typing import Optional, List, Dict, Any
from sqlalchemy import select, update

from backend.database import AsyncSessionLocal
from backend.models.project import HealingPattern

logger = logging.getLogger(__name__)


class SelfHealingService:
    """
    Self-Healing Patterns:
    Learns from agent failure recoveries and caches verified repair patterns.
    When recurring errors match with >= 0.8 string similarity, the known successful repair
    is prioritized before querying LLM diagnosis, minimizing model latency and token overhead.
    """

    def _normalize_error(self, error: str) -> str:
        """Extracts first 200 chars and removes volatile line numbers/timestamps."""
        clean = (error or "").strip().replace("\r", "")
        # Remove timestamps like 2026-09-20T...
        import re
        clean = re.sub(r"\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}", "", clean)
        return clean[:200]

    async def learn_from_recovery(
        self,
        error: str,
        diagnosis: str,
        repair: str,
        success: bool,
        project_id: str
    ):
        """
        Stores or updates an error recovery pattern in the database.
        """
        norm_err = self._normalize_error(error)
        if not norm_err:
            return

        try:
            async with AsyncSessionLocal() as session:
                # Check for existing matching pattern
                stmt = select(HealingPattern).where(
                    HealingPattern.project_id == project_id,
                    HealingPattern.error_pattern == norm_err
                )
                res = await session.execute(stmt)
                pattern = res.scalars().first()

                if pattern:
                    pattern.occurrence_count += 1
                    if success:
                        pattern.success_count += 1
                        pattern.successful_repair = repair
                    else:
                        pattern.failed_repair = repair
                else:
                    new_pattern = HealingPattern(
                        project_id=project_id,
                        error_pattern=norm_err,
                        diagnosis=diagnosis,
                        successful_repair=repair if success else None,
                        failed_repair=repair if not success else None,
                        occurrence_count=1,
                        success_count=1 if success else 0
                    )
                    session.add(new_pattern)

                await session.commit()
                logger.info(f"Self-healing pattern recorded for '{norm_err[:40]}...' (success={success})")
        except Exception as e:
            logger.warning(f"Could not persist self-healing pattern: {e}")

    async def find_known_pattern(
        self,
        error: str,
        project_id: str,
        similarity_threshold: float = 0.8
    ) -> Optional[HealingPattern]:
        """
        Compares incoming error against stored patterns for project using string similarity.
        Returns best match above threshold.
        """
        norm_err = self._normalize_error(error)
        if not norm_err:
            return None

        try:
            async with AsyncSessionLocal() as session:
                stmt = select(HealingPattern).where(HealingPattern.project_id == project_id)
                res = await session.execute(stmt)
                patterns = res.scalars().all()

                best_pattern: Optional[HealingPattern] = None
                best_score = 0.0

                for pat in patterns:
                    ratio = difflib.SequenceMatcher(None, norm_err, pat.error_pattern).ratio()
                    if ratio > best_score and ratio >= similarity_threshold:
                        best_score = ratio
                        best_pattern = pat

                if best_pattern:
                    logger.info(f"Found known self-healing pattern (similarity={best_score:.2f}): {best_pattern.diagnosis}")
                return best_pattern
        except Exception as e:
            logger.warning(f"Error querying self-healing patterns: {e}")
            return None


self_healing_service = SelfHealingService()
