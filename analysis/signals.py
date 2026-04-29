# analysis/signals.py — signal generation and strategy logic

import pandas as pd
from data.indicators import calculate_macd, calculate_rsi, calculate_ema, calculate_sma


def macd_signals(
    price_df: pd.DataFrame,
    short: int = 12,
    long: int = 26,
    signal: int = 9,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """
    MACD crossover strategy.
    Returns:
        buy_df, sell_df  — filtered rows of price_df where signals fired
    """
    macd, sig = calculate_macd(price_df["ClosePrice"], short, long, signal)
    buy_mask  = (macd > sig) & (macd.shift(1) <= sig.shift(1))
    sell_mask = (macd < sig) & (macd.shift(1) >= sig.shift(1))
    return price_df[buy_mask].dropna(), price_df[sell_mask].dropna()


def rsi_signals(
    price_df: pd.DataFrame,
    window: int = 14,
    oversold: float = 30,
    overbought: float = 70,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """
    RSI reversal strategy.
    Buy when RSI crosses up through oversold, sell when crosses down through overbought.
    """
    rsi       = calculate_rsi(price_df["ClosePrice"], window)
    buy_mask  = (rsi > oversold)  & (rsi.shift(1) <= oversold)
    sell_mask = (rsi < overbought) & (rsi.shift(1) >= overbought)
    return price_df[buy_mask].dropna(), price_df[sell_mask].dropna()


def sma_crossover_signals(
    price_df: pd.DataFrame,
    short: int = 50,
    long: int = 200,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """
    Golden cross / death cross strategy.
    Buy on golden cross (short crosses above long), sell on death cross.
    """
    short_sma = calculate_sma(price_df["ClosePrice"], short)
    long_sma  = calculate_sma(price_df["ClosePrice"], long)
    buy_mask  = (short_sma > long_sma) & (short_sma.shift(1) <= long_sma.shift(1))
    sell_mask = (short_sma < long_sma) & (short_sma.shift(1) >= long_sma.shift(1))
    return price_df[buy_mask].dropna(), price_df[sell_mask].dropna()


STRATEGIES = {
    "MACD Crossover":    macd_signals,
    "RSI Reversal":      rsi_signals,
    "SMA Golden Cross":  sma_crossover_signals,
}


def get_signals(strategy_name: str, price_df: pd.DataFrame):
    """Dispatch to the right strategy by name."""
    fn = STRATEGIES.get(strategy_name, macd_signals)
    return fn(price_df)
