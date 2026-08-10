"""
routes/auth.py
---------------
POST /api/auth/login   -> returns a JWT on valid admin credentials
POST /api/auth/seed    -> dev-only helper to create the first admin account
"""

from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel

from database import db
from utils.security import hash_password, verify_password, create_access_token

router = APIRouter(prefix="/api/auth", tags=["auth"])


class SeedAdminRequest(BaseModel):
    email: str
    password: str


@router.post("/seed")
def seed_admin(payload: SeedAdminRequest):
    """
    Dev convenience only — creates the first admin account.
    Remove or protect this route before any real deployment.
    """
    existing = db.get_admin_by_email(payload.email)
    if existing:
        raise HTTPException(400, "Admin with this email already exists")
    db.create_admin(payload.email, hash_password(payload.password))
    return {"message": "Admin created"}


@router.post("/login")
def login(form: OAuth2PasswordRequestForm = Depends()):
    admin = db.get_admin_by_email(form.username)
    if not admin or not verify_password(form.password, admin["password_hash"]):
        raise HTTPException(401, "Incorrect email or password")
    token = create_access_token({"sub": admin["email"]})
    db.log_event("admin_login", admin["email"])
    return {"access_token": token, "token_type": "bearer"}
