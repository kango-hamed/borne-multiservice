import uuid
from datetime import datetime

from pydantic import BaseModel, Field


# ── Requêtes ──────────────────────────────────────────────────────────────────

class WithdrawRequest(BaseModel):
    """Validation du retrait par l'agent — POST /admin/jobs/{id}/withdraw"""
    withdrawal_code: str = Field(min_length=4, max_length=4, pattern=r"^\d{4}$")
    agent_pin: str = Field(min_length=4, max_length=10)


# ── Réponses ──────────────────────────────────────────────────────────────────

class QueueJobItem(BaseModel):
    """Un job dans la file d'attente de la borne"""
    job_id: uuid.UUID
    original_filename: str
    pages: int
    copies: int
    color_mode: str
    duplex: bool
    price_fcfa: int | None
    status: str
    withdrawal_code: str | None
    created_at: datetime
    queue_position: int | None

    model_config = {"from_attributes": True}


class KioskQueueResponse(BaseModel):
    """File d'attente complète d'une borne — GET /admin/kiosks/{id}/queue"""
    kiosk_id: uuid.UUID
    kiosk_name: str
    jobs: list[QueueJobItem]
    total: int


class WithdrawResponse(BaseModel):
    job_id: uuid.UUID
    status: str
    message: str = "Document remis avec succès"


class PrinterListResponse(BaseModel):
    """Liste des imprimantes Windows disponibles — GET /admin/printers"""
    printers: list[str]
    default_printer: str | None
