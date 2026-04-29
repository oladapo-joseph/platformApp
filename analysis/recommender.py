# analysis/recommender.py — multi-LLM recommendation engine

from datetime import datetime
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import StrOutputParser
from dotenv import dotenv_values

_env = dotenv_values(".env")

_TEMPLATE = """
You are a financial analyst specialising in African equity markets.

Stock: {stock_details}
Buy Signals: {buy_signal}
Sell Signals: {sell_signal}
Date: {today}

Rules:
- Stock trades on NGX in NGN
- Signals from technical indicators (MACD/RSI/SMA)
- Assume no existing position

Respond in exactly this format (max 80 words):
Recommendation: [BUY / SELL]
Reason: <brief explanation>
"""

LLM_OPTIONS = ["Claude (Anthropic)", "OpenAI (GPT-4o)", "Gemini (Google)"]


def _build_llm(provider: str, api_key: str):
    if provider == "Claude (Anthropic)":
        from langchain_anthropic import ChatAnthropic
        return ChatAnthropic(
            temperature=0,
            model="claude-sonnet-4-6",
            api_key=api_key,
        )
    elif provider == "OpenAI (GPT-4o)":
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(
            temperature=0,
            model="gpt-4o",
            api_key=api_key,
        )
    elif provider == "Gemini (Google)":
        from langchain_google_genai import ChatGoogleGenerativeAI
        return ChatGoogleGenerativeAI(
            temperature=0,
            model="gemini-1.5-flash",
            google_api_key=api_key,
        )
    else:
        raise ValueError(f"Unknown provider: {provider}")


def generate_recommendation(
    buy_signal: dict,
    sell_signal: dict,
    stock_details: dict,
    provider: str = "Claude (Anthropic)",
    api_key: str = None,
) -> str:
    # Fall back to env variable if no key supplied (admin path)
    if not api_key:
        key_map = {
            "Claude (Anthropic)": _env.get("ANTHROPIC_API_KEY"),
            "OpenAI (GPT-4o)":    _env.get("OPENAI_API_KEY"),
            "Gemini (Google)":    _env.get("GEMINI_API_KEY"),
        }
        api_key = key_map.get(provider)

    if not api_key:
        raise ValueError(f"No API key provided for {provider}.")

    prompt = PromptTemplate(
        input_variables=["buy_signal", "sell_signal", "stock_details", "today"],
        template=_TEMPLATE,
    )
    llm   = _build_llm(provider, api_key)
    chain = prompt | llm | StrOutputParser()

    return chain.invoke({
        "buy_signal":    buy_signal,
        "sell_signal":   sell_signal,
        "stock_details": stock_details,
        "today":         datetime.now().date(),
    })
