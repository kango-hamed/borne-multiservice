"""
scan.py — Schémas Pydantic pour le router /scan/*.

Conventions :
  - Les requêtes contiennent toujours agent_pin pour authentifier l'agent.
  - Les réponses incluent la liste des pages acquises (numéro + preview_url).
"""
import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


# ── Sous-structures ────────────────────────────────────────────────────────────

class ScannedPageInfo(BaseModel):
    """Métadonnées d'une page déjà acquise."""
    page_number: int
    preview_url: str


# ── Requêtes ──────────────────────────────────────────────────────────────────

class ScanSessionCreate(BaseModel):
    """Corps de POST /scan/sessions — création d'une session de scan."""
    kiosk_id: uuid.UUID
    agent_pin: str
    # session usager optionnelle (absente pour les photocopies sans QR scan)
    session_id: uuid.UUID | None = None
    color_mode: Literal["nb", "couleur"] = "nb"
    resolution: Literal[150, 200, 300] = 200


class ScanFinalizeRequest(BaseModel):
    """Corps de POST /scan/sessions/{id}/finalize."""
    agent_pin: str


class ScanCancelRequest(BaseModel):
    """Corps de DELETE /scan/sessions/{id}."""
    agent_pin: str


class ScanDeletePageRequest(BaseModel):
    """Corps de DELETE /scan/sessions/{id}/pages/{n}."""
    agent_pin: str


# ── Réponses ──────────────────────────────────────────────────────────────────

class ScanSessionResponse(BaseModel):
    """Réponse standard pour toutes les opérations sur une session de scan."""
    scan_session_id: uuid.UUID
    status: str
    pages_count: int
    color_mode: str
    resolution: int
    pages: list[ScannedPageInfo] = []
    print_job_id: uuid.UUID | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ScanAcquireResponse(BaseModel):
    """Réponse de POST /scan/sessions/{id}/acquire — une page vient d'être acquise."""
    scan_session_id: uuid.UUID
    page_number: int       # numéro de la page qui vient d'être acquise
    pages_count: int       # total pages acquises dans la session
    status: str            # toujours "ouvert" après une acquisition réussie
    preview_url: str       # URL de l'aperçu PNG de cette page


class ScanFinalizeResponse(BaseModel):
    """Réponse de POST /scan/sessions/{id}/finalize."""
    scan_session_id: uuid.UUID
    print_job_id: uuid.UUID
    pages: int
    status: str            # "termine"


class ScanDeviceListResponse(BaseModel):
    """Réponse de GET /scan/devices — diagnostic."""
    devices: list[str]
    scanning_mode: str     # "mock" | "real"
