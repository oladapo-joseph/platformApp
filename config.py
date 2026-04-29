# config.py — single source of truth for colours and constants

ACCENT  = "#00C896"
RED     = "#FF4D6D"
YELLOW  = "#FFD166"
PURPLE  = "#A78BFA"
BLUE    = "#60A5FA"

BG          = "#0D0F14"
CARD_BG     = "#13161D"
BORDER      = "#1E2330"
TEXT        = "#E8EAF0"
MUTED       = "#6B7280"

# Plotly shared layout defaults
PLOTLY_BASE = dict(
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
    xaxis=dict(showgrid=True, gridcolor=BORDER, linecolor=BORDER,
               zeroline=False, rangeslider=dict(visible=False)),
    yaxis=dict(showgrid=True, gridcolor=BORDER, linecolor=BORDER, zeroline=False),
)

OVERLAY_COLORS = {
    "SMA_50":  YELLOW,
    "SMA_200": "#FF9F1C",
    "EMA_12":  PURPLE,
    "EMA_26":  BLUE,
}

# MACD default windows
MACD_SHORT  = 12
MACD_LONG   = 26
MACD_SIGNAL = 9
