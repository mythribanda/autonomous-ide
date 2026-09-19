import httpx
from fastapi import APIRouter
from backend.config import settings
from backend.schemas import HealthResponse, OllamaHealthResponse

router = APIRouter(tags=["health"])

@router.get("/health", response_model=HealthResponse)
async def health_check():
    return HealthResponse(status="ok", version="1.0.0")

@router.get("/health/ollama", response_model=OllamaHealthResponse)
async def ollama_health_check():
    url = f"{settings.ollama_url.rstrip('/')}/api/tags"
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                data = resp.json()
                models = [m.get("name", "") for m in data.get("models", [])]
                return OllamaHealthResponse(connected=True, models=models)
            else:
                return OllamaHealthResponse(
                    connected=False,
                    models=[],
                    error=f"Ollama returned HTTP {resp.status_code}"
                )
    except Exception as e:
        return OllamaHealthResponse(
            connected=False,
            models=[],
            error=f"Could not connect to Ollama at {settings.ollama_url}: {str(e)}"
        )


@router.get("/health/model-latency")
async def get_model_latency():
    """Returns rolling latency statistics across model invocations (last 100 calls)."""
    from backend.services.model_provider import model_router
    return model_router.get_latency_stats()


@router.get("/health/model-health")
async def get_model_health():
    """Checks the health and responsiveness of the configured model providers."""
    from backend.services.model_provider import model_router
    health_result = await model_router.health()
    stats = model_router.get_latency_stats()
    return {
        "health": health_result.model_dump(),
        "stats": stats
    }

