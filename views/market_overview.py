# views/market_overview.py — Market Overview page (Streamlit)

import streamlit as st
import pandas as pd

from config import ACCENT, RED, YELLOW, BLUE, MUTED, TEXT, CARD_BG, BORDER, BG
from data.loader import (
    load_latest_market, load_sector_map, load_sector_performance,
    load_date_bounds, load_range_market,
)
from datetime import timedelta
from charts.market_overview import (
    sector_treemap, sector_bar,
    volume_leaders_bar, price_change_scatter,
)


# ── CSS ───────────────────────────────────────────────────────────────────────
_CSS = f"""
<style>
.sticky-header {{
    position: sticky;
    top: 0;
    z-index: 50;
    background: {BG};
    padding: 10px 0 14px 0;
    margin-bottom: 6px;
    border-bottom: 1px solid {BORDER};
}}
.stat-bar {{
    display: flex;
    gap: 10px;
    margin-bottom: 14px;
    flex-wrap: wrap;
}}
.stat-card {{
    background: {CARD_BG};
    border: 1px solid {BORDER};
    border-radius: 6px;
    padding: 12px 18px;
    flex: 1;
    min-width: 120px;
}}
.stat-card .sc-label {{
    color: {MUTED};
    font-size: 9px;
    letter-spacing: 1.8px;
    margin-bottom: 4px;
}}
.stat-card .sc-value {{
    color: {TEXT};
    font-size: 18px;
    font-weight: 700;
}}
.stat-card .sc-sub {{
    color: {MUTED};
    font-size: 10px;
    margin-top: 2px;
}}
.section-label {{
    color: {MUTED};
    font-size: 9px;
    letter-spacing: 2px;
    margin-bottom: 8px;
    margin-top: 16px;
}}
.price-table {{
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
}}
.price-table th {{
    color: {MUTED};
    font-size: 9px;
    letter-spacing: 1.5px;
    border-bottom: 1px solid {BORDER};
    padding: 6px 10px;
    text-align: left;
    font-weight: 400;
}}
.price-table td {{
    padding: 7px 10px;
    border-bottom: 1px solid {BORDER}44;
    color: {TEXT};
}}
.price-table tr:hover td {{
    background: {BORDER}88;
}}
.up   {{ color: {ACCENT}; font-weight: 600; }}
.down {{ color: {RED};    font-weight: 600; }}
.flat {{ color: {MUTED};  }}
.leader-table {{
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
}}
.leader-table th {{
    color: {MUTED};
    font-size: 9px;
    letter-spacing: 1.5px;
    padding: 5px 8px;
    border-bottom: 1px solid {BORDER};
    font-weight: 400;
}}
.leader-table td {{
    padding: 6px 8px;
    border-bottom: 1px solid {BORDER}44;
    color: {TEXT};
}}
.rank {{
    color: {MUTED};
    font-size: 10px;
    width: 24px;
}}
</style>
"""


# ── Helpers ───────────────────────────────────────────────────────────────────

def _fmt_naira(n: float) -> str:
    if pd.isna(n): return "—"
    if n >= 1_000_000_000: return f"₦{n/1_000_000_000:.2f}B"
    if n >= 1_000_000:     return f"₦{n/1_000_000:.2f}M"
    return f"₦{n:,.2f}"


def _pct_html(v) -> str:
    if pd.isna(v): return "<span class='flat'>—</span>"
    cls  = "up" if v > 0 else ("down" if v < 0 else "flat")
    sign = "+" if v > 0 else ""
    return f"<span class='{cls}'>{sign}{v:.2f}%</span>"


def _stat_card(label: str, value: str, sub: str = "") -> str:
    return (
        f"<div class='stat-card'>"
        f"  <div class='sc-label'>{label}</div>"
        f"  <div class='sc-value'>{value}</div>"
        f"  <div class='sc-sub'>{sub}</div>"
        f"</div>"
    )


def _leader_table(df: pd.DataFrame, value_col: str, value_label: str) -> str:
    rows = ""
    for i, (_, row) in enumerate(df.iterrows(), 1):
        val = row[value_col]
        if value_col in ("PctChange", "PeriodPctChange"):
            val_html = _pct_html(val)
        elif value_col in ("Volume", "TotalVolume"):
            val_html = f"{int(val):,}" if not pd.isna(val) else "—"
        else:
            val_html = _fmt_naira(val)

        price = row.get("ClosePrice")
        price_s = f"₦{price:.2f}" if isinstance(price, (int, float)) and not pd.isna(price) else "—"

        sector = (
            f"<br><span style='color:{MUTED};font-size:10px'>{row.get('Sector','')}</span>"
            if "Sector" in row.index else ""
        )
        rows += (
            f"<tr>"
            f"  <td class='rank'>{i}</td>"
            f"  <td><b>{row['Symbol']}</b>{sector}</td>"
            f"  <td style='text-align:right'>{price_s}</td>"
            f"  <td style='text-align:right'>{val_html}</td>"
            f"</tr>"
        )
    return (
        f"<table class='leader-table'>"
        f"<thead><tr>"
        f"  <th>#</th><th>Symbol</th>"
        f"  <th style='text-align:right'>PRICE</th>"
        f"  <th style='text-align:right'>{value_label}</th>"
        f"</tr></thead>"
        f"<tbody>{rows}</tbody></table>"
    )


def _snapshot_price_table(df: pd.DataFrame, search: str) -> str:
    show = df.copy()
    if search:
        show = show[show["Symbol"].str.contains(search.upper(), na=False)]

    rows = ""
    for _, row in show.iterrows():
        rows += (
            f"<tr>"
            f"  <td><b>{row['Symbol']}</b></td>"
            f"  <td>{row.get('Sector','—')}</td>"
            f"  <td style='text-align:right'>₦{row['ClosePrice']:.2f}</td>"
            f"  <td style='text-align:right'>₦{row.get('OpeningPrice',0):.2f}</td>"
            f"  <td style='text-align:right'><span style='color:{ACCENT}'>₦{row.get('HighPrice',0):.2f}</span></td>"
            f"  <td style='text-align:right'><span style='color:{RED}'>₦{row.get('LowPrice',0):.2f}</span></td>"
            f"  <td style='text-align:right'>{_pct_html(row.get('PctChange'))}</td>"
            f"  <td style='text-align:right'>{0 if pd.isna(row.get('Volume')) else int(row['Volume']):,}</td>"
            f"  <td style='text-align:right'>{_fmt_naira(0 if pd.isna(row.get('Value')) else row['Value'])}</td>"
            f"</tr>"
        )
    return (
        f"<table class='price-table'>"
        f"<thead><tr>"
        f"  <th>Symbol</th><th>SECTOR</th>"
        f"  <th style='text-align:right'>CLOSE</th>"
        f"  <th style='text-align:right'>OPEN</th>"
        f"  <th style='text-align:right'>HIGH</th>"
        f"  <th style='text-align:right'>LOW</th>"
        f"  <th style='text-align:right'>CHG%</th>"
        f"  <th style='text-align:right'>VOLUME</th>"
        f"  <th style='text-align:right'>VALUE</th>"
        f"</tr></thead>"
        f"<tbody>{rows}</tbody></table>"
    )


def _range_price_table(df: pd.DataFrame, search: str) -> str:
    show = df.copy()
    if search:
        show = show[show["Symbol"].str.contains(search.upper(), na=False)]

    rows = ""
    for _, row in show.iterrows():
        open_p  = row.get("OpenPrice")
        close_p = row.get("ClosePrice")
        high_p  = row.get("HighPrice")
        low_p   = row.get("LowPrice")
        perc    = row.get("PeriodPctChange")
        volume  = row.get("TotalVolume", 0)
        value   = row.get("TotalValue", 0)
        days    = int(row.get("TradeDays", 0)) if not pd.isna(row.get("TradeDays", 0)) else 0

        def _p(v):
            return f"₦{v:.2f}" if isinstance(v, (int, float)) and not pd.isna(v) else "—"

        rows += (
            f"<tr>"
            f"  <td><b>{row['Symbol']}</b></td>"
            f"  <td>{row.get('Sector','—')}</td>"
            f"  <td style='text-align:right'>{_p(open_p)}</td>"
            f"  <td style='text-align:right'>{_p(close_p)}</td>"
            f"  <td style='text-align:right'><span style='color:{ACCENT}'>{_p(high_p)}</span></td>"
            f"  <td style='text-align:right'><span style='color:{RED}'>{_p(low_p)}</span></td>"
            f"  <td style='text-align:right'>{_pct_html(perc)}</td>"
            f"  <td style='text-align:right'>{0 if pd.isna(volume) else int(volume):,}</td>"
            f"  <td style='text-align:right'>{_fmt_naira(0 if pd.isna(value) else value)}</td>"
            f"  <td style='text-align:right;color:{MUTED}'>{days}d</td>"
            f"</tr>"
        )
    return (
        f"<table class='price-table'>"
        f"<thead><tr>"
        f"  <th>Symbol</th><th>SECTOR</th>"
        f"  <th style='text-align:right'>OPEN</th>"
        f"  <th style='text-align:right'>CLOSE</th>"
        f"  <th style='text-align:right'>PERIOD HIGH</th>"
        f"  <th style='text-align:right'>PERIOD LOW</th>"
        f"  <th style='text-align:right'>PERIOD%</th>"
        f"  <th style='text-align:right'>TOT VOLUME</th>"
        f"  <th style='text-align:right'>TOT VALUE</th>"
        f"  <th style='text-align:right'>DAYS</th>"
        f"</tr></thead>"
        f"<tbody>{rows}</tbody></table>"
    )


# ── Last Trading Day view ─────────────────────────────────────────────────────

def _render_snapshot(end_date):
    with st.spinner(""):
        sector_map = load_sector_map()
        market_df  = load_latest_market(sector_map, end_date=end_date)
        sector_df  = load_sector_performance(end_date=end_date)

    if market_df.empty:
        st.warning("No market data available.")
        return

    latest_date  = market_df["TradeDate"].max()
    total_stocks = len(market_df)
    total_value  = market_df["Value"].sum()
    total_volume = market_df["Volume"].sum()
    gainers      = int((market_df["PctChange"] > 0).sum())
    losers       = int((market_df["PctChange"] < 0).sum())
    unchanged    = total_stocks - gainers - losers
    top_sector   = (
        sector_df.loc[sector_df["TotalValue"].idxmax(), "Sector"]
        if not sector_df.empty else "—"
    )

    st.markdown(f"""
        <div class='sticky-header'>
            <div style='display:flex;align-items:baseline;gap:12px;
                        border-left:3px solid {ACCENT};padding-left:12px'>
                <div style='color:{TEXT};font-size:20px;font-weight:700;letter-spacing:1px'>
                    {latest_date.strftime("%d %b %Y")}
                </div>
                <div style='color:{MUTED};font-size:10px;letter-spacing:1.5px'>
                    LATEST TRADING DAY
                </div>
            </div>
        </div>
        <div style='height:16px'></div>
    """, unsafe_allow_html=True)

    stats_html = "".join([
        _stat_card("LISTED STOCKS", str(total_stocks), "on NGX"),
        _stat_card("DAY VALUE",    _fmt_naira(total_value),      "total traded today"),
        _stat_card("DAY VOLUME",   f"{int(total_volume):,}",     "shares"),
        _stat_card("GAINERS",
                   f"<span style='color:{ACCENT}'>{gainers}</span>",
                   f"{losers} losers · {unchanged} unchanged"),
        _stat_card("TOP SECTOR", top_sector, "by value"),
    ])
    st.markdown(f"<div class='stat-bar'>{stats_html}</div>", unsafe_allow_html=True)

    st.markdown("<div class='section-label'>MARKET LEADERS</div>", unsafe_allow_html=True)
    top_gainers = market_df.nlargest(8,  "PctChange")[["Symbol", "ClosePrice", "PctChange", "Sector"]]
    top_losers  = market_df.nsmallest(8, "PctChange")[["Symbol", "ClosePrice", "PctChange", "Sector"]]
    most_active = market_df.nlargest(8,  "Volume")[  ["Symbol", "ClosePrice", "Volume",    "Sector"]]

    l1, l2, l3 = st.columns(3, gap="medium")
    with l1:
        st.markdown(
            f"<div style='color:{ACCENT};font-size:10px;letter-spacing:1.5px;margin-bottom:6px'>▲ TOP GAINERS</div>",
            unsafe_allow_html=True,
        )
        st.markdown(_leader_table(top_gainers, "PctChange", "CHG%"), unsafe_allow_html=True)
    with l2:
        st.markdown(
            f"<div style='color:{RED};font-size:10px;letter-spacing:1.5px;margin-bottom:6px'>▼ TOP LOSERS</div>",
            unsafe_allow_html=True,
        )
        st.markdown(_leader_table(top_losers, "PctChange", "CHG%"), unsafe_allow_html=True)
    with l3:
        st.markdown(
            f"<div style='color:{BLUE};font-size:10px;letter-spacing:1.5px;margin-bottom:6px'>◉ MOST ACTIVE</div>",
            unsafe_allow_html=True,
        )
        st.markdown(_leader_table(most_active, "Volume", "VOLUME"), unsafe_allow_html=True)

    st.markdown("<div class='section-label'>SECTOR OVERVIEW</div>", unsafe_allow_html=True)
    ch1, ch2 = st.columns([1.4, 1], gap="medium")
    with ch1:
        st.plotly_chart(sector_treemap(sector_df), use_container_width=True)
    with ch2:
        st.plotly_chart(sector_bar(sector_df), use_container_width=True)

    st.markdown("<div class='section-label'>MARKET SCATTER</div>", unsafe_allow_html=True)
    st.plotly_chart(price_change_scatter(market_df), use_container_width=True)

    st.markdown("<div class='section-label'>FULL PRICE LIST</div>", unsafe_allow_html=True)
    sc, so, _ = st.columns([2, 2, 4])
    with sc:
        search = st.text_input("Search", placeholder="e.g. GTCO",
                               label_visibility="collapsed", key="snap_search")
    with so:
        sort_by = st.selectbox(
            "Sort by", ["Symbol", "ClosePrice", "PctChange", "Volume", "Value"],
            label_visibility="collapsed", key="snap_sort",
        )
    display_df = market_df.sort_values(sort_by, ascending=(sort_by == "Symbol")).reset_index(drop=True)
    st.markdown(
        f"<div style='max-height:480px;overflow-y:auto;border:1px solid {BORDER};"
        f"border-radius:6px;padding:0'>"
        f"{_snapshot_price_table(display_df, search)}"
        f"</div>",
        unsafe_allow_html=True,
    )


# ── Date Range cumulative view ────────────────────────────────────────────────

def _render_range(start_date, end_date):
    with st.spinner(""):
        range_df = load_range_market(start_date, end_date)

    if range_df.empty:
        st.warning("No market data for the selected range.")
        return

    range_df["Sector"] = range_df["Sector"].fillna("Unknown")

    # Sector aggregation from per-symbol range data
    sector_df = (
        range_df.groupby("Sector", as_index=False)
        .agg(
            AvgPctChange=("PeriodPctChange", "mean"),
            TotalValue=("TotalValue",        "sum"),
            TotalVolume=("TotalVolume",      "sum"),
            StockCount=("Symbol",            "count"),
        )
        .round({"AvgPctChange": 2})
        .sort_values("AvgPctChange", ascending=False)
    )

    total_stocks = len(range_df)
    total_value  = range_df["TotalValue"].sum()
    total_volume = range_df["TotalVolume"].sum()
    gainers      = int((range_df["PeriodPctChange"] > 0).sum())
    losers       = int((range_df["PeriodPctChange"] < 0).sum())
    unchanged    = total_stocks - gainers - losers
    top_sector   = sector_df.iloc[0]["Sector"] if not sector_df.empty else "—"

    start_s = start_date.strftime("%d %b %Y")
    end_s   = end_date.strftime("%d %b %Y")

    st.markdown(f"""
        <div class='sticky-header'>
            <div style='display:flex;align-items:baseline;gap:12px;
                        border-left:3px solid {YELLOW};padding-left:12px'>
                <div style='color:{TEXT};font-size:20px;font-weight:700;letter-spacing:1px'>
                    {start_s} — {end_s}
                </div>
                <div style='color:{MUTED};font-size:10px;letter-spacing:1.5px'>
                    PERIOD SUMMARY
                </div>
            </div>
        </div>
        <div style='height:16px'></div>
    """, unsafe_allow_html=True)

    stats_html = "".join([
        _stat_card("LISTED STOCKS",  str(total_stocks),        "on NGX"),
        _stat_card("TOTAL TURNOVER", _fmt_naira(total_value),  "across period"),
        _stat_card("TOTAL VOLUME",   f"{int(total_volume):,}", "shares traded"),
        _stat_card("GAINERS",
                   f"<span style='color:{ACCENT}'>{gainers}</span>",
                   f"{losers} losers · {unchanged} flat"),
        _stat_card("LEADING SECTOR", top_sector, "by avg period return"),
    ])
    st.markdown(f"<div class='stat-bar'>{stats_html}</div>", unsafe_allow_html=True)

    st.markdown("<div class='section-label'>PERIOD LEADERS</div>", unsafe_allow_html=True)
    top_gainers = range_df.nlargest(8,  "PeriodPctChange")[
        ["Symbol", "ClosePrice", "PeriodPctChange", "Sector"]]
    top_losers  = range_df.nsmallest(8, "PeriodPctChange")[
        ["Symbol", "ClosePrice", "PeriodPctChange", "Sector"]]
    most_active = range_df.nlargest(8,  "TotalVolume")[
        ["Symbol", "ClosePrice", "TotalVolume", "Sector"]]

    l1, l2, l3 = st.columns(3, gap="medium")
    with l1:
        st.markdown(
            f"<div style='color:{ACCENT};font-size:10px;letter-spacing:1.5px;margin-bottom:6px'>▲ TOP GAINERS</div>",
            unsafe_allow_html=True,
        )
        st.markdown(_leader_table(top_gainers, "PeriodPctChange", "PERIOD%"), unsafe_allow_html=True)
    with l2:
        st.markdown(
            f"<div style='color:{RED};font-size:10px;letter-spacing:1.5px;margin-bottom:6px'>▼ TOP LOSERS</div>",
            unsafe_allow_html=True,
        )
        st.markdown(_leader_table(top_losers, "PeriodPctChange", "PERIOD%"), unsafe_allow_html=True)
    with l3:
        st.markdown(
            f"<div style='color:{BLUE};font-size:10px;letter-spacing:1.5px;margin-bottom:6px'>◉ MOST ACTIVE</div>",
            unsafe_allow_html=True,
        )
        st.markdown(_leader_table(most_active, "TotalVolume", "TOT VOLUME"), unsafe_allow_html=True)

    st.markdown("<div class='section-label'>SECTOR OVERVIEW</div>", unsafe_allow_html=True)
    ch1, ch2 = st.columns([1.4, 1], gap="medium")
    with ch1:
        st.plotly_chart(sector_treemap(sector_df), use_container_width=True)
    with ch2:
        st.plotly_chart(sector_bar(sector_df), use_container_width=True)

    st.markdown("<div class='section-label'>MARKET SCATTER  (period % vs last close)</div>",
                unsafe_allow_html=True)
    scatter_df = range_df.rename(columns={"PeriodPctChange": "PctChange", "TotalVolume": "Volume"})
    st.plotly_chart(price_change_scatter(scatter_df), use_container_width=True)

    st.markdown("<div class='section-label'>FULL PRICE LIST</div>", unsafe_allow_html=True)
    sc, so, _ = st.columns([2, 2, 4])
    with sc:
        search = st.text_input("Search", placeholder="e.g. GTCO",
                               label_visibility="collapsed", key="range_search")
    with so:
        sort_by = st.selectbox(
            "Sort by",
            ["Symbol", "ClosePrice", "PeriodPctChange", "TotalVolume", "TotalValue"],
            label_visibility="collapsed", key="range_sort",
        )
    display_df = range_df.sort_values(sort_by, ascending=(sort_by == "Symbol")).reset_index(drop=True)
    st.markdown(
        f"<div style='max-height:480px;overflow-y:auto;border:1px solid {BORDER};"
        f"border-radius:6px;padding:0'>"
        f"{_range_price_table(display_df, search)}"
        f"</div>",
        unsafe_allow_html=True,
    )


# ── Entry point ───────────────────────────────────────────────────────────────

def render():
    st.markdown(_CSS, unsafe_allow_html=True)

    min_date, max_date = load_date_bounds()

    c_mode, c_start, c_end, _ = st.columns([2.2, 1.5, 1.5, 3])
    with c_mode:
        mode = st.radio(
            "", ["Last Trading Day", "Date Range"],
            horizontal=True, key="mo_mode",
        )

    if mode == "Last Trading Day":
        _render_snapshot(None)
    else:
        with c_start:
            start_date = st.date_input(
                "From",
                value=max_date - timedelta(days=30),
                min_value=min_date, max_value=max_date,
                key="mo_start",
            )
        with c_end:
            end_date = st.date_input(
                "To",
                value=max_date,
                min_value=min_date, max_value=max_date,
                key="mo_end",
            )
        if start_date >= end_date:
            st.error("'From' must be before 'To'.")
            return
        _render_range(start_date, end_date)
