# analysis/recommender.py — Claude Sonnet recommendation engine

import os
from datetime import datetime
import anthropic

MODEL = "claude-sonnet-4-6"

_SYSTEM = (
    "You are a financial analyst specialising in African equity markets. "
    "Be concise and direct. Format your response exactly as instructed."
)

_TEMPLATE = """\
Stock: {stock_details}
Buy Signals: {buy_signal}
Sell Signals: {sell_signal}
Date: {today}

Rules:
- Stock trades on the Nigerian Exchange (NGX) in NGN
- Signals come from technical indicators (MACD / RSI / SMA crossover)
- Assume no existing position

Respond in exactly this format (max 80 words):
Recommendation: [BUY / SELL / HOLD]
Reason: <brief explanation>
"""

_client: anthropic.Anthropic | None = None


def _get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        _client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY", ""))
    return _client


def generate_recommendation(
    buy_signal: dict,
    sell_signal: dict,
    stock_details: dict,
    **_kwargs,  # absorb legacy provider/api_key args
) -> str:
    prompt = _TEMPLATE.format(
        stock_details=stock_details,
        buy_signal=buy_signal,
        sell_signal=sell_signal,
        today=datetime.now().date(),
    )
    response = _get_client().messages.create(
        model=MODEL,
        max_tokens=200,
        system=_SYSTEM,
        messages=[{"role": "user", "content": prompt}],
    )
    return response.content[0].text.strip()
