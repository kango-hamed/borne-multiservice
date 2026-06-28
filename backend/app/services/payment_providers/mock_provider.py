"""
mock_provider.py — Provider de paiement simulé pour le prototype et les démos.

Comportement :
  - Après initiation, le paiement passe à "en_attente"
  - Après un délai configurable (PAYMENT_MOCK_DELAY_SECONDS), il passe à "confirme"
    via une tâche asyncio en arrière-plan
  - Un endpoint de debug permet de forcer succès/échec manuellement (dev uniquement)

Ce provider est une vraie implémentation de l'interface PaymentProvider,
pas un raccourci codé en dur dans les routers.
"""
import asyncio
import logging
import uuid
from datetime import datetime, timezone

from app.config import settings
from app.services.payment_providers.base import (
    PaymentInitiateResult,
    PaymentProvider,
    PaymentStatusResult,
    WebhookResult,
)

logger = logging.getLogger(__name__)

# Stockage en mémoire des transactions mock (suffit pour le proto mono-borne)
# Structure : { provider_transaction_id: { "status": str, "job_id": str, ... } }
_mock_transactions: dict[str, dict] = {}


class MockPaymentProvider(PaymentProvider):
    """
    Simule un provider de paiement mobile money.
    Implémente fidèlement l'interface PaymentProvider.
    """

    async def initiate_payment(
        self,
        job_id: uuid.UUID,
        amount_fcfa: int,
        phone_number: str,
    ) -> PaymentInitiateResult:
        # Génère un ID de transaction mock unique
        txn_id = f"MOCK-{uuid.uuid4().hex[:12].upper()}"

        # Stocke la transaction en mémoire
        _mock_transactions[txn_id] = {
            "job_id": str(job_id),
            "amount_fcfa": amount_fcfa,
            "status": "en_attente",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

        # Log sécurisé : numéro tronqué
        masked_phone = phone_number[:3] + "****" + phone_number[-3:]
        logger.info(
            f"[MOCK] Paiement initié — txn={txn_id}, job={job_id}, "
            f"montant={amount_fcfa} FCFA, téléphone={masked_phone}"
        )

        # Lance la confirmation automatique en arrière-plan
        asyncio.create_task(self._auto_confirm(txn_id))

        return PaymentInitiateResult(
            provider_transaction_id=txn_id,
            status="en_attente",
            raw_response={"transaction_id": txn_id, "message": "En attente de confirmation"},
        )

    async def check_status(
        self,
        provider_transaction_id: str,
    ) -> PaymentStatusResult:
        txn = _mock_transactions.get(provider_transaction_id)
        if txn is None:
            return PaymentStatusResult(
                status="echoue",
                provider_transaction_id=provider_transaction_id,
                raw_response={"error": "Transaction introuvable"},
            )

        return PaymentStatusResult(
            status=txn["status"],
            provider_transaction_id=provider_transaction_id,
            raw_response=txn,
        )

    async def handle_webhook(self, payload: dict) -> WebhookResult:
        """
        Traite un webhook mock (envoyé par l'endpoint de debug /dev/payments/force).
        En production, vérifierait une signature HMAC ici.
        """
        txn_id = payload.get("provider_transaction_id")
        status = payload.get("status")

        if not txn_id or status not in ("confirme", "echoue"):
            return WebhookResult(
                provider_transaction_id=txn_id or "",
                status="echoue",
                is_valid=False,
                raw_payload=payload,
            )

        if txn_id in _mock_transactions:
            _mock_transactions[txn_id]["status"] = status

        return WebhookResult(
            provider_transaction_id=txn_id,
            status=status,
            is_valid=True,
            raw_payload=payload,
        )

    async def _auto_confirm(self, txn_id: str) -> None:
        """
        Confirme automatiquement le paiement après le délai configuré.
        Simule le comportement réel d'un provider mobile money.
        """
        await asyncio.sleep(settings.PAYMENT_MOCK_DELAY_SECONDS)

        if txn_id in _mock_transactions:
            _mock_transactions[txn_id]["status"] = "confirme"
            logger.info(f"[MOCK] Paiement auto-confirmé — txn={txn_id}")

            # Déclenche le webhook interne pour déclencher la mise à jour en base
            await _trigger_internal_webhook(txn_id)


async def _trigger_internal_webhook(txn_id: str) -> None:
    """
    Appelle en interne le handler webhook pour mettre à jour la base de données.
    Évite de faire une vraie requête HTTP vers soi-même.
    """
    from app.workers.webhook_processor import process_payment_confirmation
    try:
        await process_payment_confirmation(txn_id, "confirme")
    except Exception as e:
        logger.error(f"[MOCK] Erreur lors du traitement du webhook interne : {e}")


# ── Fonctions utilitaires pour les tests/démos ────────────────────────────────

async def force_mock_status(txn_id: str, status: str) -> bool:
    """
    Force manuellement le statut d'une transaction mock.
    Utilisé par l'endpoint de debug (ENVIRONMENT=development uniquement).
    """
    if txn_id not in _mock_transactions:
        return False
    _mock_transactions[txn_id]["status"] = status
    if status == "confirme":
        await _trigger_internal_webhook(txn_id)
    return True
