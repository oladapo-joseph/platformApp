# data/indicators.py — technical indicator calculations

import pandas as pd


def calculate_sma(series: pd.Series, window: int) -> pd.Series:
    return series.rolling(window=window).mean()


def calculate_ema(series: pd.Series, window: int) -> pd.Series:
    return series.ewm(span=window, adjust=True).mean()


def calculate_rsi(series: pd.Series, window: int) -> pd.Series:
    delta = series.diff()
    gain  = delta.where(delta > 0, 0).rolling(window=window).mean()
    loss  = (-delta.where(delta < 0, 0)).rolling(window=window).mean()
    rs    = gain / loss
    return 100 - (100 / (1 + rs))


def calculate_macd(
    series: pd.Series,
    short_window: int,
    long_window: int,
    signal_window: int,
) -> tuple[pd.Series, pd.Series]:
    short_ema = calculate_ema(series, short_window)
    long_ema  = calculate_ema(series, long_window)
    macd      = short_ema - long_ema
    signal    = calculate_ema(macd, signal_window)
    return macd, signal


def add_all_indicators(df: pd.DataFrame) -> pd.DataFrame:
    """Append all standard indicator columns to a copy of df."""
    df = df.copy()
    close = df["ClosePrice"]

    df["EMA_12"]          = calculate_ema(close, 12)
    df["EMA_26"]          = calculate_ema(close, 26)
    df["RSI_14"]          = calculate_rsi(close, 14)
    df["RSI_7"]           = calculate_rsi(close, 7)
    df["SMA_50"]          = calculate_sma(close, 50)
    df["SMA_200"]         = calculate_sma(close, 200)
    macd, signal          = calculate_macd(close, 12, 26, 9)
    df["MACD"]            = macd
    df["Signal_Line"]     = signal
    df["MACD_Histogram"]  = macd - signal
    return df
