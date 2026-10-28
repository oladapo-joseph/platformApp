"""
In-process rate limits and sign-in lockout (single replica in v1; Redis if we scale out).

* FixedWindow: at most `limit` hits per key per `seconds` (access requests, resets).
* LoginGuard: 5 failed sign-ins per account+IP within a minute lock that pair out,
  for 1 min, then 2, 4, … up to 15 min on repeat lockouts within the hour. Keyed on
  the pair, so an attacker elsewhere can't lock a real user out of their account.
* login_ip_failures: 100 failed sign-ins from one IP in 15 minutes, across all
  accounts, pause that IP (credential stuffing). High, because Nigerian mobile
  networks put many users behind one carrier-grade NAT address.
See docs/12-security-review.md §3 for the full list (ASVS 6.1.1).
"""

import time
from threading import Lock

from cachetools import TTLCache


class FixedWindow:
    def __init__(self, limit: int, seconds: int, maxsize: int = 50_000) -> None:
        self.limit, self.seconds = limit, seconds
        self._hits: TTLCache[str, tuple[float, int]] = TTLCache(maxsize=maxsize, ttl=seconds)
        self._lock = Lock()

    def hit(self, key: str) -> int:
        """Count a hit. Returns 0 if allowed, else seconds until the window resets."""
        now = time.monotonic()
        with self._lock:
            start, count = self._hits.get(key, (now, 0))
            if now - start >= self.seconds:  # the cache entry outlives its window when re-set
                start, count = now, 0
            if count >= self.limit:
                return max(1, int(start + self.seconds - now))
            self._hits[key] = (start, count + 1)
            return 0

    def blocked(self, key: str) -> int:
        """Seconds until the window resets if the limit is used up, else 0 (doesn't count a hit)."""
        now = time.monotonic()
        with self._lock:
            start, count = self._hits.get(key, (now, 0))
            if count < self.limit or now - start >= self.seconds:
                return 0
            return max(1, int(start + self.seconds - now))

    def clear(self) -> None:
        with self._lock:
            self._hits.clear()


class LoginGuard:
    MAX_FAILURES, WINDOW, BASE_LOCK, MAX_LOCK = 5, 60, 60, 15 * 60

    def __init__(self) -> None:
        self._failures: TTLCache[str, tuple[float, int]] = TTLCache(maxsize=50_000, ttl=self.WINDOW)
        self._locks: TTLCache[str, float] = TTLCache(maxsize=50_000, ttl=self.MAX_LOCK)
        self._strikes: TTLCache[str, int] = TTLCache(maxsize=50_000, ttl=3600)
        self._lock = Lock()

    def locked_for(self, key: str) -> int:
        """Seconds left on a lockout (0 = free to try)."""
        with self._lock:
            until = self._locks.get(key)
            left = until - time.monotonic() if until else 0
            return max(0, int(left) + (1 if left > 0 else 0))

    def failed(self, key: str) -> None:
        now = time.monotonic()
        with self._lock:
            start, count = self._failures.get(key, (now, 0))
            if now - start >= self.WINDOW:
                start, count = now, 0
            count += 1
            if count >= self.MAX_FAILURES:
                strikes = self._strikes.get(key, 0)
                self._locks[key] = now + min(self.BASE_LOCK * 2**strikes, self.MAX_LOCK)
                self._strikes[key] = strikes + 1
                self._failures.pop(key, None)
            else:
                self._failures[key] = (start, count)

    def succeeded(self, key: str) -> None:
        with self._lock:
            for store in (self._failures, self._locks, self._strikes):
                store.pop(key, None)

    def clear(self) -> None:
        with self._lock:
            for store in (self._failures, self._locks, self._strikes):
                store.clear()


login_guard = LoginGuard()
access_requests = FixedWindow(limit=3, seconds=3600)  # per IP (US-1.2)
signups = FixedWindow(limit=3, seconds=3600)  # per IP (SIGNUP_MODE=open)
password_resets = FixedWindow(limit=5, seconds=60)  # per IP + email
invite_lookups = FixedWindow(limit=30, seconds=60)  # per IP: token guessing
login_ip_failures = FixedWindow(limit=100, seconds=15 * 60)  # failed sign-ins per IP, any account


def clear_all() -> None:
    login_guard.clear()
    for w in (access_requests, signups, password_resets, invite_lookups, login_ip_failures):
        w.clear()
