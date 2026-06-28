import uuid
from datetime import datetime

from pydantic import BaseModel, Field


# ── Requête ───────────────────────────────────────────────────────────────────

class SessionCreate(BaseModel):
    kiosk_id: uuid.UUID


# ── Réponses ──────────────────────────────────────────────────────────────────

class SessionResponse(BaseModel):
    session_token: uuid.UUID
    kiosk_id: uuid.UUID
    kiosk_name: str
    expires_at: datetime
    status: str

    model_config = {"from_attributes": True}


class SessionStatus(BaseModel):
    session_token: uuid.UUID
    status: str
    expires_at: datetime
    is_valid: bool

    model_config = {"from_attributes": True}
