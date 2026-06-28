"""
payments.py — Endpoints de gestion des paiements.

POST /payments/{job_id}/initiate  → initie le paiement via le provider
POST /payments/webhook            → callback provider (idempotent)
GET  /payments/{job_id}/status    → polling statut paiement + job
"""
import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.exceptions import (
    JobAlreadyPaidError,
    JobNotFoundError,
    PaymentAlreadyConfirmedError,
)
from app.models.payment import Payment
from app.models.print_job import PrintJob
from app.schemas.payment import (
    PaymentInitiate,
    PaymentInitiateResponse,
    PaymentStatusResponse,
    PaymentWebhook,
)
from app.services.payment_providers.base import get_payment_provider
from app.workers.webhook_processor import process_payment_confirmation

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Paiements"])


@router.post("/{job_id}/initiate", response_model=PaymentInitiateResponse, status_code=201)
async def initiate_payment(
    job_id: uuid.UUID,
    body: PaymentInitiate,
    db: AsyncSession = Depends(get_db),
) -> PaymentInitiateResponse:
    """
    Initie un paiement pour un job.

    - Vérifie que le job est en "attente_paiement"
    - Vérifie qu'aucun paiement actif n'existe déjà (idempotence)
    - Appelle le provider via l'interface abstraite
    - Crée l'enregistrement Payment en base
    """
    # Vérification du job
    result = await db.execute(select(PrintJob).where(PrintJob.id == job_id))
    job = result.scalar_one_or_none()

    if job is None:
        raise JobNotFoundError()

    if job.status == "paye":
        raise JobAlreadyPaidError()

    if job.status not in ("attente_paiement", "paiement_expire"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Impossible d'initier un paiement pour un job en statut '{job.status}'.",
        )

    # Vérification paiement existant
    existing_result = await db.execute(
        select(Payment).where(Payment.print_job_id == job_id)
    )
    existing_payment = existing_result.scalar_one_or_none()

    if existing_payment and existing_payment.status == "confirme":
        raise PaymentAlreadyConfirmedError()

    # Appel au provider via l'interface abstraite
    provider = get_payment_provider(body.provider)
    result_payment = await provider.initiate_payment(
        job_id=job_id,
        amount_fcfa=job.price_fcfa or 0,
        phone_number=body.phone_number,
    )

    # Création ou mise à jour du paiement en base
    if existing_payment:
        # Réessai après échec
        existing_payment.provider = body.provider
        existing_payment.status = result_payment.status
        existing_payment.provider_transaction_id = result_payment.provider_transaction_id
        payment = existing_payment
    else:
        payment = Payment(
            print_job_id=job_id,
            provider=body.provider,
            provider_transaction_id=result_payment.provider_transaction_id,
            amount_fcfa=job.price_fcfa or 0,
            status=result_payment.status,
        )
        db.add(payment)

    await db.flush()

    return PaymentInitiateResponse(
        payment_id=payment.id,
        status=payment.status,
        provider=payment.provider,
        amount_fcfa=payment.amount_fcfa,
    )


@router.post("/webhook", status_code=200)
async def payment_webhook(body: PaymentWebhook) -> dict:
    """
    Callback du provider de paiement.

    - Valide la signature (via le provider)
    - Idempotent : ignore si déjà confirmé
    - Délègue le traitement à webhook_processor

    Note : cet endpoint n'a pas de dépendance db directe —
    le traitement est délégué à process_payment_confirmation
    qui ouvre sa propre session.
    """
    provider_name = body.raw_payload.get("provider", "mock")
    provider = get_payment_provider(provider_name)

    webhook_result = await provider.handle_webhook(body.dict())

    if not webhook_result.is_valid:
        logger.warning(
            f"Webhook invalide reçu — txn={body.provider_transaction_id}"
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Webhook invalide ou signature incorrecte.",
        )

    # Traitement asynchrone de la confirmation
    await process_payment_confirmation(
        provider_transaction_id=webhook_result.provider_transaction_id,
        status=webhook_result.status,
    )

    return {"received": True}


@router.get("/{job_id}/status", response_model=PaymentStatusResponse)
async def get_payment_status(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> PaymentStatusResponse:
    """
    Retourne le statut du paiement et du job associé.
    Endpoint léger pour le polling frontend — pas de jointures lourdes.
    """
    # Paiement
    result = await db.execute(
        select(Payment).where(Payment.print_job_id == job_id)
    )
    payment = result.scalar_one_or_none()

    if payment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Aucun paiement initié pour ce job.",
        )

    # Job (pour retourner job_status en un seul appel)
    job_result = await db.execute(
        select(PrintJob.status).where(PrintJob.id == job_id)
    )
    job_status = job_result.scalar_one_or_none() or "inconnu"

    return PaymentStatusResponse(
        payment_id=payment.id,
        status=payment.status,
        job_status=job_status,
        amount_fcfa=payment.amount_fcfa,
        provider=payment.provider,
        confirmed_at=payment.confirmed_at,
    )
