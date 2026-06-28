import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


# ── Requêtes ──────────────────────────────────────────────────────────────────

class PaymentInitiate(BaseModel):
    """Initie un paiement — POST /payments/{job_id}/initiate"""
    provider: Literal["orange_money", "mtn", "moov", "wave", "mock"]
    # Le numéro de téléphone n'est jamais loggé en clair
    phone_number: str = Field(min_length=8, max_length=20)


class PaymentWebhook(BaseModel):
    """Payload entrant du provider — POST /payments/webhook"""
    provider_transaction_id: str
    status: Literal["confirme", "echoue"]
    # Signature / données spécifiques au provider (extensible)
    raw_payload: dict = Field(default_factory=dict)


# ── Réponses ──────────────────────────────────────────────────────────────────

class PaymentInitiateResponse(BaseModel):
    payment_id: uuid.UUID
    status: str
    provider: str
    amount_fcfa: int
    # Instructions d'attente côté frontend
    message: str = "En attente de confirmation du paiement"

    model_config = {"from_attributes": True}


class PaymentStatusResponse(BaseModel):
    """Polling léger — GET /payments/{job_id}/status"""
    payment_id: uuid.UUID
    status: str          # statut du paiement (initie/en_attente/confirme/echoue)
    job_status: str      # statut du job associé (pour éviter un 2ème appel)
    amount_fcfa: int
    provider: str
    confirmed_at: datetime | None

    model_config = {"from_attributes": True}
