import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


# ── Requêtes ──────────────────────────────────────────────────────────────────

class JobConfig(BaseModel):
    """Configuration d'impression — PATCH /jobs/{id}/config"""
    copies: int = Field(default=1, ge=1, le=50)
    color_mode: Literal["nb", "couleur"] = "nb"
    duplex: bool = False
    paper_format: Literal["A4", "A3"] = "A4"


# ── Réponses ──────────────────────────────────────────────────────────────────

class JobCreateResponse(BaseModel):
    """Retourné après upload réussi — POST /jobs"""
    job_id: uuid.UUID
    original_filename: str
    pages: int
    status: str
    # preview_url est disponible immédiatement après upload
    preview_url: str

    model_config = {"from_attributes": True}


class JobStatusResponse(BaseModel):
    """Réponse légère pour le polling — GET /jobs/{id}"""
    job_id: uuid.UUID
    status: str
    pages: int
    copies: int
    color_mode: str
    duplex: bool
    paper_format: str
    price_fcfa: int | None
    queue_position: int | None
    # withdrawal_code uniquement exposé si status == "pret_a_retirer" ou "recupere"
    withdrawal_code: str | None

    model_config = {"from_attributes": True}
