# app.py — entry point and page router

import streamlit as st

st.set_page_config(
    page_title="EquityLens NG",
    page_icon="📈",
    layout="wide",
    initial_sidebar_state="expanded",
)

from config import ACCENT, MUTED, CARD_BG, BORDER, TEXT, BG, RED
from utility.auth import init_users_collection
from views.login import render as login_page
from views.deep_dive import render as deep_dive_page
from views.market_overview import render as market_overview_page
from views.admin import render as admin_page

# Ensure users table + default admin exist
init_users_collection()

# ── Global CSS ────────────────────────────────────────────────────────────────
st.markdown(f"""
<style>
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500;700&display=swap');

html, body, [class*="css"] {{
    font-family: 'IBM Plex Mono', monospace !important;
    background: {BG} !important;
}}

/* ── Sidebar shell ── */
section[data-testid="stSidebar"] {{
    background: {CARD_BG} !important;
    border-right: 1px solid {BORDER} !important;
    min-width: 210px !important;
    max-width: 210px !important;
}}

section[data-testid="stSidebar"] > div:first-child {{
    padding: 0 !important;
}}

/* ── Radio widget container ── */
section[data-testid="stSidebar"] div[data-testid="stRadio"] {{
    width: 100%;
}}

section[data-testid="stSidebar"] div[data-testid="stRadio"] > div {{
    gap: 0 !important;
    flex-direction: column !important;
}}

/* ── Each nav item ── */
section[data-testid="stSidebar"] div[data-testid="stRadio"] label {{
    display: flex !important;
    align-items: center !important;
    gap: 10px !important;
    padding: 11px 20px !important;
    margin: 0 !important;
    cursor: pointer !important;
    border-left: 3px solid transparent !important;
    border-radius: 0 !important;
    color: {MUTED} !important;
    font-size: 12px !important;
    letter-spacing: 0.5px !important;
    transition: color 0.15s, background 0.15s, border-color 0.15s !important;
    width: 100% !important;
}}

section[data-testid="stSidebar"] div[data-testid="stRadio"] label:hover {{
    color: {TEXT} !important;
    background: {BORDER}70 !important;
    border-left-color: {BORDER} !important;
}}

/* Hide radio circles */
section[data-testid="stSidebar"] div[data-testid="stRadio"] label > div:first-child {{
    display: none !important;
}}

/* Active nav item */
section[data-testid="stSidebar"] div[data-testid="stRadio"] label:has(input:checked) {{
    color: {ACCENT} !important;
    background: {ACCENT}14 !important;
    border-left-color: {ACCENT} !important;
    font-weight: 500 !important;
}}

/* ── Hide collapse button ── */
button[data-testid="collapsedControl"] {{
    display: none;
}}

/* ── Sidebar scrollbar ── */
section[data-testid="stSidebar"] ::-webkit-scrollbar {{ width: 3px; }}
section[data-testid="stSidebar"] ::-webkit-scrollbar-track {{ background: transparent; }}
section[data-testid="stSidebar"] ::-webkit-scrollbar-thumb {{
    background: {BORDER};
    border-radius: 2px;
}}

/* ── Main content padding ── */
.main .block-container {{
    padding-top: 1rem !important;
    padding-bottom: 1rem !important;
    max-width: 100% !important;
}}

/* ── Sign out button ── */
button[data-testid="baseButton-secondary"][kind="secondary"]#logout,
section[data-testid="stSidebar"] button[key="logout"],
section[data-testid="stSidebar"] div[data-testid="stButton"]:last-of-type > button {{
    background: {RED}18 !important;
    border: 1px solid {RED}55 !important;
    color: {RED} !important;
    font-family: 'IBM Plex Mono', monospace !important;
    font-size: 10px !important;
    letter-spacing: 1.5px !important;
    border-radius: 4px !important;
    padding: 7px 12px !important;
    width: 100% !important;
    transition: background 0.15s, border-color 0.15s !important;
}}
section[data-testid="stSidebar"] div[data-testid="stButton"]:last-of-type > button:hover {{
    background: {RED}30 !important;
    border-color: {RED} !important;
}}
</style>
""", unsafe_allow_html=True)

# ── Auth gate ─────────────────────────────────────────────────────────────────
if "auth_user" not in st.session_state:
    login_page()
    st.stop()

user     = st.session_state.auth_user
is_admin = user["role"] == "admin"

# ── Build page list based on role ─────────────────────────────────────────────
PAGES = {
    "Market Overview": ("🌍", market_overview_page),
    "Stock Deep Dive":  ("📈", deep_dive_page),
}
if is_admin:
    PAGES["Admin Panel"] = ("⚙️", admin_page)

# ── Sidebar ───────────────────────────────────────────────────────────────────
with st.sidebar:
    # Branding
    st.markdown(f"""
        <div style='padding:0px 20px 16px 0px'>
            <div style='color:{ACCENT};font-weight:800;font-size:22px;
                        letter-spacing:3px;line-height:1'>EquityLens</div>
            <div style='color:{MUTED};font-size:8px;letter-spacing:5px;
                        margin-top:3px;font-weight:500;font-size:12px'>NG</div>
        </div>
        <div style='height:1px;background:{BORDER};margin:0 0 8px 0'></div>
        <div style='color:{MUTED};font-size:8px;letter-spacing:2.5px;
                    padding:6px 20px 4px 20px'>NAVIGATION</div>
    """, unsafe_allow_html=True)

    selected = st.radio(
        "nav",
        list(PAGES.keys()),
        format_func=lambda x: f"{PAGES[x][0]}  {x}",
        label_visibility="hidden",
    )

    st.markdown("<div style='height:200px'></div>", unsafe_allow_html=True)

    # ── User card ─────────────────────────────────────────────────────────────
    role_color    = ACCENT if is_admin else MUTED
    role_label    = "ADMIN" if is_admin else "USER"
    avatar_letter = user["username"][0].upper()

    st.markdown(f"""
        <div style='border-top:1px solid {BORDER};padding:14px 16px 10px 16px'>
            <div style='display:flex;align-items:center;gap:10px'>
                <div style='width:30px;height:30px;border-radius:50%;flex-shrink:0;
                            background:{ACCENT}22;border:1px solid {ACCENT}55;
                            display:flex;align-items:center;justify-content:center;
                            color:{ACCENT};font-size:12px;font-weight:700'>
                    {avatar_letter}
                </div>
                <div>
                    <div style='color:{TEXT};font-size:12px;font-weight:500'>
                        {user["username"]}
                    </div>
                    <div style='display:flex;align-items:center;gap:5px;margin-top:2px'>
                        <div style='width:5px;height:5px;border-radius:50%;
                                    background:{ACCENT};
                                    box-shadow:0 0 5px {ACCENT}99'></div>
                        <span style='color:{role_color};font-size:9px;
                                     letter-spacing:1.5px'>{role_label}</span>
                    </div>
                </div>
            </div>
        </div>
    """, unsafe_allow_html=True)

    # ── Sign out ──────────────────────────────────────────────────────────────
    st.markdown("<div style='padding:0 16px 16px 16px'>", unsafe_allow_html=True)
    if st.button("⏻  SIGN OUT", key="logout", use_container_width=True):
        del st.session_state.auth_user
        st.rerun()
    st.markdown("</div>", unsafe_allow_html=True)

# ── Render page ───────────────────────────────────────────────────────────────
PAGES[selected][1]()
