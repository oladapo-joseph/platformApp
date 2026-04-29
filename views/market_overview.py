# pages/market_overview.py — Market Overview page (Streamlit)

import streamlit as st
import pandas as pd

from config import ACCENT, RED, YELLOW, BLUE, MUTED, TEXT, CARD_BG, BORDER, BG
from data.loader import load_latest_market, load_sector_map, load_sector_performance, load_date_bounds
from datetime import timedelta
from charts.market_overview import (
    sector_treemap, sector_bar,
    volume_leaders_bar, price_change_scatter,
)


# ── CSS ───────────────────────────────────────────────────────────────────────
_CSS = f"""
<style>
/* ── Sticky date header ── */
.sticky-header {{
    position: sticky;
    top: 0;
    z-index: 50;
    background: {BG};
    padding: 10px 0 14px 0;
    margin-bottom: 6px;
    border-bottom: 1px solid {BORDER};
}}

/* ── Stat cards ── */
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

/* ── Section label ── */
.section-label {{
    color: {MUTED};
    font-size: 9px;
    letter-spacing: 2px;
    margin-bottom: 8px;
    margin-top: 16px;
}}

/* ── Price list table ── */
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

/* ── Leader table ── */
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


def _leader_table(df: pd.DataFrame, value_col: str, value_label: str,
                  accent_col: str = None) -> str:
    rows = ""
    for i, (_, row) in enumerate(df.iterrows(), 1):
        val = row[value_col]
        if value_col == "PctChange":
            val_html = _pct_html(val)
        elif value_col == "Volume":
            val_html = f"{int(val):,}"
        else:
            val_html = _fmt_naira(val)

        sector = f"<br><span style='color:{MUTED};font-size:10px'>{row.get('Sector','')}</span>" \
                 if "Sector" in row.index else ""

        rows += (
            f"<tr>"
            f"  <td class='rank'>{i}</td>"
            f"  <td><b>{row['Symbol']}</b>{sector}</td>"
            f"  <td style='text-align:right'>₦{row['ClosePrice']:.2f}</td>"
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


def _price_list_table(df: pd.DataFrame, search: str) -> str:
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


# ── Render ────────────────────────────────────────────────────────────────────

def render():
    st.markdown(_CSS, unsafe_allow_html=True)

    # ── Date range picker ─────────────────────────────────────────────────────
    min_date, max_date = load_date_bounds()
    default_start = max(max_date - timedelta(days=90), min_date)

    ctrl_l, ctrl_r, _ = st.columns([1.6, 1.6, 5])
    with ctrl_l:
        start_date = st.date_input(
            "From", value=default_start,
            min_value=min_date, max_value=max_date,
            key="mo_start",
        )
    with ctrl_r:
        end_date = st.date_input(
            "To", value=max_date,
            min_value=min_date, max_value=max_date,
            key="mo_end",
        )

    if start_date > end_date:
        st.error("'From' date must be before 'To' date.")
        return

    end_date_str = str(end_date)

    # ── Load data ─────────────────────────────────────────────────────────────
    with st.spinner(""):
        sector_map  = load_sector_map()
        market_df   = load_latest_market(sector_map, end_date=end_date_str)
        sector_df   = load_sector_performance(end_date=end_date_str)

    if market_df.empty:
        st.warning("No market data available for the selected range.")
        return

    latest_date = market_df["TradeDate"].max()

    # ── Derived stats ─────────────────────────────────────────────────────────
    total_stocks   = len(market_df)
    total_value    = market_df["Value"].sum()
    total_volume   = market_df["Volume"].sum()
    gainers        = (market_df["PctChange"] > 0).sum()
    losers         = (market_df["PctChange"] < 0).sum()
    unchanged      = total_stocks - gainers - losers
    top_sector     = (
        sector_df.loc[sector_df["TotalValue"].idxmax(), "Sector"]
        if not sector_df.empty else "—"
    )

    # ── Sticky date range header ──────────────────────────────────────────────
    st.markdown(f"""
        <div class='sticky-header'>
            <div style='display:flex;align-items:baseline;gap:12px;
                        border-left:3px solid {ACCENT};padding-left:12px'>
                <div style='color:{TEXT};font-size:20px;font-weight:700;letter-spacing:1px'>
                    {latest_date.strftime("%d %b %Y")}
                </div>
                <div style='color:{MUTED};font-size:10px;letter-spacing:1.5px'>
                    LATEST TRADING DAY
                    &nbsp;<span style='color:{BORDER}'>|</span>&nbsp;
                    {start_date.strftime("%d %b %Y")} – {end_date.strftime("%d %b %Y")}
                </div>
            </div>
        </div>
        <div style='height:16px'></div>
    """, unsafe_allow_html=True)
    stats_html = "".join([
        _stat_card("LISTED STOCKS",   str(total_stocks),    "on NGX"),
        _stat_card("MARKET VALUE",     _fmt_naira(total_value), "total traded"),
        _stat_card("TOTAL VOLUME",    f"{int(total_volume):,}", "shares"),
        _stat_card("GAINERS",
                   f"<span style='color:{ACCENT}'>{gainers}</span>",
                   f"{losers} losers · {unchanged} unchanged"),
        _stat_card("TOP SECTOR",      top_sector, "by value"),
    ])
    st.markdown(f"<div class='stat-bar'>{stats_html}</div>",
                unsafe_allow_html=True)

    # ── Leaders row ───────────────────────────────────────────────────────────
    st.markdown("<div class='section-label'>MARKET LEADERS</div>",
                unsafe_allow_html=True)

    top_gainers  = market_df.nlargest(8, "PctChange")[
        ["Symbol", "ClosePrice", "PctChange", "Sector"]]
    top_losers   = market_df.nsmallest(8, "PctChange")[
        ["Symbol", "ClosePrice", "PctChange", "Sector"]]
    most_active  = market_df.nlargest(8, "Volume")[
        ["Symbol", "ClosePrice", "Volume", "Sector"]]

    l1, l2, l3 = st.columns(3, gap="medium")
    with l1:
        st.markdown(
            f"<div style='color:{ACCENT};font-size:10px;letter-spacing:1.5px;"
            f"margin-bottom:6px'>▲ TOP GAINERS</div>",
            unsafe_allow_html=True,
        )
        st.markdown(_leader_table(top_gainers, "PctChange", "CHG%"),
                    unsafe_allow_html=True)
    with l2:
        st.markdown(
            f"<div style='color:{RED};font-size:10px;letter-spacing:1.5px;"
            f"margin-bottom:6px'>▼ TOP LOSERS</div>",
            unsafe_allow_html=True,
        )
        st.markdown(_leader_table(top_losers, "PctChange", "CHG%"),
                    unsafe_allow_html=True)
    with l3:
        st.markdown(
            f"<div style='color:{BLUE};font-size:10px;letter-spacing:1.5px;"
            f"margin-bottom:6px'>◉ MOST ACTIVE</div>",
            unsafe_allow_html=True,
        )
        st.markdown(_leader_table(most_active, "Volume", "VOLUME"),
                    unsafe_allow_html=True)

    # ── Charts row ────────────────────────────────────────────────────────────
    st.markdown("<div class='section-label'>SECTOR OVERVIEW</div>",
                unsafe_allow_html=True)

    ch1, ch2 = st.columns([1.4, 1], gap="medium")
    with ch1:
        st.plotly_chart(sector_treemap(sector_df),
                        use_container_width=True)
    with ch2:
        st.plotly_chart(sector_bar(sector_df),
                        use_container_width=True)

    st.markdown("<div class='section-label'>MARKET SCATTER</div>",
                unsafe_allow_html=True)
    st.plotly_chart(price_change_scatter(market_df),
                    use_container_width=True)

    # ── Full price list ───────────────────────────────────────────────────────
    st.markdown("<div class='section-label'>FULL PRICE LIST</div>",
                unsafe_allow_html=True)

    search_col, sort_col, _ = st.columns([2, 2, 4])
    with search_col:
        search = st.text_input("Search Symbol", placeholder="e.g. GTCO",
                               label_visibility="collapsed")
    with sort_col:
        sort_by = st.selectbox(
            "Sort by",
            ["Symbol", "ClosePrice", "PctChange", "Volume", "Value"],
            label_visibility="collapsed",
        )

    display_df = market_df.sort_values(
        sort_by, ascending=(sort_by == "Symbol")
    ).reset_index(drop=True)

    st.markdown(
        f"<div style='max-height:480px;overflow-y:auto;border:1px solid {BORDER};"
        f"border-radius:6px;padding:0'>"
        f"{_price_list_table(display_df, search)}"
        f"</div>",
        unsafe_allow_html=True,
    )