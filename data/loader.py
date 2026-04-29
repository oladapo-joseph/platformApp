# data/loader.py — MongoDB-backed data layer for EquityLens NG platform

import os
import pandas as pd
import streamlit as st
from datetime import datetime, timedelta
from pymongo import MongoClient, DESCENDING, ASCENDING
from dotenv import load_dotenv
import pytz

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

WAT     = pytz.timezone("Africa/Lagos")
_client = None


def _get_client() -> MongoClient:
    global _client
    if _client is None:
        uri = os.getenv("MONGODB_URI", "").strip().strip('"')
        _client = MongoClient(uri)
    return _client


def _collection():
    return _get_client()[os.getenv("MONGODB_DB", "")][os.getenv("COLLECTION_NAME")]


def _latest_snapshot(date=None) -> list:
    """One doc per symbol from the most recent fetched_at on a given date."""
    col = _collection()

    if date is None:
        latest = col.find_one(sort=[("fetched_at", DESCENDING)])
        if not latest:
            return []
        latest_dt = latest["fetched_at"]
        if latest_dt.tzinfo is None:
            latest_dt = latest_dt.replace(tzinfo=WAT)
        day_start = latest_dt.replace(hour=0, minute=0, second=0, microsecond=0)
    else:
        if isinstance(date, datetime):
            day_start = date.replace(hour=0, minute=0, second=0, microsecond=0, tzinfo=WAT)
        else:
            day_start = datetime.strptime(str(date)[:10], "%Y-%m-%d").replace(tzinfo=WAT)

    day_end = day_start + timedelta(days=1)

    pipeline = [
        {"$match": {"fetched_at": {"$gte": day_start, "$lt": day_end}}},
        {"$sort": {"fetched_at": DESCENDING}},
        {"$group": {"_id": "$Symbol", "doc": {"$first": "$$ROOT"}}},
        {"$replaceRoot": {"newRoot": "$doc"}},
    ]
    return list(col.aggregate(pipeline))


@st.cache_data(ttl=300, show_spinner=False)
def load_stock_list() -> list[str]:
    """Sorted list of all distinct stock symbols."""
    symbols = _collection().distinct("Symbol")
    return sorted([s for s in symbols if s])


@st.cache_data(ttl=300, show_spinner=False)
def load_stock_data(symbol: str, days: int = 1095) -> tuple[pd.DataFrame, pd.DataFrame]:
    """
    Returns:
        price_df  — DateTimeIndex, single column ClosePrice
        full_df   — DateTimeIndex, all OHLCV + Change, PrevClosingPrice, etc.
    """
    col   = _collection()
    since = datetime.now(WAT) - timedelta(days=days)

    pipeline = [
        {"$match": {"Symbol": symbol.upper(), "fetched_at": {"$gte": since}}},
        {"$sort": {"fetched_at": DESCENDING}},
        {"$group": {
            "_id":  {"$substr": ["$TradeDate", 0, 10]},
            "doc":  {"$first": "$$ROOT"},
        }},
        {"$replaceRoot": {"newRoot": "$doc"}},
        {"$sort": {"TradeDate": ASCENDING}},
    ]
    docs = list(col.aggregate(pipeline))
    if not docs:
        return pd.DataFrame(), pd.DataFrame()

    df = pd.DataFrame(docs)
    df["TradeDate"] = pd.to_datetime(df["TradeDate"], errors="coerce").dt.normalize()
    df = df.dropna(subset=["TradeDate"]).set_index("TradeDate").sort_index()

    for c in ["OpeningPrice", "HighPrice", "LowPrice", "ClosePrice",
              "Volume", "Value", "PrevClosingPrice", "Change", "Trades"]:
        if c in df.columns:
            df[c] = pd.to_numeric(df[c], errors="coerce")

    df.drop(columns=["_id", "fetched_at"], errors="ignore", inplace=True)

    price_df = df[["ClosePrice"]].copy()
    return price_df, df


@st.cache_data(ttl=600, show_spinner=False)
def load_date_bounds() -> tuple:
    """Return (min_date, max_date) as datetime.date in WAT."""
    col     = _collection()
    earliest = col.find_one(sort=[("fetched_at", ASCENDING)])
    latest   = col.find_one(sort=[("fetched_at", DESCENDING)])

    if not earliest or not latest:
        today = datetime.now(WAT).date()
        return today, today

    def _to_wat_date(dt):
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=WAT)
        return dt.astimezone(WAT).date()

    return _to_wat_date(earliest["fetched_at"]), _to_wat_date(latest["fetched_at"])


@st.cache_data(ttl=600, show_spinner=False)
def load_sector_map() -> pd.DataFrame:
    """DataFrame with columns Symbol, Sector from the latest snapshot."""
    docs = _latest_snapshot()
    if not docs:
        return pd.DataFrame(columns=["Symbol", "Sector"])
    df = pd.DataFrame(docs)[["Symbol", "Sector"]].dropna(subset=["Symbol"])
    return df.drop_duplicates("Symbol").reset_index(drop=True)


def filter_by_dates(df: pd.DataFrame, start_date, end_date) -> pd.DataFrame:
    """Slice a DateTimeIndex DataFrame to [start_date, end_date]."""
    if start_date and end_date:
        s = pd.to_datetime(start_date)
        e = pd.to_datetime(end_date)
        return df[(df.index >= s) & (df.index <= e)]
    return df


@st.cache_data(ttl=300, show_spinner=False)
def load_latest_market(sector_map: pd.DataFrame = None, end_date=None) -> pd.DataFrame:
    """
    One row per Symbol for the most recent trading date up to end_date.
    Returns PctChange (renamed from PercChange), Sector, and all OHLCV columns.
    """
    docs = _latest_snapshot(end_date)
    if not docs:
        return pd.DataFrame()

    df = pd.DataFrame(docs)
    df["TradeDate"] = pd.to_datetime(df["TradeDate"], errors="coerce")

    for c in ["ClosePrice", "OpeningPrice", "HighPrice", "LowPrice",
              "Volume", "Value", "PrevClosingPrice", "Change", "PercChange"]:
        if c in df.columns:
            df[c] = pd.to_numeric(df[c], errors="coerce")

    df.rename(columns={"PercChange": "PctChange"}, inplace=True)
    df.drop(columns=["_id", "fetched_at"], errors="ignore", inplace=True)
    return df.reset_index(drop=True)


@st.cache_data(ttl=300, show_spinner=False)
def load_sector_performance(end_date=None) -> pd.DataFrame:
    """
    Avg % change, total value, total volume, and stock count per sector
    for the latest trading day up to end_date.
    """
    docs = _latest_snapshot(end_date)
    if not docs:
        return pd.DataFrame()

    df = pd.DataFrame(docs)
    for c in ["PercChange", "Value", "Volume"]:
        if c in df.columns:
            df[c] = pd.to_numeric(df[c], errors="coerce")

    df["Sector"] = df["Sector"].fillna("Unknown")

    grouped = (
        df.groupby("Sector")
        .agg(
            AvgPctChange=("PercChange", "mean"),
            TotalValue=("Value",     "sum"),
            TotalVolume=("Volume",   "sum"),
            StockCount=("Symbol",    "count"),
        )
        .round({"AvgPctChange": 2})
        .reset_index()
    )
    return grouped
