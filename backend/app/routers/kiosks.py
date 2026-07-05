"""
kiosks.py — Endpoints publics pour la liste des bornes.

GET /kiosks  → liste de toutes les bornes (pour la carte)
"""
import logging

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.kiosk import Kiosk
from app.schemas.kiosk import KioskPublic

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Kiosks"])


@router.get("", response_model=list[KioskPublic])
async def list_kiosks(
    db: AsyncSession = Depends(get_db),
) -> list[KioskPublic]:
    """
    Retourne la liste de toutes les bornes avec leur position GPS et statut.
    Endpoint public utilisé par la carte interactive.
    """
    result = await db.execute(
        select(Kiosk).order_by(Kiosk.name)
    )
    kiosks = result.scalars().all()
    return [KioskPublic.model_validate(k) for k in kiosks]
