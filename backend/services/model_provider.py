import asyncio
import logging
import os
import time
from abc import ABC, abstractmethod
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field
import ollama

from backend.config import settings

logger = logging.getLogger("autonomous_dev.model_provider")


class ModelResponse(BaseModel):
    content: str
    tokens_used: int = 0
    latency_ms: float = 0.0
    model: str
    raw_response: Dict[str, Any] = Field(default_factory=dict)


class ModelHealth(BaseModel):
    connected: bool
    model_loaded: bool = False
    latency_ms: Optional[float] = None
    error: Optional[str] = None


class ModelProvider(ABC):
    """Abstract base class for LLM providers."""

    name: str
    model_id: str

    @abstractmethod
    async def complete(
        self,
        system: str,
        user: str,
        max_tokens: int = 1000,
        temperature: float = 0.2
    ) -> ModelResponse:
        """Generates a text completion given system and user messages."""
        pass

    @abstractmethod
    async def health(self) -> ModelHealth:
        """Checks provider connectivity and model availability."""
        pass


class OllamaProvider(ModelProvider):
    """
    Ollama model provider utilizing the official async ollama client.
    Supports timeout retries and rolling latency calculation.
    """

    def __init__(
        self,
        model_id: Optional[str] = None,
        base_url: Optional[str] = None,
        name: str = "ollama"
    ):
        self.name = name
        self.model_id = model_id or settings.ollama_model or "llama3.2:latest"
        self.base_url = (base_url or settings.ollama_url).rstrip("/")
        self.client = ollama.AsyncClient(host=self.base_url)
        self._latencies: List[float] = []

    async def health(self) -> ModelHealth:
        start_time = time.perf_counter()
        try:
            res = await asyncio.wait_for(self.client.list(), timeout=5.0)
            elapsed_ms = (time.perf_counter() - start_time) * 1000.0

            # res can be a dict or a ListResponse object with .models
            models_list = []
            if hasattr(res, "models"):
                models_list = [getattr(m, "model", "") or getattr(m, "name", "") for m in res.models]
            elif isinstance(res, dict):
                models_list = [m.get("name", "") or m.get("model", "") for m in res.get("models", [])]

            # Match model name directly or base prefix (e.g., 'llama3.1:8b' vs 'llama3.1:8b-instruct')
            target = self.model_id.lower()
            model_found = any(target in m.lower() for m in models_list) or len(models_list) > 0

            return ModelHealth(
                connected=True,
                model_loaded=model_found,
                latency_ms=round(elapsed_ms, 2),
                error=None
            )
        except Exception as ex:
            elapsed_ms = (time.perf_counter() - start_time) * 1000.0
            return ModelHealth(
                connected=False,
                model_loaded=False,
                latency_ms=round(elapsed_ms, 2),
                error=str(ex)
            )

    async def complete(
        self,
        system: str,
        user: str,
        max_tokens: int = 1000,
        temperature: float = 0.2
    ) -> ModelResponse:
        max_retries = 2
        last_exception = None

        for attempt in range(1, max_retries + 1):
            start_time = time.perf_counter()
            try:
                # 30 second timeout per call attempt
                raw = await asyncio.wait_for(
                    self.client.chat(
                        model=self.model_id,
                        messages=[
                            {"role": "system", "content": system},
                            {"role": "user", "content": user}
                        ],
                        options={
                            "temperature": temperature,
                            "num_predict": max_tokens
                        }
                    ),
                    timeout=30.0
                )

                latency_ms = (time.perf_counter() - start_time) * 1000.0
                self._latencies.append(latency_ms)
                if len(self._latencies) > 100:
                    self._latencies.pop(0)

                # Extract content and token metadata
                content = ""
                raw_dict: Dict[str, Any] = {}
                if hasattr(raw, "message") and hasattr(raw.message, "content"):
                    content = raw.message.content or ""
                elif isinstance(raw, dict):
                    msg = raw.get("message", {})
                    content = msg.get("content", "") if isinstance(msg, dict) else ""
                    raw_dict = raw

                # Token count estimate
                tokens_used = getattr(raw, "eval_count", None) or getattr(raw, "prompt_eval_count", None) or 0
                if tokens_used == 0 and content:
                    tokens_used = max(1, len(content) // 4)

                return ModelResponse(
                    content=content,
                    tokens_used=tokens_used,
                    latency_ms=round(latency_ms, 2),
                    model=self.model_id,
                    raw_response=raw_dict
                )

            except asyncio.TimeoutError as tex:
                last_exception = tex
                logger.warning(f"OllamaProvider timeout on attempt {attempt}/{max_retries} for model {self.model_id}")
                if attempt < max_retries:
                    await asyncio.sleep(0.5)
            except Exception as ex:
                last_exception = ex
                logger.warning(f"OllamaProvider error on attempt {attempt}/{max_retries}: {ex}")
                if attempt < max_retries:
                    await asyncio.sleep(0.5)

        raise RuntimeError(f"Ollama completion failed after {max_retries} attempts: {last_exception}")


class AnthropicProvider(ModelProvider):
    """
    Anthropic Claude model provider stub (scheduled for Phase 3).
    """

    def __init__(self, model_id: str = "claude-3-5-sonnet-20241022"):
        self.name = "anthropic"
        self.model_id = model_id
        self.api_key = os.getenv("ANTHROPIC_API_KEY", "")

    async def complete(
        self,
        system: str,
        user: str,
        max_tokens: int = 1000,
        temperature: float = 0.2
    ) -> ModelResponse:
        raise NotImplementedError(
            "AnthropicProvider is planned for Phase 3. Currently utilizing local Ollama provider."
        )

    async def health(self) -> ModelHealth:
        if not self.api_key:
            return ModelHealth(connected=False, model_loaded=False, error="ANTHROPIC_API_KEY not configured")
        return ModelHealth(connected=True, model_loaded=True, error=None)


class ModelRouter:
    """
    Routes inference requests to the designated ModelProvider based on task type/role.
    Tracks a rolling window of inference latencies (last 100 calls) and calculates percentiles.
    """

    DEFAULT_CONFIG = {
        "planning_model": "llama3.1:8b",
        "coding_model": "codellama:13b",
        "diagnosis_model": "llama3.1:8b",
        "summarization_model": "llama3.1:8b",
        "ollama_base_url": "http://localhost:11434",
        "temperature": 0.2,
        "max_tokens": 2000
    }

    def __init__(self):
        # Default single Ollama provider
        base_provider = OllamaProvider()
        self.providers: Dict[str, ModelProvider] = {
            "planning": base_provider,
            "coding": base_provider,
            "diagnosis": base_provider,
            "summarization": base_provider,
            "default": base_provider
        }
        # In-memory rolling list of latencies in milliseconds (last 100 calls)
        self.latency_history: List[float] = []

    def configure_providers(
        self,
        planning_model: Optional[str] = None,
        coding_model: Optional[str] = None,
        diagnosis_model: Optional[str] = None,
        summarization_model: Optional[str] = None,
        ollama_base_url: Optional[str] = None
    ):
        """Reconfigures providers per role."""
        base_url = ollama_base_url or settings.ollama_url
        if planning_model:
            self.providers["planning"] = OllamaProvider(model_id=planning_model, base_url=base_url)
        if coding_model:
            self.providers["coding"] = OllamaProvider(model_id=coding_model, base_url=base_url)
        if diagnosis_model:
            self.providers["diagnosis"] = OllamaProvider(model_id=diagnosis_model, base_url=base_url)
        if summarization_model:
            self.providers["summarization"] = OllamaProvider(model_id=summarization_model, base_url=base_url)

    def record_latency(self, latency_ms: float):
        """Appends latency to rolling window of 100 entries."""
        self.latency_history.append(latency_ms)
        if len(self.latency_history) > 100:
            self.latency_history.pop(0)

    def get_latency_stats(self) -> Dict[str, Any]:
        """Calculates avg_ms, p50_ms, p95_ms, p99_ms over rolling history."""
        if not self.latency_history:
            return {
                "avg_ms": 0.0,
                "p50_ms": 0.0,
                "p95_ms": 0.0,
                "p99_ms": 0.0,
                "count": 0
            }

        sorted_latencies = sorted(self.latency_history)
        count = len(sorted_latencies)

        def percentile(p: float) -> float:
            k = (count - 1) * p
            f = int(k)
            c = min(f + 1, count - 1)
            d0 = sorted_latencies[f] * (c - k)
            d1 = sorted_latencies[c] * (k - f)
            return round(d0 + d1, 2)

        avg_ms = round(sum(sorted_latencies) / count, 2)
        p50_ms = percentile(0.50)
        p95_ms = percentile(0.95)
        p99_ms = percentile(0.99)

        return {
            "avg_ms": avg_ms,
            "p50_ms": p50_ms,
            "p95_ms": p95_ms,
            "p99_ms": p99_ms,
            "count": count
        }

    def _get_provider_for_role(self, role: str, project_config: Optional[Dict[str, Any]] = None) -> ModelProvider:
        """Resolves the appropriate provider based on role and optional project_config."""
        if project_config:
            base_url = project_config.get("ollama_base_url") or settings.ollama_url
            model_key = f"{role.lower()}_model"
            target_model = project_config.get(model_key)
            if target_model:
                return OllamaProvider(model_id=target_model, base_url=base_url)

        return self.providers.get(role.lower(), self.providers["default"])

    async def complete(
        self,
        role: str,
        system: str,
        user: str,
        max_tokens: int = 1000,
        temperature: float = 0.2,
        project_config: Optional[Dict[str, Any]] = None
    ) -> ModelResponse:
        """
        Routes the completion to the provider corresponding to the role,
        records latency in the rolling buffer, and returns the response.
        """
        # Read temperature or max_tokens overrides from project_config if supplied
        if project_config:
            if "temperature" in project_config and project_config["temperature"] is not None:
                temperature = float(project_config["temperature"])
            if "max_tokens" in project_config and project_config["max_tokens"] is not None:
                max_tokens = int(project_config["max_tokens"])

        provider = self._get_provider_for_role(role, project_config)
        resp = await provider.complete(
            system=system,
            user=user,
            max_tokens=max_tokens,
            temperature=temperature
        )

        self.record_latency(resp.latency_ms)
        return resp

    async def health(self, role: str = "default") -> ModelHealth:
        """Queries health of provider for a specific role or default."""
        provider = self.providers.get(role, self.providers["default"])
        return await provider.health()


# Global singleton instance
model_router = ModelRouter()
