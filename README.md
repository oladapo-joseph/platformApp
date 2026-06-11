# EquityLens NG — Market Intelligence Dashboard

A Streamlit-based technical analysis dashboard for equities listed on the **Nigerian Exchange (NGX)**. Real-time data from MongoDB Atlas (shared with the ngxPro crawler). Indicators computed in pure pandas; trading signals from rule-based strategies; AI recommendations via Claude.

**Features:**

- 📊 Real-time market overview & sector analysis
- 🔍 Deep-dive stock analysis with custom date ranges
- 📈 5 technical indicators (SMA, EMA, RSI, MACD, Bollinger Bands)
- 🎯 3 trading signal strategies (MACD, RSI, SMA Crossover)
- 🤖 AI-powered buy/sell recommendations (Claude)
- 🔐 Role-based authentication (admin/user)

---

## Architecture

```text
app.py  (st.set_page_config + sidebar router + auth gate)
  │
  ├── views/login.py                  (Login + password verification)
  │
  ├── views/market_overview.py        (Daily market snapshot)
  │   ├── charts/market_overview.py   (Plotly figures)
  │   └── data/loader.py              (MongoDB queries, cached)
  │
  └── views/deep_dive.py              (Stock analysis + signals + AI)
      ├── charts/deep_dive.py         (Candlestick, signal, summary charts)
      ├── data/loader.py              (OHLCV data, date bounds)
      ├── data/indicators.py          (SMA, EMA, RSI, MACD, Bollinger Bands)
      ├── analysis/signals.py         (Buy/sell signal generation)
      └── analysis/recommender.py     (Direct Anthropic SDK — claude-sonnet-4-6)
```

**Database:** MongoDB Atlas collection `tradesData` (shared with ngxPro crawler pipeline)

**Layer rules:**

- `app.py` — Page routing, session state, auth gate only
- `views/` — Streamlit rendering only; no chart building, no direct queries
- `charts/` — Accept DataFrames, return Plotly `go.Figure`; no `st.*` calls
- `data/loader.py` — All MongoDB queries, cached with `@st.cache_data`
- `data/indicators.py` — Stateless pandas functions; no I/O or side effects
- `analysis/signals.py` — Strategy functions return `(buy_df, sell_df)`; registered in `STRATEGIES` dict
- `analysis/recommender.py` — Anthropic SDK for AI recommendations; no LangChain
- `utility/auth.py` — MongoDB-backed auth with PBKDF2-HMAC password hashing
- `config.py` — Colors, layout defaults, constants

---

## Authentication

Login gate backed by MongoDB (`users` collection). Default admin account created on first run:

| Field | Value |
| --- | --- |
| Username | `ADMIN_USERNAME` from `.env` (default: `admin`) |
| Password | `ADMIN_PASSWORD` from `.env` (default: `admin123`) |
| Role | `admin` |

**Security:** Passwords hashed with PBKDF2-HMAC-SHA256 (no plaintext storage).

**Admin features:** Create/deactivate users, manage roles, view audit logs.

---

## Technical Indicators

All computed in `data/indicators.py` using `ClosePrice`:

| Indicator | Windows | Notes |
| --- | --- | --- |
| SMA | 50, 200 | `rolling().mean()` |
| EMA | 12, 26 | `ewm(span, adjust=False)` — always `adjust=False` |
| RSI | 14 | Wilder's EWM: `ewm(com=13, adjust=False)` — never simple rolling |
| MACD | 12, 26, 9 | MACD line + signal line + histogram |
| Bollinger Bands | 20, ±2σ | Upper + lower bands |

Use `add_all_indicators(df)` to compute all at once.

---

## Trading Strategies

Defined in `analysis/signals.py`. Each function returns `(buy_df, sell_df)` and is registered in the `STRATEGIES` dict for UI dispatch.

| Strategy | Buy Condition | Sell Condition |
| --- | --- | --- |
| `macd_signals` | MACD crosses above signal line | MACD crosses below signal line |
| `rsi_signals` | RSI crosses up through 30 (oversold) | RSI crosses down through 70 (overbought) |
| `sma_crossover_signals` | SMA 50 crosses above SMA 200 (golden cross) | SMA 50 crosses below SMA 200 (death cross) |

---

## AI Recommendations

Stock recommendations are generated via the **Anthropic SDK directly** (`claude-sonnet-4-6`, `max_tokens=200`). LangChain has been removed.

```python
# analysis/recommender.py
import anthropic

_client = None

def _get_client():
    global _client
    if _client is None:
        _client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    return _client

def generate_recommendation(buy_signal, sell_signal, stock_details, **_kwargs) -> str:
    prompt = _TEMPLATE.format(
        buy_signal=buy_signal,
        sell_signal=sell_signal,
        stock_details=stock_details,
    )
    response = _get_client().messages.create(
        model="claude-sonnet-4-6",
        max_tokens=200,
        system=_SYSTEM,
        messages=[{"role": "user", "content": prompt}],
    )
    return response.content[0].text.strip()
```

**Caching:** Result cached in `st.session_state` until user clicks **Generate / Refresh**.

---

## Tech Stack

| Component | Library | Notes |
| --- | --- | --- |
| UI | Streamlit ≥ 1.35 | |
| Charts | Plotly ≥ 5.22 | Client-side rendering |
| Data | pandas + pymongo | ≥ 2.0, ≥ 4.0 |
| Indicators | Pure pandas | No external TA libraries |
| AI | `anthropic` SDK — `claude-sonnet-4-6` | Direct SDK; no LangChain |
| Auth | pymongo + hashlib (PBKDF2-HMAC) | Built-in |
| Config | python-dotenv + pytz | |

---

## Setup

### 1. Create a virtual environment

```bash
cd platformApp
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # Mac/Linux
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

### 3. Configure environment

Create `platformApp/.env`:

```env
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/
MONGODB_DB=ngx
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_password
ANTHROPIC_API_KEY=your_anthropic_key
```

### 4. Run

```bash
streamlit run app.py
# → http://localhost:8501
```

First login: `admin` / `admin123` (or values from `.env`).

---

## Known Issues & Fixes

| Issue | Status | Fix |
| --- | --- | --- |
| Date range crash on single-day database | ✅ Fixed | Clamp default with `max(max_date - timedelta(days=90), min_date)` |
| Login page card fixed width | ✅ Fixed | CSS uses `width: 100%; box-sizing: border-box;` |
| Period totals inaccurate | ✅ Fixed | `$dateToString($fetched_at)` grouping instead of `$substr($TradeDate)` |
| NaN crash in sector cards | ✅ Fixed | `math.isnan()` filter before computing bar widths |
| `AttributeError: 'float' has no attribute 'strip'` | ✅ Fixed | `_s()` helper strips only when value is a string |

---

## Troubleshooting

### MongoDB connection timeout

```bash
python -c "from pymongo import MongoClient; print(MongoClient('YOUR_URI').admin.command('ping'))"
```

Check `MONGODB_URI` in `.env` and allow your IP in MongoDB Atlas Network Access.

### No data in date range

- Verify `MONGODB_DB` is correct
- Confirm ngxPro crawler is running and populating `tradesData`
- Check `fetched_at` field exists in documents

### Claude recommendation fails

- Verify `ANTHROPIC_API_KEY` is valid and has quota
- Check `analysis/recommender.py` is using the `anthropic` SDK (not LangChain)

### Stale data in UI

All queries are cached with `@st.cache_data`. Click the **Clear Cache** button in the Streamlit menu or restart the app to force fresh data.

---

## Adding a New Trading Strategy

1. Create function in `analysis/signals.py`:

```python
def my_strategy(df: pd.DataFrame) -> tuple:
    """Returns (buy_df, sell_df)"""
    buy_signals  = df[...]
    sell_signals = df[...]
    return buy_signals, sell_signals
```

2. Register in `STRATEGIES`:

```python
STRATEGIES = {
    "My Strategy": my_strategy,
    ...
}
```

The strategy automatically appears in the Deep Dive "Strategy" dropdown.

---

## Adding a New Page

1. Create `views/my_page.py` with a `render()` function
2. Add to sidebar router in `app.py`:

```python
if page == "My Page":
    from views.my_page import render
    render()
```

---

## Resources

- [Streamlit docs](https://docs.streamlit.io)
- [Plotly reference](https://plotly.com/python/)
- [MongoDB aggregation](https://www.mongodb.com/docs/manual/reference/operator/aggregation/)
- [Anthropic API](https://docs.anthropic.com)

---

**Last updated:** June 2026 | **Status:** Production ✅
