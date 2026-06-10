# pages/deep_dive.py — Stock Deep Dive page (Streamlit)

import streamlit as st
import pandas as pd
from datetime import datetime, timedelta

import numpy as np

from config import ACCENT, RED, YELLOW, MUTED, TEXT, CARD_BG, BORDER, BG
from data.loader import load_stock_list, load_stock_data, filter_by_dates, load_date_bounds, load_range_market
from analysis.signals import get_signals, STRATEGIES
from analysis.recommender import generate_recommendation, LLM_OPTIONS
from charts.deep_dive import build_main_chart, build_signal_chart, empty_fig


# ── CSS ───────────────────────────────────────────────────────────────────────
_CSS = f"""
<style>
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;700&display=swap');

html, body, [class*="css"] {{
    font-family: 'IBM Plex Mono', monospace !important;
}}

/* ── Control bar row ── */
.ctrl-bar {{
    display: flex;
    align-items: flex-end;
    gap: 12px;
    background: {CARD_BG};
    border: 1px solid {BORDER};
    border-radius: 8px;
    padding: 10px 16px;
    margin-bottom: 12px;
    flex-wrap: wrap;
}}
.ctrl-label {{
    color: {MUTED};
    font-size: 9px;
    letter-spacing: 1.8px;
    margin-bottom: 4px;
}}

/* ── Meta stat cards ── */
.meta-bar {{
    display: flex;
    gap: 8px;
    margin-bottom: 12px;
    flex-wrap: wrap;
}}
.meta-card {{
    background: {CARD_BG};
    border: 1px solid {BORDER};
    border-radius: 6px;
    padding: 10px 16px;
    flex: 1;
    min-width: 90px;
}}
.meta-card .mc-label {{
    color: {MUTED};
    font-size: 9px;
    letter-spacing: 1.8px;
    margin-bottom: 4px;
}}
.meta-card .mc-value {{
    color: {TEXT};
    font-size: 16px;
    font-weight: 700;
    letter-spacing: 0.5px;
}}
.meta-card .mc-delta {{
    font-size: 11px;
    font-weight: 600;
    margin-top: 2px;
}}
.mc-up   {{ color: {ACCENT}; }}
.mc-down {{ color: {RED};   }}
.mc-flat {{ color: {MUTED}; }}

/* ── Recommendation box ── */
.reco-box {{
    background: {CARD_BG};
    border: 1px solid {BORDER};
    border-radius: 6px;
    padding: 16px 20px;
    line-height: 1.8;
    font-size: 13px;
    min-height: 80px;
}}
.reco-verdict {{
    font-size: 14px;
    font-weight: 700;
    margin-bottom: 6px;
}}

/* ── Section label ── */
.section-label {{
    color: {MUTED};
    font-size: 9px;
    letter-spacing: 2px;
    margin-bottom: 8px;
    margin-top: 4px;
}}

/* ── Similar stocks table ── */
.sim-wrap {{
    background: {CARD_BG};
    border: 1px solid {BORDER};
    border-radius: 8px;
    overflow: hidden;
    margin-bottom: 12px;
}}
.sim-table {{
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
}}
.sim-table th {{
    color: {MUTED};
    font-size: 9px;
    letter-spacing: 1.8px;
    padding: 8px 14px;
    text-align: left;
    border-bottom: 1px solid {BORDER};
    background: {CARD_BG};
}}
.sim-table td {{
    padding: 9px 14px;
    border-bottom: 1px solid {BORDER}55;
    color: {TEXT};
    vertical-align: middle;
}}
.sim-table tr:last-child td {{ border-bottom: none; }}
.sim-sym {{ font-weight: 700; color: {ACCENT}; letter-spacing: 0.5px; }}
.sim-score-bar {{
    display: inline-block;
    height: 5px;
    border-radius: 3px;
    background: {ACCENT};
    opacity: 0.75;
    vertical-align: middle;
    margin-right: 6px;
}}

/* Hide default metric styling bleed */
div[data-testid="metric-container"] {{ display: none !important; }}

/* Streamlit button */
div[data-testid="stButton"] > button {{
    background: transparent !important;
    border: 1px solid {ACCENT} !important;
    color: {ACCENT} !important;
    font-family: 'IBM Plex Mono', monospace !important;
    font-size: 11px !important;
    border-radius: 4px !important;
    padding: 6px 14px !important;
    width: 100%;
}}
div[data-testid="stButton"] > button:hover {{
    background: {ACCENT}22 !important;
}}

/* ── Quick-range shortcut buttons ── */
button[data-testid="baseButton-secondary"] {{
    background: transparent !important;
    border: 1px solid {BORDER} !important;
    color: {MUTED} !important;
    font-size: 10px !important;
    letter-spacing: 1px !important;
    padding: 4px 0 !important;
}}
button[data-testid="baseButton-secondary"]:hover {{
    border-color: {ACCENT} !important;
    color: {ACCENT} !important;
}}
</style>
"""


# ── Helpers ───────────────────────────────────────────────────────────────────

def _format_naira(n: float) -> str:
    if n >= 1_000_000_000:
        return f"₦{n / 1_000_000_000:.2f}B"
    if n >= 1_000_000:
        return f"₦{n / 1_000_000:.2f}M"
    return f"₦{n:,.2f}"


def _meta_bar(full_df: pd.DataFrame) -> str:
    if full_df.empty:
        return ""

    first = full_df.iloc[0]
    last  = full_df.iloc[-1]

    period_open  = float(first.get("OpeningPrice", 0) or 0)
    period_close = float(last.get("ClosePrice",    0) or 0)
    period_high  = float(full_df["HighPrice"].max()) if "HighPrice" in full_df.columns else 0
    period_low   = float(full_df["LowPrice"].min())  if "LowPrice"  in full_df.columns else 0
    total_volume = full_df["Volume"].sum() if "Volume" in full_df.columns else 0
    total_value  = full_df["Value"].sum()  if "Value"  in full_df.columns else 0
    has_trades   = "Trades" in full_df.columns
    total_trades = int(full_df["Trades"].sum()) if has_trades else None

    chg     = period_close - period_open
    chg_pct = (chg / period_open * 100) if period_open else 0
    sign    = "+" if chg > 0 else ""
    delta_cls  = "mc-up" if chg > 0 else ("mc-down" if chg < 0 else "mc-flat")
    delta_html = (
        f"<div class='mc-delta {delta_cls}'>"
        f"{sign}{chg:.2f} ({sign}{chg_pct:.2f}%)</div>"
    )

    multi = len(full_df) > 1
    pfx   = "PERIOD " if multi else ""

    def card(label, value, extra=""):
        return (
            f"<div class='meta-card'>"
            f"  <div class='mc-label'>{label}</div>"
            f"  <div class='mc-value'>{value}</div>"
            f"  {extra}"
            f"</div>"
        )

    cards = "".join([
        card("CLOSE",          f"₦{period_close:.2f}", delta_html),
        card(f"{pfx}OPEN",     f"₦{period_open:.2f}"),
        card(f"{pfx}HIGH",     f"<span class='mc-up'>₦{period_high:.2f}</span>"),
        card(f"{pfx}LOW",      f"<span class='mc-down'>₦{period_low:.2f}</span>"),
        card(f"{pfx}VOLUME",   f"{int(total_volume):,}"),
        card(f"{pfx}VALUE",    _format_naira(total_value)),
    ] + ([card("TRADES", f"{total_trades:,}")] if total_trades is not None else []))

    return f"<div class='meta-bar'>{cards}</div>"


def _reco_html(text: str) -> str:
    verdict_colors = {"BUY": ACCENT, "SELL": RED, "HOLD": YELLOW}
    verdict_html = ""
    body = text

    for v, c in verdict_colors.items():
        tag = f"Recommendation: {v}"
        if tag in text:
            verdict_html = (
                f"<div class='reco-verdict' style='color:{c}'>▶ {v}</div>"
            )
            body = text.replace(tag, "").strip()
            # Clean up "Reason:" prefix styling
            body = body.replace("Reason:", f"<span style='color:{MUTED}'>REASON —</span>")
            break

    return f"<div class='reco-box'>{verdict_html}{body}</div>"


def _find_similar(symbol: str, start_date, end_date, n: int = 6) -> pd.DataFrame:
    mkt = load_range_market(start_date, end_date)
    if mkt.empty:
        return pd.DataFrame()

    ref_row = mkt[mkt["Symbol"] == symbol]
    if ref_row.empty:
        return pd.DataFrame()

    ref = ref_row.iloc[0]
    ref_price  = float(ref.get("ClosePrice",   0) or 1)
    ref_vol    = float(ref.get("TotalVolume",  0) or 1)
    ref_val    = float(ref.get("TotalValue",   0) or 1)
    ref_sector = ref.get("Sector", "") or ""

    def _log_sim(a: float, b: float) -> float:
        if a <= 0 or b <= 0:
            return 0.0
        return max(0.0, 1.0 - abs(np.log(a / b)) / np.log(100))

    rows = []
    for _, row in mkt[mkt["Symbol"] != symbol].iterrows():
        price  = float(row.get("ClosePrice",  0) or 0)
        vol    = float(row.get("TotalVolume", 0) or 0)
        val    = float(row.get("TotalValue",  0) or 0)
        sector = row.get("Sector", "") or ""

        s_sector = 1.0 if sector == ref_sector else 0.0
        score = (
            0.35 * s_sector
            + 0.30 * _log_sim(price, ref_price)
            + 0.20 * _log_sim(val,   ref_val)
            + 0.15 * _log_sim(vol,   ref_vol)
        )
        rows.append({
            "Symbol":  row["Symbol"],
            "Sector":  sector or "—",
            "Price":   price,
            "Volume":  int(vol),
            "Value":   val,
            "Score":   round(score * 100),
        })

    df = pd.DataFrame(rows)
    return df.nlargest(n, "Score").reset_index(drop=True)


def _sim_table_html(sim_df: pd.DataFrame) -> str:
    rows_html = ""
    for _, r in sim_df.iterrows():
        bar_w = max(4, int(r["Score"] * 0.9))
        price = f"₦{r['Price']:.2f}" if r["Price"] else "—"
        vol   = f"{r['Volume']:,}"   if r["Volume"] else "—"
        val   = _format_naira(r["Value"]) if r["Value"] else "—"
        rows_html += (
            f"<tr>"
            f"<td><span class='sim-sym'>{r['Symbol']}</span></td>"
            f"<td>{r['Sector']}</td>"
            f"<td>{price}</td>"
            f"<td>{vol}</td>"
            f"<td>{val}</td>"
            f"<td>"
            f"  <span class='sim-score-bar' style='width:{bar_w}px'></span>"
            f"  {r['Score']}%"
            f"</td>"
            f"</tr>"
        )
    return (
        "<div class='sim-wrap'>"
        "<table class='sim-table'>"
        "<thead><tr>"
        "<th>SYMBOL</th><th>SECTOR</th><th>PRICE</th>"
        "<th>VOLUME</th><th>VALUE</th><th>MATCH</th>"
        "</tr></thead>"
        f"<tbody>{rows_html}</tbody>"
        "</table></div>"
    )


# ── Render ────────────────────────────────────────────────────────────────────

def render():
    st.markdown(_CSS, unsafe_allow_html=True)

    symbols = load_stock_list()
    min_date, max_date = load_date_bounds()

    # ── Row 1: stock selector (always active) ─────────────────────────────────
    s_col, hint_col = st.columns([2.2, 6])
    with s_col:
        symbol = st.selectbox(
            "STOCK", options=symbols,
            index=None, placeholder="Select symbol…",
            label_visibility="visible",
        )
    with hint_col:
        if not symbol:
            st.markdown(
                f"<div style='padding:28px 0 0 4px;color:{MUTED};"
                f"font-size:11px;letter-spacing:1px'>"
                f"← Select a stock to unlock filters</div>",
                unsafe_allow_html=True,
            )

    locked = not symbol

    # ── Row 2: chart options (disabled until stock selected) ──────────────────
    c2, c3, c4, c5 = st.columns([1.2, 2, 2, 1.8])

    with c2:
        chart_type = st.radio(
            "TYPE", ["Candle", "Line"],
            horizontal=True, index=0,
            disabled=locked,
        )
        chart_type = "candle" if chart_type == "Candle" else "line"
    with c3:
        overlays = st.multiselect(
            "OVERLAYS",
            ["SMA_50", "SMA_200", "EMA_12", "EMA_26"],
            default=[],
            format_func=lambda x: x.replace("_", " "),
            disabled=locked,
        )
    with c4:
        panels = st.multiselect(
            "PANELS", ["volume", "macd", "rsi"],
            default=["volume", "macd", "rsi"],
            format_func=str.upper,
            disabled=locked,
        )
    with c5:
        strategy = st.selectbox(
            "STRATEGY", list(STRATEGIES.keys()),
            index=0,
            disabled=locked,
        )

    # ── Row 3: date range (disabled until stock selected) ─────────────────────
    d_col1, d_col2, d_col3 = st.columns([1.6, 1.6, 4])

    
    with d_col1:
        start_date = st.date_input(
            "From", value=max(max_date - timedelta(days=90), min_date),
            min_value=min_date, max_value=max_date,
            key="dd_start", disabled=locked,
        )
    with d_col2:
        end_date = st.date_input(
            "To", value=max_date,
            min_value=min_date, max_value=max_date,
            key="dd_end", disabled=locked,
        )
    with d_col3:
        st.markdown("<div style='height:20px'></div>", unsafe_allow_html=True)
        q1, q2, q3, q4, q5 = st.columns(5)
        for col, label, days in [
            (q1, "1M", 30), (q2, "3M", 90), (q3, "6M", 180),
            (q4, "1Y", 365), (q5, "ALL", None),
        ]:
            with col:
                if st.button(label, key=f"quick_{label}",
                             use_container_width=True, disabled=locked):
                    st.session_state.dd_end   = max_date
                    st.session_state.dd_start = (
                        max_date - timedelta(days=days) if days else min_date
                    )
                    st.rerun()

    

    # ── Guards ────────────────────────────────────────────────────────────────
    if locked:
        st.plotly_chart(empty_fig("↑ Select a stock to begin"), use_container_width=True)
        return

    if start_date > end_date:
        st.error("'From' date must be before 'To' date.")
        return

    # ── Load & filter data ────────────────────────────────────────────────────
    with st.spinner(""):
        price_df_all, full_df_all = load_stock_data(symbol)

    # Keep full history for indicator computation (avoids NaN on short windows)
    price_df = filter_by_dates(price_df_all, start_date, end_date)
    full_df  = filter_by_dates(full_df_all,  start_date, end_date)

    if price_df.empty:
        st.warning("No data for selected range.")
        return

    # ── Meta bar ──────────────────────────────────────────────────────────────
    st.markdown(_meta_bar(full_df), unsafe_allow_html=True)

    # ── Drawing tools ────────────────────────────────────────────────────────
    draw_col1, draw_col2, draw_col3, draw_col4 = st.columns([1, 1.5, 1.5, 1])

    with draw_col1:
        enable_draw = st.checkbox("DRAW", value=False)

    h_line_price = None
    trendline = None
    v_line_date = None

    if enable_draw:
        current_price = float(price_df["ClosePrice"].iloc[-1]) if not price_df.empty else 0
        price_min = float(price_df["ClosePrice"].min()) if not price_df.empty else 0
        price_max = float(price_df["ClosePrice"].max()) if not price_df.empty else 100

        with draw_col2:
            h_line_price = st.number_input(
                "Horizontal Line (₦)",
                min_value=price_min,
                max_value=price_max,
                value=current_price,
                step=0.5,
            )

        with draw_col3:
            col_trend1, col_trend2 = st.columns(2)
            with col_trend1:
                tr_date1 = st.date_input("Start Date", value=start_date, key="tr_date1")
                tr_price1 = st.number_input("Start Price (₦)", value=current_price, step=0.5, key="tr_price1")
            with col_trend2:
                tr_date2 = st.date_input("End Date", value=end_date, key="tr_date2")
                tr_price2 = st.number_input("End Price (₦)", value=current_price, step=0.5, key="tr_price2")
            if tr_date1 and tr_date2:
                trendline = (str(tr_date1), tr_price1, str(tr_date2), tr_price2)

        with draw_col4:
            v_line_date = st.date_input("Vertical Line", value=None, key="v_line")

    # ── Main chart ────────────────────────────────────────────────────────────
    fig = build_main_chart(
        price_df=price_df,
        full_df=full_df,
        overlays=overlays,
        panels=panels,
        chart_type=chart_type,
        symbol=symbol,
        h_line_price=h_line_price,
        trendline=trendline,
        v_line_date=v_line_date,
    )
    st.plotly_chart(fig, use_container_width=True)

    # ── Signals + Recommendation ──────────────────────────────────────────────
    # Compute on full history so EMAs/SMAs are warm, then slice to display range
    _buy_all, _sell_all = get_signals(strategy, price_df_all)
    _s, _e = pd.to_datetime(start_date), pd.to_datetime(end_date)
    buy_df  = _buy_all[(_buy_all.index  >= _s) & (_buy_all.index  <= _e)]
    sell_df = _sell_all[(_sell_all.index >= _s) & (_sell_all.index <= _e)]

    sig_col, reco_col = st.columns([1, 1], gap="large")

    with sig_col:
        st.markdown("<div class='section-label'>SIGNAL SUMMARY</div>",
                    unsafe_allow_html=True)

        # Signal count cards
        b_color = ACCENT if len(buy_df) else MUTED
        s_color = RED    if len(sell_df) else MUTED
        st.markdown(
            f"<div class='meta-bar'>"
            f"  <div class='meta-card'>"
            f"    <div class='mc-label'>BUY SIGNALS</div>"
            f"    <div class='mc-value' style='color:{b_color}'>{len(buy_df)}</div>"
            f"  </div>"
            f"  <div class='meta-card'>"
            f"    <div class='mc-label'>SELL SIGNALS</div>"
            f"    <div class='mc-value' style='color:{s_color}'>{len(sell_df)}</div>"
            f"  </div>"
            f"  <div class='meta-card'>"
            f"    <div class='mc-label'>STRATEGY</div>"
            f"    <div class='mc-value' style='font-size:12px'>{strategy}</div>"
            f"  </div>"
            f"</div>",
            unsafe_allow_html=True,
        )

        if not buy_df.empty or not sell_df.empty:
            st.plotly_chart(
                build_signal_chart(price_df, buy_df, sell_df, symbol),
                use_container_width=True,
            )
        else:
            st.info("No signals fired in this range.")

    with reco_col:
        st.markdown("<div class='section-label'>💡 RECOMMENDATION</div>",
                    unsafe_allow_html=True)

        is_admin = st.session_state.get("auth_user", {}).get("role") == "admin"

        # ── LLM selector (non-admin only) ─────────────────────────────────────
        if is_admin:
            selected_llm = st.session_state.get("llm_provider", LLM_OPTIONS[0])
            user_api_key = None  # uses env variable
        else:
            selected_llm = st.selectbox(
                "LLM", LLM_OPTIONS,
                index=LLM_OPTIONS.index(st.session_state.get("llm_provider", LLM_OPTIONS[0])),
                key="llm_provider",
                label_visibility="visible",
            )
            user_api_key = st.text_input(
                "API Key",
                type="password",
                placeholder=f"Paste your {selected_llm.split()[0]} API key…",
                key="user_api_key",
                label_visibility="visible",
            ) or None

        if st.button("Generate / Refresh"):
            if buy_df.empty and sell_df.empty:
                st.warning("No signals to analyse.")
            elif not is_admin and not user_api_key:
                st.warning("Please enter your API key above.")
            else:
                with st.spinner(f"Consulting {selected_llm.split()[0]}…"):
                    try:
                        reco = generate_recommendation(
                            buy_signal=buy_df.to_dict(),
                            sell_signal=sell_df.to_dict(),
                            stock_details={"Stock Name": symbol,
                                           "Strategy": strategy},
                            provider=selected_llm,
                            api_key=user_api_key,
                        )
                        st.session_state[f"reco_{symbol}"] = reco
                    except Exception as e:
                        st.error(f"Error: {e}")

        reco_text = st.session_state.get(f"reco_{symbol}", "")
        if reco_text:
            st.markdown(_reco_html(reco_text), unsafe_allow_html=True)
        else:
            st.markdown(
                f"<div class='reco-box' style='color:{MUTED}'>"
                f"{'Select an LLM and enter your API key, then click Generate.' if not is_admin else 'Click Generate to get an AI recommendation.'}"
                f"</div>",
                unsafe_allow_html=True,
            )

    # ── Similar Stocks ────────────────────────────────────────────────────────
    st.markdown(
        "<div class='section-label' style='margin-top:20px'>SIMILAR STOCKS</div>",
        unsafe_allow_html=True,
    )
    with st.spinner("Finding similar stocks…"):
        sim_df = _find_similar(symbol, start_date, end_date)

    if not sim_df.empty:
        st.markdown(_sim_table_html(sim_df), unsafe_allow_html=True)
        st.markdown(
            f"<div style='color:{MUTED};font-size:9px;letter-spacing:1px;margin-bottom:16px'>"
            f"Ranked by sector match, price level, traded value and volume over the selected period."
            f"</div>",
            unsafe_allow_html=True,
        )
    else:
        st.info("No comparable stocks found for this period.")

    # ── Raw data ──────────────────────────────────────────────────────────────
    with st.expander("📋 Raw Data"):
        rawdf = full_df[["PrevClosingPrice", "OpeningPrice", "HighPrice", "LowPrice","ClosePrice", "Change", "PercChange",
              "Volume", "Value"]].copy()

        rawdf.sort_index(inplace=True, ascending=False)
        float_cols = rawdf.select_dtypes("float").columns
        st.dataframe(
            rawdf.style.format({c: "{:.2f}" for c in float_cols}),
            use_container_width=True,
        )
