# pages/deep_dive.py — Stock Deep Dive page (Streamlit)

import streamlit as st
import pandas as pd
from datetime import datetime, timedelta

from config import ACCENT, RED, YELLOW, MUTED, TEXT, CARD_BG, BORDER, BG
from data.loader import load_stock_list, load_stock_data, filter_by_dates, load_date_bounds
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


def _meta_bar(last: pd.Series) -> str:
    chg = float(last.get("Change", 0) or 0)
    pct = (chg / float(last.get("PrevClosingPrice", 1) or 1)) * 100

    sign       = "+" if chg > 0 else ""
    delta_cls  = "mc-up" if chg > 0 else ("mc-down" if chg < 0 else "mc-flat")
    delta_html = (
        f"<div class='mc-delta {delta_cls}'>"
        f"{sign}{chg:.2f} ({sign}{pct:.2f}%)</div>"
    )

    def card(label, value, extra=""):
        return (
            f"<div class='meta-card'>"
            f"  <div class='mc-label'>{label}</div>"
            f"  <div class='mc-value'>{value}</div>"
            f"  {extra}"
            f"</div>"
        )

    cards = "".join([
        card("CLOSE",  f"₦{float(last['ClosePrice']):.2f}", delta_html),
        card("OPEN",   f"₦{float(last.get('OpeningPrice', 0)):.2f}"),
        card("HIGH",   f"<span class='mc-up'>₦{float(last.get('HighPrice', 0)):.2f}</span>"),
        card("LOW",    f"<span class='mc-down'>₦{float(last.get('LowPrice', 0)):.2f}</span>"),
        card("VOLUME", f"{int(last.get('Volume', 0)):,}"),
        card("VALUE",  _format_naira(float(last.get("Value", 0)))),
        card("TRADES", f"{int(last.get('Trades', 0)):,}" if "Trades" in last.index else "—"),
    ])
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
            "From", value=max_date - timedelta(days=90),
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
        price_df, full_df = load_stock_data(symbol)

    price_df = filter_by_dates(price_df, start_date, end_date)
    full_df  = filter_by_dates(full_df,  start_date, end_date)

    if price_df.empty:
        st.warning("No data for selected range.")
        return

    # ── Meta bar ──────────────────────────────────────────────────────────────
    st.markdown(_meta_bar(full_df.iloc[-1]), unsafe_allow_html=True)

    # ── Main chart ────────────────────────────────────────────────────────────
    fig = build_main_chart(
        price_df=price_df,
        full_df=full_df,
        overlays=overlays,
        panels=panels,
        chart_type=chart_type,
        symbol=symbol,
    )
    st.plotly_chart(fig, use_container_width=True)

    # ── Signals + Recommendation ──────────────────────────────────────────────
    buy_df, sell_df = get_signals(strategy, price_df)

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
