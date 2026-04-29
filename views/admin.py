# views/admin.py — admin panel

import streamlit as st
from config import ACCENT, MUTED, CARD_BG, BORDER, TEXT, RED, YELLOW
from utility.auth import list_users, create_user, set_user_active

_CSS = f"""
<style>
.admin-table {{
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
}}
.admin-table th {{
    color: {MUTED};
    font-size: 9px;
    letter-spacing: 1.5px;
    border-bottom: 1px solid {BORDER};
    padding: 8px 12px;
    text-align: left;
    font-weight: 400;
}}
.admin-table td {{
    padding: 9px 12px;
    border-bottom: 1px solid {BORDER}44;
    color: {TEXT};
    vertical-align: middle;
}}
.admin-table tr:hover td {{ background: {BORDER}55; }}
.badge-active {{
    background: {ACCENT}22;
    color: {ACCENT};
    border: 1px solid {ACCENT}55;
    border-radius: 3px;
    padding: 2px 8px;
    font-size: 9px;
    letter-spacing: 1px;
}}
.badge-revoked {{
    background: {RED}22;
    color: {RED};
    border: 1px solid {RED}55;
    border-radius: 3px;
    padding: 2px 8px;
    font-size: 9px;
    letter-spacing: 1px;
}}
.badge-admin {{
    background: {YELLOW}22;
    color: {YELLOW};
    border: 1px solid {YELLOW}55;
    border-radius: 3px;
    padding: 2px 8px;
    font-size: 9px;
    letter-spacing: 1px;
}}
</style>
"""


def render():
    st.markdown(_CSS, unsafe_allow_html=True)

    st.markdown(
        f"<div style='color:{MUTED};font-size:9px;letter-spacing:2.5px;"
        f"margin-bottom:20px'>ACCESS MANAGEMENT</div>",
        unsafe_allow_html=True,
    )

    # ── Create user ───────────────────────────────────────────────────────────
    with st.expander("➕  Create New User", expanded=False):
        c1, c2, c3, c4 = st.columns([2, 2, 1.2, 1])
        with c1:
            new_username = st.text_input("Username", key="new_username",
                                         placeholder="username")
        with c2:
            new_password = st.text_input("Password", key="new_password",
                                         type="password", placeholder="password")
        with c3:
            new_role = st.selectbox("Role", ["user", "admin"], key="new_role")
        with c4:
            st.markdown("<div style='height:28px'></div>", unsafe_allow_html=True)
            if st.button("Create", use_container_width=True):
                if not new_username or not new_password:
                    st.error("Username and password are required.")
                else:
                    ok = create_user(new_username.strip(), new_password, new_role)
                    if ok:
                        st.success(f"User '{new_username}' created.")
                        st.rerun()
                    else:
                        st.error(f"Username '{new_username}' already exists.")

    st.markdown("<div style='height:12px'></div>", unsafe_allow_html=True)

    # ── Users table ───────────────────────────────────────────────────────────
    st.markdown(
        f"<div style='color:{MUTED};font-size:9px;letter-spacing:2px;"
        f"margin-bottom:10px'>ALL USERS</div>",
        unsafe_allow_html=True,
    )

    users = list_users()
    current_user = st.session_state.auth_user["username"]

    for user in users:
        col_user, col_role, col_status, col_created, col_action = st.columns(
            [2, 1.2, 1.2, 2, 1.4]
        )
        with col_user:
            # mark current user with a suffix built outside the f-string to avoid backslashes in the expression
            is_current = user['username'] == current_user
            suffix = ('  <span style="color:' + MUTED + ';font-size:9px">(you)</span></b>') if is_current else ''
            st.markdown(
                f"<div style='font-size:12px;padding:8px 0'>"
                f"{'<b>' if is_current else ''}"
                f"{user['username']}"
                f"{suffix}"
                f"</div>",
                unsafe_allow_html=True,
            )
        with col_role:
            badge_cls = "badge-admin" if user["role"] == "admin" else ""
            st.markdown(
                f"<div style='padding:8px 0'>"
                f"<span class='{badge_cls}' style='font-size:10px'>{user['role'].upper()}</span>"
                f"</div>",
                unsafe_allow_html=True,
            )
        with col_status:
            cls = "badge-active" if user["is_active"] else "badge-revoked"
            label = "ACTIVE" if user["is_active"] else "REVOKED"
            st.markdown(
                f"<div style='padding:8px 0'><span class='{cls}'>{label}</span></div>",
                unsafe_allow_html=True,
            )
        with col_created:
            raw = user["created_at"]
            ts  = raw.strftime("%Y-%m-%d") if hasattr(raw, "strftime") else str(raw)[:10] if raw else "—"
            st.markdown(
                f"<div style='color:{MUTED};font-size:11px;padding:8px 0'>{ts}</div>",
                unsafe_allow_html=True,
            )
        with col_action:
            # Can't revoke yourself or other admins
            is_self = user["username"] == current_user
            is_admin = user["role"] == "admin"
            if not is_self and not is_admin:
                if user["is_active"]:
                    if st.button("Revoke", key=f"rev_{user['username']}",
                                 use_container_width=True):
                        set_user_active(user["username"], False)
                        st.rerun()
                else:
                    if st.button("Restore", key=f"rst_{user['username']}",
                                 use_container_width=True):
                        set_user_active(user["username"], True)
                        st.rerun()

        st.markdown(
            f"<div style='height:1px;background:{BORDER}44;margin:0'></div>",
            unsafe_allow_html=True,
        )
