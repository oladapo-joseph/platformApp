# charts/deep_dive.py — Plotly figure builders for Stock Deep Dive page

import plotly.graph_objects as go
from plotly.subplots import make_subplots
import pandas as pd

from config import (
    ACCENT, RED, YELLOW, BLUE, BORDER, TEXT, MUTED,
    OVERLAY_COLORS,
)
from data.indicators import add_all_indicators


# ── Shared layout helpers ─────────────────────────────────────────────────────
# Never spread PLOTLY_BASE dict into update_layout — apply each property
# explicitly so callers can never produce duplicate keyword argument errors.

def _apply_base(fig: go.Figure, title: str = "") -> go.Figure:
    """Apply base layout to a single-panel figure."""
    fig.update_layout(
        title=title,
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="#0A0C10",
        font=dict(family="monospace", color=TEXT, size=11),
        margin=dict(l=8, r=8, t=36, b=8),
        hovermode="x unified",
        legend=dict(
            bgcolor="rgba(0,0,0,0)",
            bordercolor=BORDER,
            borderwidth=1,
            font=dict(size=10),
            orientation="h",
            y=1.02,
            x=0,
        ),
    )
    fig.update_xaxes(
        showgrid=True, gridcolor=BORDER, linecolor=BORDER,
        zeroline=False, rangeslider_visible=False,
    )
    fig.update_yaxes(
        showgrid=True, gridcolor=BORDER, linecolor=BORDER, zeroline=False,
    )
    return fig


def _apply_base_subplots(fig: go.Figure, n_rows: int) -> go.Figure:
    """Apply base layout to a multi-row subplot figure."""
    fig.update_layout(
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="#0A0C10",
        font=dict(family="monospace", color=TEXT, size=11),
        margin=dict(l=8, r=8, t=36, b=8),
        hovermode="x unified",
        showlegend=True,
        legend=dict(
            bgcolor="rgba(0,0,0,0)",
            bordercolor=BORDER,
            borderwidth=1,
            font=dict(size=10),
            orientation="h",
            y=1.02,
            x=0,
        ),
    )
    for i in range(1, n_rows + 1):
        fig.update_xaxes(
            showgrid=True, gridcolor=BORDER, linecolor=BORDER,
            zeroline=False, rangeslider_visible=False, row=i, col=1,
        )
        fig.update_yaxes(
            showgrid=True, gridcolor=BORDER, linecolor=BORDER,
            zeroline=False, row=i, col=1,
        )
    for ann in fig.layout.annotations:
        ann.font = dict(size=9, color=MUTED, family="monospace")
    return fig


# ── Empty placeholder ─────────────────────────────────────────────────────────

def empty_fig(msg: str = "Select a stock to begin") -> go.Figure:
    fig = go.Figure()
    fig.update_layout(
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="#0A0C10",
        font=dict(family="monospace", color=TEXT, size=11),
        margin=dict(l=0, r=0, t=0, b=0),
        xaxis=dict(visible=False),
        yaxis=dict(visible=False),
        annotations=[dict(
            text=msg, x=0.5, y=0.5, showarrow=False,
            font=dict(size=13, color=MUTED),
            xref="paper", yref="paper",
        )],
    )
    return fig


# ── Main composite chart ──────────────────────────────────────────────────────

def build_main_chart(
    price_df: pd.DataFrame,
    full_df: pd.DataFrame,
    overlays: list[str],
    panels: list[str],
    chart_type: str,
    symbol: str,
) -> go.Figure:
    """
    Composite chart: price (candle/line) + optional overlays + sub-panels.

    panels:     any subset of ["volume", "macd", "rsi"]
    overlays:   any subset of ["SMA_50", "SMA_200", "EMA_12", "EMA_26"]
    chart_type: "candle" | "line"
    """
    if price_df.empty:
        return empty_fig("No data for selected range")

    active_panels  = [p for p in ["volume", "macd", "rsi"] if p in panels]
    n_rows         = 1 + len(active_panels)
    row_heights    = (
        [0.55] + [0.45 / len(active_panels)] * len(active_panels)
        if active_panels else [1.0]
    )
    subplot_titles = [symbol] + [p.upper() for p in active_panels]

    fig = make_subplots(
        rows=n_rows, cols=1,
        shared_xaxes=True,
        row_heights=row_heights,
        vertical_spacing=0.03,
        subplot_titles=subplot_titles,
    )

    # ── Row 1: Price ──────────────────────────────────────────────────────────
    ohlc_cols = {"OpeningPrice", "HighPrice", "LowPrice", "ClosePrice"}
    if chart_type == "candle" and ohlc_cols.issubset(full_df.columns):
        fig.add_trace(go.Candlestick(
            x=full_df.index,
            open=full_df["OpeningPrice"],
            high=full_df["HighPrice"],
            low=full_df["LowPrice"],
            close=full_df["ClosePrice"],
            name="Price",
            increasing_line_color=ACCENT,
            decreasing_line_color=RED,
            increasing_fillcolor=ACCENT,
            decreasing_fillcolor=RED,
            whiskerwidth=0.4,
        ), row=1, col=1)
    else:
        fig.add_trace(go.Scatter(
            x=price_df.index, y=price_df["ClosePrice"],
            mode="lines", name="Close",
            line=dict(color=ACCENT, width=1.5),
        ), row=1, col=1)

    # Buy / Sell signal markers on price row
    from analysis.signals import get_signals
    buy_df, sell_df = get_signals("MACD Crossover", price_df)
    if not buy_df.empty:
        fig.add_trace(go.Scatter(
            x=buy_df.index, y=buy_df["ClosePrice"],
            mode="markers", name="Buy",
            marker=dict(color=ACCENT, symbol="triangle-up", size=9,
                        line=dict(color="#0D0F14", width=1)),
        ), row=1, col=1)
    if not sell_df.empty:
        fig.add_trace(go.Scatter(
            x=sell_df.index, y=sell_df["ClosePrice"],
            mode="markers", name="Sell",
            marker=dict(color=RED, symbol="triangle-down", size=9,
                        line=dict(color="#0D0F14", width=1)),
        ), row=1, col=1)

    # Overlays (SMA / EMA)
    if overlays:
        ind_df = add_all_indicators(full_df)
        for col in overlays:
            if col in ind_df.columns:
                fig.add_trace(go.Scatter(
                    x=ind_df.index, y=ind_df[col],
                    mode="lines",
                    name=col.replace("_", " "),
                    line=dict(color=OVERLAY_COLORS.get(col, "#aaa"),
                              width=1.1, dash="dot"),
                ), row=1, col=1)

    # ── Sub-panels ────────────────────────────────────────────────────────────
    ind_full = add_all_indicators(full_df)

    for idx, panel in enumerate(active_panels, start=2):

        if panel == "volume" and "Volume" in full_df.columns:
            bar_colors = [
                ACCENT if c >= 0 else RED
                for c in full_df["Change"].fillna(0)
            ]
            fig.add_trace(go.Bar(
                x=full_df.index, y=full_df["Volume"],
                name="Volume", marker_color=bar_colors, opacity=0.7,
            ), row=idx, col=1)

        elif panel == "macd":
            hist = ind_full.get("MACD_Histogram", pd.Series(dtype=float))
            if not hist.empty:
                fig.add_trace(go.Bar(
                    x=ind_full.index, y=hist,
                    name="Histogram",
                    marker_color=[ACCENT if v >= 0 else RED for v in hist.fillna(0)],
                    opacity=0.6,
                ), row=idx, col=1)
            if "MACD" in ind_full.columns:
                fig.add_trace(go.Scatter(
                    x=ind_full.index, y=ind_full["MACD"],
                    mode="lines", name="MACD",
                    line=dict(color=BLUE, width=1.2),
                ), row=idx, col=1)
            if "Signal_Line" in ind_full.columns:
                fig.add_trace(go.Scatter(
                    x=ind_full.index, y=ind_full["Signal_Line"],
                    mode="lines", name="Signal",
                    line=dict(color=YELLOW, width=1.2),
                ), row=idx, col=1)

        elif panel == "rsi" and "RSI_14" in ind_full.columns:
            fig.add_trace(go.Scatter(
                x=ind_full.index, y=ind_full["RSI_14"],
                mode="lines", name="RSI 14",
                line=dict(color=YELLOW, width=1.2),
            ), row=idx, col=1)
            for level, color in [(70, RED), (50, MUTED), (30, ACCENT)]:
                fig.add_hline(
                    y=level, line_dash="dot",
                    line_color=color, line_width=0.8,
                    row=idx, col=1,
                )

    return _apply_base_subplots(fig, n_rows)


# ── Buy / Sell signal chart ───────────────────────────────────────────────────

def build_signal_chart(
    price_df: pd.DataFrame,
    buy_df: pd.DataFrame,
    sell_df: pd.DataFrame,
    symbol: str,
) -> go.Figure:
    """Standalone price chart with buy/sell markers."""
    fig = go.Figure()

    fig.add_trace(go.Scatter(
        x=price_df.index, y=price_df["ClosePrice"],
        mode="lines", name="Close",
        line=dict(color=ACCENT, width=1.4),
    ))
    if not buy_df.empty:
        fig.add_trace(go.Scatter(
            x=buy_df.index, y=buy_df["ClosePrice"],
            mode="markers", name="Buy",
            marker=dict(color=ACCENT, symbol="triangle-up", size=10,
                        line=dict(color=ACCENT, width=1)),
        ))
    if not sell_df.empty:
        fig.add_trace(go.Scatter(
            x=sell_df.index, y=sell_df["ClosePrice"],
            mode="markers", name="Sell",
            marker=dict(color=RED, symbol="triangle-down", size=10,
                        line=dict(color=RED, width=1)),
        ))

    return _apply_base(fig, title=f"{symbol} — Buy / Sell Signals")
