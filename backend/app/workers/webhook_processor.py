"""
webhook_processor.py — Traitement centralisé des confirmations de paiement.

Ce module est appelé par deux chemins :
  1. POST /payments/webhook  (callback externe du provider)
  2. mock_provider._trigger_internal_webhook()  (confirmation auto mock)

En centralisant ici, on évite la duplication de logique de transition d'état.
"""
import logging
import secrets
import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal
from app.models.payment import Payment
from app.models.print_job import PrintJob

logger = logging.getLogger(__name__)


async def process_payment_confirmation(
    provider_transaction_id: str,
    status: str,  # "confirme" | "echoue"
) -> None:
    """
    Met à jour Payment et PrintJob en base lors d'une confirmation de paiement.

    Idempotent : si le paiement est déjà "confirme", ne fait rien.
    """
    async with AsyncSessionLocal() as db:
        # Récupère le paiement par provider_transaction_id
        result = await db.execute(
            select(Payment).where(
                Payment.provider_transaction_id == provider_transaction_id
            )
        )
        payment = result.scalar_one_or_none()

        if payment is None:
            logger.warning(
                f"Webhook reçu pour transaction inconnue : {provider_transaction_id}"
            )
            return

        # Idempotence : si déjà traité, on ignore
        if payment.status == "confirme":
            logger.info(
                f"Paiement déjà confirmé, webhook ignoré : {provider_transaction_id}"
            )
            return

        # Met à jour le paiement
        payment.status = status
        if status == "confirme":
            payment.confirmed_at = datetime.now(timezone.utc)

        # Récupère le job associé
        result = await db.execute(
            select(PrintJob).where(PrintJob.id == payment.print_job_id)
        )
        job = result.scalar_one_or_none()

        if job is None:
            logger.error(
                f"Job introuvable pour paiement {payment.id} — "
                f"transaction {provider_transaction_id}"
            )
            await db.commit()
            return

        # Met à jour le statut du job selon le résultat du paiement
        if status == "confirme":
            # Si le job est associé à une session de scan, on le passe directement en "pret_a_retirer"
            # car il n'a pas besoin d'être imprimé physiquement
            from app.models.scan_session import ScanSession
            scan_sess_result = await db.execute(
                select(ScanSession).where(ScanSession.print_job_id == job.id)
            )
            is_scan = scan_sess_result.scalar_one_or_none() is not None

            if is_scan:
                job.status = "pret_a_retirer"
            else:
                job.status = "paye"
            job.withdrawal_code = _generate_withdrawal_code()
            logger.info(
                f"Paiement confirmé — job={job.id} | "
                f"status={job.status} | "
                f"code_retrait={job.withdrawal_code} | "
                f"txn={provider_transaction_id}"
            )
        elif status == "echoue":
            job.status = "attente_paiement"  # Retour à l'étape paiement
            logger.warning(
                f"Paiement échoué — job={job.id} | txn={provider_transaction_id}"
            )

        await db.commit()


def _generate_withdrawal_code() -> str:
    """
    Génère un code de retrait à 4 chiffres cryptographiquement sûr.
    Utilise secrets.randbelow pour éviter les biais de random.randint.
    """
    return str(secrets.randbelow(10000)).zfill(4)
