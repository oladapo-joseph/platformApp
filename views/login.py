# views/login.py — login page

import streamlit as st
from config import ACCENT, MUTED, CARD_BG, BORDER, TEXT, BG, RED
from utility.auth import verify_user

_CSS = f"""
<style>
/* Hide sidebar on login page */
section[data-testid="stSidebar"] {{ display: none !important; }}

/* Centre the login card */
.login-wrap {{
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 80vh;
}}
.login-card {{
    background: {CARD_BG};
    border: 1px solid {BORDER};
    border-radius: 10px;
    padding: 40px 48px 36px 48px;
    width: 380px;
}}
.login-brand {{
    text-align: center;
    margin-bottom: 32px;
}}
.login-brand .brand-ngx {{
    color: {ACCENT};
    font-weight: 800;
    font-size: 32px;
    letter-spacing: 6px;
    line-height: 1;
}}
.login-brand .brand-sub {{
    color: {MUTED};
    font-size: 9px;
    letter-spacing: 6px;
    margin-top: 4px;
}}
.login-divider {{
    height: 1px;
    background: {BORDER};
    margin: 0 0 28px 0;
}}
.login-error {{
    background: {RED}18;
    border: 1px solid {RED}55;
    border-radius: 5px;
    color: {RED};
    font-size: 11px;
    padding: 8px 12px;
    margin-bottom: 14px;
    letter-spacing: 0.3px;
}}
</style>
"""


def render():
    st.markdown(_CSS, unsafe_allow_html=True)

    # Centre card via columns
    _, col, _ = st.columns([1, 1.4, 1])

    with col:
        st.markdown(f"""
            <div class='login-card'>
                <div class='login-brand'>
                    <div class='brand-ngx'>NGX</div>
                    <div class='brand-sub'>ANALYSER</div>
                </div>
                <div class='login-divider'></div>
            </div>
        """, unsafe_allow_html=True)

        # Error message slot
        error_slot = st.empty()

        username = st.text_input("Username", placeholder="Enter username")
        password = st.text_input("Password", placeholder="Enter password", type="password")

        st.markdown("<div style='height:6px'></div>", unsafe_allow_html=True)

        if st.button("Sign In", use_container_width=True):
            if not username or not password:
                error_slot.markdown(
                    "<div class='login-error'>Please enter both username and password.</div>",
                    unsafe_allow_html=True,
                )
            else:
                user = verify_user(username.strip(), password)
                if user:
                    st.session_state.auth_user = user
                    st.rerun()
                else:
                    error_slot.markdown(
                        "<div class='login-error'>Invalid credentials or account inactive.</div>",
                        unsafe_allow_html=True,
                    )

        st.markdown(
            f"<div style='color:{MUTED};font-size:9px;text-align:center;"
            f"margin-top:24px;letter-spacing:1.5px'>NGX ANALYSER v1.0</div>",
            unsafe_allow_html=True,
        )
