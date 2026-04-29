# charts/market_overview.py — Plotly figures for Market Overview page

import plotly.graph_objects as go
import plotly.express as px
import pandas as pd

from config import ACCENT, RED, YELLOW, BLUE, BORDER, TEXT, MUTED, CARD_BG


def _base(fig: go.Figure, title: str = "") -> go.Figure:
    fig.update_layout(
        title=dict(text=title, font=dict(size=12, color=MUTED), x=0),
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="#0A0C10",
        font=dict(family="monospace", color=TEXT, size=11),
        margin=dict(l=8, r=8, t=40, b=8),
        legend=dict(bgcolor="rgba(0,0,0,0)", font=dict(size=10)),
    )
    fig.update_xaxes(showgrid=True, gridcolor=BORDER, linecolor=BORDER, zeroline=False)
    fig.update_yaxes(showgrid=True, gridcolor=BORDER, linecolor=BORDER, zeroline=False)
    return fig


def sector_treemap(sector_df: pd.DataFrame) -> go.Figure:
    """Treemap of sectors sized by TotalValue, coloured by AvgPctChange."""
    if sector_df.empty:
        return go.Figure()

    df = sector_df.dropna(subset=["AvgPctChange"]).copy()
    df["label"] = df.apply(
        lambda r: f"{r['Sector']}<br>{r['AvgPctChange']:+.2f}%<br>{r['StockCount']} stocks",
        axis=1,
    )

    fig = go.Figure(go.Treemap(
        labels=df["label"],
        parents=[""] * len(df),
        values=df["TotalValue"],
        customdata=df[["AvgPctChange", "StockCount", "TotalValue"]],
        textinfo="label",
        hovertemplate=(
            "<b>%{label}</b><br>"
            "Avg Change: %{customdata[0]:+.2f}%<br>"
            "Stocks: %{customdata[1]}<br>"
            "Value: ₦%{customdata[2]:,.0f}<extra></extra>"
        ),
        marker=dict(
            colors=df["AvgPctChange"],
            colorscale=[[0, RED], [0.5, "#1E2330"], [1, ACCENT]],
            cmid=0,
            showscale=True,
            colorbar=dict(
                thickness=10,
                tickfont=dict(size=9, color=MUTED),
                outlinewidth=0,
            ),
        ),
    ))
    fig.update_layout(
        paper_bgcolor="rgba(0,0,0,0)",
        font=dict(family="monospace", color=TEXT, size=11),
        margin=dict(l=0, r=0, t=8, b=0),
    )
    return fig


def sector_bar(sector_df: pd.DataFrame) -> go.Figure:
    """Horizontal bar chart of sector avg % change."""
    if sector_df.empty:
        return go.Figure()

    df = sector_df.sort_values("AvgPctChange").copy()
    colors = [ACCENT if v >= 0 else RED for v in df["AvgPctChange"]]

    fig = go.Figure(go.Bar(
        x=df["AvgPctChange"],
        y=df["Sector"],
        orientation="h",
        marker_color=colors,
        text=df["AvgPctChange"].apply(lambda v: f"{v:+.2f}%"),
        textposition="outside",
        textfont=dict(size=10),
        hovertemplate="<b>%{y}</b><br>Avg Change: %{x:+.2f}%<extra></extra>",
    ))
    _base(fig, "SECTOR PERFORMANCE")
    fig.update_layout(
        yaxis=dict(showgrid=False),
        xaxis=dict(zeroline=True, zerolinecolor=BORDER, zerolinewidth=1),
        margin=dict(l=8, r=48, t=40, b=8),
    )
    return fig


def volume_leaders_bar(market_df: pd.DataFrame, top_n: int = 10) -> go.Figure:
    """Bar chart of top N stocks by volume."""
    df = (
        market_df[["Symbol", "Volume"]]
        .dropna()
        .nlargest(top_n, "Volume")
        .sort_values("Volume")
    )
    fig = go.Figure(go.Bar(
        x=df["Volume"],
        y=df["Symbol"],
        orientation="h",
        marker_color=BLUE,
        opacity=0.85,
        hovertemplate="<b>%{y}</b><br>Volume: %{x:,}<extra></extra>",
    ))
    _base(fig, f"TOP {top_n} BY VOLUME")
    fig.update_layout(yaxis=dict(showgrid=False))
    return fig


def price_change_scatter(market_df: pd.DataFrame) -> go.Figure:
    """Bubble scatter: x=ClosePrice, y=PctChange, size=Volume."""
    df = market_df.dropna(subset=["PctChange", "ClosePrice", "Volume"]).copy()
    df = df[df["Volume"] > 0]
    colors = [ACCENT if v >= 0 else RED for v in df["PctChange"]]

    fig = go.Figure(go.Scatter(
        x=df["ClosePrice"],
        y=df["PctChange"],
        mode="markers",
        marker=dict(
            size=df["Volume"].apply(lambda v: max(4, min(30, v ** 0.3))),
            color=colors,
            opacity=0.7,
            line=dict(width=0),
        ),
        text=df["Symbol"],
        customdata=df[["Symbol", "ClosePrice", "PctChange", "Volume"]],
        hovertemplate=(
            "<b>%{customdata[0]}</b><br>"
            "Price: ₦%{customdata[1]:.2f}<br>"
            "Change: %{customdata[2]:+.2f}%<br>"
            "Volume: %{customdata[3]:,}<extra></extra>"
        ),
    ))
    _base(fig, "PRICE vs % CHANGE  (bubble = volume)")
    fig.add_hline(y=0, line_dash="dot", line_color=BORDER, line_width=1)
    return fig