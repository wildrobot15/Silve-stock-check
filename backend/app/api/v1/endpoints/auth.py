from fastapi import APIRouter, HTTPException

from app.core.security import create_access_token
from app.schemas.auth import LoginRequest, TokenResponse

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest):
    # Replace with real DB-backed auth and password verification.
    if payload.email.endswith("@soc.local") and payload.password == "ChangeMe!123":
        token = create_access_token(subject=payload.email)
        return TokenResponse(access_token=token)
    raise HTTPException(status_code=401, detail="Invalid credentials")
