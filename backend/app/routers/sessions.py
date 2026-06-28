"""
sessions.py — Endpoints de gestion des sessions.

POST /sessions   → créé au scan du QR code
GET  /sessions/{id} → vérifie la validité / expiration
"""
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.exceptions import (
    KioskNotFoundError,
    KioskOfflineError,
    SessionExpiredError,
    SessionNotFoundError,
)
from app.models.kiosk import Kiosk
from app.models.session import Session
from app.schemas.session import SessionCreate, SessionResponse, SessionStatus

router = APIRouter(tags=["Sessions"])


@router.post("", response_model=SessionResponse, status_code=201)
async def create_session(
    body: SessionCreate,
    db: AsyncSession = Depends(get_db),
) -> SessionResponse:
    """
    Crée une nouvelle session lors du scan du QR code.

    - Vérifie que la borne existe et est active.
    - Si une session active existe déjà pour ce kiosk (même scan), la retourne.
    - Sinon crée une nouvelle session avec expiration à SESSION_EXPIRY_MINUTES.
    """
    # Vérification borne
    result = await db.execute(select(Kiosk).where(Kiosk.id == body.kiosk_id))
    kiosk = result.scalar_one_or_none()

    if kiosk is None:
        raise KioskNotFoundError(str(body.kiosk_id))

    if kiosk.status != "actif":
        raise KioskOfflineError()

    # Création de la session
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(minutes=settings.SESSION_EXPIRY_MINUTES)

    session = Session(
        id=uuid.uuid4(),
        kiosk_id=kiosk.id,
        expires_at=expires_at,
        status="active",
    )
    db.add(session)
    await db.flush()  # Pour obtenir l'id avant le commit

    return SessionResponse(
        session_token=session.id,
        kiosk_id=kiosk.id,
        kiosk_name=kiosk.name,
        expires_at=expires_at,
        status="active",
    )


@router.get("/{session_id}", response_model=SessionStatus)
async def get_session(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> SessionStatus:
    """
    Vérifie la validité d'une session.

    - Si expirée en base → retourne SessionExpiredError (410)
    - Si expirée par timeout (expires_at dépassé) → met à jour en base + 410
    - Si active → retourne les infos
    """
    result = await db.execute(select(Session).where(Session.id == session_id))
    session = result.scalar_one_or_none()

    if session is None:
        raise SessionNotFoundError()

    # Vérification expiration par timeout
    now = datetime.now(timezone.utc)
    expires_at = session.expires_at
    if expires_at.tzinfo is None:
        now = now.replace(tzinfo=None)

    if session.status == "active" and expires_at < now:
        session.status = "expiree"
        await db.flush()

    if session.status == "expiree":
        raise SessionExpiredError()

    if session.status == "terminee":
        raise SessionExpiredError()

    return SessionStatus(
        session_token=session.id,
        status=session.status,
        expires_at=session.expires_at,
        is_valid=True,
    )
