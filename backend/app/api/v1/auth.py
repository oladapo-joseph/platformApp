from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends, Request, Response

from app.api.deps import (
    clear_session_cookie,
    request_meta,
    require_session,
    require_user,
    settings_of,
    start_session_cookie,
)
from app.core import security
from app.schemas.auth import (
    Accepted,
    CsrfToken,
    DeleteMe,
    ForgotRequest,
    LoginRequest,
    Me,
    ResetRequest,
    SignupRequest,
    TokenRequest,
    UpdateMe,
)
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])

SENT = "If that email has an account, we've sent a link to it."


@router.get("/csrf", response_model=CsrfToken, summary="Get the CSRF token (also set as the el_csrf cookie)")
def csrf(request: Request, response: Response) -> dict[str, str]:
    settings = settings_of(request)
    token = request.cookies.get(settings.csrf_cookie)
    secret = settings.session_secret.get_secret_value()  # type: ignore[union-attr]
    if not token or not security.valid_csrf(secret, token, token):
        token = security.new_csrf_token(secret)
        response.set_cookie(
            settings.csrf_cookie, token, httponly=False, secure=settings.secure_cookies, samesite="lax", path="/"
        )
    return {"csrf_token": token}


@router.post("/login", response_model=Me, summary="Sign in with email or legacy username")
def login(body: LoginRequest, request: Request, response: Response) -> dict[str, Any]:
    settings = settings_of(request)
    user = auth_service.login(body.identifier, body.password, request_meta(request), settings)
    session = auth_service.start_session(user, body.remember, request_meta(request), settings)
    start_session_cookie(request, response, session, settings)
    return auth_service.public_user(user)


@router.post("/logout", status_code=204, summary="Sign out of this device")
def logout(
    request: Request, response: Response, user: dict = Depends(require_user), session: dict = Depends(require_session)
) -> Response:
    auth_service.logout(session, user, request_meta(request))
    clear_session_cookie(response, settings_of(request))
    response.status_code = 204
    return response


@router.post("/logout-all", status_code=204, summary="Sign out of every device, this one included")
def logout_all(request: Request, response: Response, user: dict = Depends(require_user)) -> Response:
    auth_service.logout_all(user, request_meta(request))
    clear_session_cookie(response, settings_of(request))
    response.status_code = 204
    return response


@router.get("/me", response_model=Me, summary="The signed-in user")
def me(user: dict = Depends(require_user)) -> dict[str, Any]:
    return auth_service.public_user(user)


@router.patch("/me", response_model=Me, summary="Update name, theme, add or change email, change password")
def update_me(
    body: UpdateMe, request: Request, user: dict = Depends(require_user), session: dict = Depends(require_session)
) -> dict[str, Any]:
    updated = auth_service.update_me(
        user, session, request_meta(request), settings_of(request), **body.model_dump(exclude_unset=True)
    )
    return auth_service.public_user(updated)


@router.delete("/me", status_code=204, summary="Delete my account (type your email to confirm)")
def delete_me(body: DeleteMe, request: Request, response: Response, user: dict = Depends(require_user)) -> Response:
    auth_service.delete_me(user, body.confirm, request_meta(request))
    clear_session_cookie(response, settings_of(request))
    response.status_code = 204
    return response


@router.post(
    "/password/forgot",
    status_code=202,
    response_model=Accepted,
    summary="Email a reset link (same answer whether or not the email has an account)",
)
def forgot(body: ForgotRequest, request: Request, background: BackgroundTasks) -> dict[str, str]:
    email = auth_service.forgot_password(body.email, request_meta(request), settings_of(request))
    if email is not None:
        background.add_task(auth_service.notify, email)  # after the response: same timing for every address
    return {"message": SENT}


@router.post("/password/reset", response_model=Me, summary="Set a new password from a reset link; signs in")
def reset(body: ResetRequest, request: Request, response: Response) -> dict[str, Any]:
    settings = settings_of(request)
    user = auth_service.reset_password(body.token, body.password, request_meta(request), settings)
    start_session_cookie(
        request, response, auth_service.start_session(user, True, request_meta(request), settings), settings
    )
    return auth_service.public_user(user)


@router.post("/verify-email", response_model=Me, summary="Confirm an email address from its link")
def verify_email(body: TokenRequest, request: Request) -> dict[str, Any]:
    return auth_service.public_user(auth_service.verify_email(body.token, request_meta(request), settings_of(request)))


@router.post(
    "/signup",
    status_code=202,
    response_model=Accepted,
    summary="Self-serve sign-up: 403 while SIGNUP_MODE=invite (ADR-013)",
)
def signup(body: SignupRequest, request: Request) -> dict[str, str]:
    auth_service.signup(body.email, body.display_name, body.password, request_meta(request), settings_of(request))
    return {"message": "Check your email for a link to confirm your account."}
