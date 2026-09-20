import time
from typing import Any, Optional, Dict, Tuple
from threading import Lock


class TTLCache:
    """
    In-memory thread-safe key-value cache with Time-To-Live (TTL).
    Stores entries as: {key: (value, expires_at_timestamp)}
    """

    def __init__(self, default_ttl_seconds: float = 300.0):
        self._cache: Dict[str, Tuple[Any, float]] = {}
        self._lock = Lock()
        self._default_ttl = default_ttl_seconds

    def get(self, key: str) -> Optional[Any]:
        """Returns cached value if present and not expired, else None."""
        with self._lock:
            entry = self._cache.get(key)
            if not entry:
                return None

            value, expires_at = entry
            if time.time() > expires_at:
                # Expired -> prune lazily
                del self._cache[key]
                return None

            return value

    def set(self, key: str, value: Any, ttl_seconds: Optional[float] = None) -> None:
        """Stores value with expiration."""
        ttl = ttl_seconds if ttl_seconds is not None else self._default_ttl
        expires_at = time.time() + ttl
        with self._lock:
            self._cache[key] = (value, expires_at)

    def invalidate(self, key: str) -> bool:
        """Removes a specific key from cache."""
        with self._lock:
            if key in self._cache:
                del self._cache[key]
                return True
            return False

    def invalidate_prefix(self, prefix: str) -> int:
        """Removes all keys matching a prefix. Returns count of invalidated keys."""
        with self._lock:
            keys_to_del = [k for k in self._cache if k.startswith(prefix)]
            for k in keys_to_del:
                del self._cache[k]
            return len(keys_to_del)

    def clear(self) -> None:
        """Clears entire cache."""
        with self._lock:
            self._cache.clear()

    # --- Domain Specific Helpers ---

    def get_knowledge_graph(self, project_id: str) -> Optional[Any]:
        return self.get(f"kg:{project_id}")

    def set_knowledge_graph(self, project_id: str, graph: Any, ttl_seconds: float = 600.0) -> None:
        self.set(f"kg:{project_id}", graph, ttl_seconds=ttl_seconds)

    def invalidate_knowledge_graph(self, project_id: str) -> bool:
        return self.invalidate(f"kg:{project_id}")

    def get_project_scan(self, project_id: str) -> Optional[Any]:
        return self.get(f"scan:{project_id}")

    def set_project_scan(self, project_id: str, scan_result: Any, ttl_seconds: float = 600.0) -> None:
        self.set(f"scan:{project_id}", scan_result, ttl_seconds=ttl_seconds)

    def invalidate_project_scan(self, project_id: str) -> bool:
        return self.invalidate(f"scan:{project_id}")

    def invalidate_project(self, project_id: str) -> None:
        """Invalidates all cached data (scans, graphs, ASTs) for a project."""
        self.invalidate_knowledge_graph(project_id)
        self.invalidate_project_scan(project_id)
        self.invalidate_prefix(f"ast:{project_id}")


# Global cache instance
cache_service = TTLCache(default_ttl_seconds=300.0)
