"""
kiosk.py — Schémas Pydantic pour les kiosks (lecture publique).
"""
import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class KioskPublic(BaseModel):
    """Représentation publique d'un kiosk (utilisée par GET /kiosks)."""

    id: uuid.UUID
    name: str
    status: str
    location_lat: Optional[float] = None
    location_lng: Optional[float] = None
    created_at: datetime

    model_config = {"from_attributes": True}
