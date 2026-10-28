"""
Peer similarity: pure scoring (ported from streamlitApp/views/deep_dive.py::_find_similar).

score = 0.35·industry + 0.30·market cap + 0.20·traded value + 0.15·volume, where
industry comes from the reference stock's `similarsector` map (sector → 0–1)
and the size terms are log-ratio similarities (equal → 1, 100× apart → 0).
"""

import math
from dataclasses import dataclass, field
from typing import Literal

SortKey = Literal["overall", "industry", "market_cap", "traded_value", "volume"]

WEIGHTS = {"industry": 0.35, "market_cap": 0.30, "traded_value": 0.20, "volume": 0.15}


@dataclass(frozen=True)
class PeerInput:
    symbol: str
    company: str
    sector: str  # upper-case
    subsector: str
    market_cap: float  # shares outstanding × period close (0 if unknown)
    traded_value: float  # period total
    volume: float  # period total
    similarsector: dict[str, float] = field(default_factory=dict)


@dataclass(frozen=True)
class Peer:
    symbol: str
    company: str
    sector: str
    subsector: str
    market_cap: float
    traded_value: float
    volume: float
    scores: dict[str, int]  # overall + one per component, 0–100


def log_similarity(a: float, b: float) -> float:
    if a <= 0 or b <= 0:
        return 0.0
    return max(0.0, 1.0 - abs(math.log(a / b)) / math.log(100))


def find_similar(symbol: str, universe: list[PeerInput], sort: SortKey = "overall", n: int = 8) -> list[Peer]:
    """Top-n peers of `symbol` within `universe` (which must include the symbol itself)."""
    ref = next((p for p in universe if p.symbol == symbol), None)
    if ref is None:
        return []

    peers: list[Peer] = []
    for p in universe:
        if p.symbol == symbol:
            continue
        parts = {
            "industry": float(ref.similarsector.get(p.sector, 0.0)),
            "market_cap": log_similarity(p.market_cap, ref.market_cap),
            "traded_value": log_similarity(p.traded_value, ref.traded_value),
            "volume": log_similarity(p.volume, ref.volume),
        }
        overall = sum(WEIGHTS[k] * v for k, v in parts.items())
        scores = {"overall": round(overall * 100), **{k: round(v * 100) for k, v in parts.items()}}
        peers.append(
            Peer(
                p.symbol,
                p.company or p.symbol,
                p.sector,
                p.subsector or "—",
                p.market_cap,
                p.traded_value,
                p.volume,
                scores,
            )
        )

    peers.sort(key=lambda peer: -peer.scores[sort])  # stable: ties keep universe order
    return peers[:n]
