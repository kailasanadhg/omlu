"""
Rate Limiting Infrastructure for OMLU Guest Contributions.

ARCHITECTURE NOTE & PRODUCTION LIMITATION:
- OMLU currently relies on PostgreSQL and Cloudinary as its primary state stores;
  Redis is not currently provisioned or configured in the production environment.
- Consequently, this rate limiter utilizes an in-memory sliding window algorithm.

SINGLE-INSTANCE VS MULTI-WORKER LIMITATIONS:
- Single-instance / single-worker: Provides precise sliding window enforcement per key (client IP, guest token).
- Multi-worker / multi-instance: In multi-worker uvicorn configurations or horizontally scaled
  multi-container deployments without sticky sessions, each worker process maintains its own isolated
  in-memory sliding window. The effective global request limit across N workers scales up to N * max_requests.
- Production recommendation: For multi-instance deployments requiring strictly centralized global rate limits,
  either configure an upstream reverse proxy (e.g. Cloudflare / Nginx / Render / AWS WAF rate limiting)
  or provision a shared Redis cluster and configure REDIS_URL.
- Safe Redis Adapter: If REDIS_URL is defined and the `redis` library is installed, this module will
  seamlessly use atomic Redis sliding window operations; otherwise, it safely and transparently falls back
  to the in-memory limiter without adding mandatory external runtime dependencies.
"""

import os
import time
import logging
from collections import defaultdict
from typing import Dict, List, Optional
from fastapi import HTTPException, status, Request

logger = logging.getLogger(__name__)

class InMemoryRateLimiter:
    """Node-local in-memory sliding window rate limiter."""
    def __init__(self):
        self._requests: Dict[str, List[float]] = defaultdict(list)
        self._last_cleanup = time.time()

    def _cleanup(self, now: float, window_seconds: int = 3600):
        if now - self._last_cleanup > 300:  # Cleanup every 5 minutes
            cutoff = now - window_seconds
            for key in list(self._requests.keys()):
                self._requests[key] = [t for t in self._requests[key] if t > cutoff]
                if not self._requests[key]:
                    del self._requests[key]
            self._last_cleanup = now

    def check(
        self,
        key: str,
        max_requests: int,
        window_seconds: int,
        detail: str = "Rate limit exceeded. Please try again later."
    ):
        now = time.time()
        self._cleanup(now, window_seconds)

        history = self._requests[key]
        cutoff = now - window_seconds
        # Filter timestamps within current window
        valid = [t for t in history if t > cutoff]
        if len(valid) >= max_requests:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=detail
            )
        valid.append(now)
        self._requests[key] = valid


class HybridRateLimiter:
    """
    Rate limiter that uses Redis if REDIS_URL is set and redis is importable,
    otherwise safely falls back to InMemoryRateLimiter.
    """
    def __init__(self):
        self._in_memory = InMemoryRateLimiter()
        self._redis_client = None
        redis_url = os.getenv("REDIS_URL")
        if redis_url:
            try:
                import redis
                self._redis_client = redis.from_url(redis_url, socket_timeout=1.5)
                # Quick ping to verify connectivity
                self._redis_client.ping()
                logger.info("Rate limiter successfully connected to shared Redis instance.")
            except Exception as e:
                logger.warning(
                    f"REDIS_URL was configured but connection failed ({e}). "
                    f"Falling back to in-memory rate limiting."
                )
                self._redis_client = None

    def check(
        self,
        key: str,
        max_requests: int,
        window_seconds: int,
        detail: str = "Rate limit exceeded. Please try again later."
    ):
        if self._redis_client:
            try:
                now = time.time()
                pipe = self._redis_client.pipeline()
                pipe.zremrangebyscore(key, 0, now - window_seconds)
                pipe.zadd(key, {str(now): now})
                pipe.zcard(key)
                pipe.expire(key, window_seconds + 10)
                _, _, count, _ = pipe.execute()
                if count > max_requests:
                    raise HTTPException(
                        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                        detail=detail
                    )
                return
            except HTTPException:
                raise
            except Exception as e:
                logger.warning(f"Redis rate limit check failed ({e}). Falling back to local check.")

        # Fallback to local in-memory sliding window
        self._in_memory.check(key, max_requests, window_seconds, detail)


rate_limiter = HybridRateLimiter()

def get_client_ip(request: Request) -> str:
    # Use forwarded-for if behind reverse proxy, else client host
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"
