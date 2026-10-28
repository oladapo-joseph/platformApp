"""
In-process TTL caches (single replica in v1; move to Redis if we scale out).

Data changes at most every ~35 minutes (one crawl), so service functions cache
their results. Cached values are shared between requests: treat them as
read-only (copy a DataFrame before changing it).
"""

from collections.abc import Callable
from threading import RLock
from typing import Any, TypeVar

from cachetools import TTLCache, cached

F = TypeVar("F", bound=Callable[..., Any])

_caches: list[TTLCache[Any, Any]] = []


def ttl_cache(seconds: int, maxsize: int = 256) -> Callable[[F], F]:
    """Thread-safe TTL memoisation keyed on the (hashable) arguments."""

    def decorate(fn: F) -> F:
        cache: TTLCache[Any, Any] = TTLCache(maxsize=maxsize, ttl=seconds)
        _caches.append(cache)
        return cached(cache, lock=RLock())(fn)  # type: ignore[return-value]

    return decorate


def clear_all() -> None:
    for cache in _caches:
        cache.clear()
