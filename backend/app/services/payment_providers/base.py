"""
base.py — Interface abstraite pour les providers de paiement.

Toute nouvelle intégration (Orange Money, Wave, MTN...)
doit implémenter cette interface. Le reste du système (routers, worker)
ne dépend que de cette interface, jamais d'un provider concret.
"""
import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Literal


# ── Types de retour ───────────────────────────────────────────────────────────

@dataclass
class PaymentInitiateResult:
    """Résultat de l'initiation d'un paiement."""
    provider_transaction_id: str | None   # None si pas encore assigné par le provider
    status: Literal["initie", "en_attente", "confirme", "echoue"]
    raw_response: dict                     # Réponse brute du provider (pour logs)


@dataclass
class PaymentStatusResult:
    """Résultat d'une interrogation de statut."""
    status: Literal["initie", "en_attente", "confirme", "echoue"]
    provider_transaction_id: str | None
    raw_response: dict


@dataclass
class WebhookResult:
    """Résultat du traitement d'un webhook entrant."""
    provider_transaction_id: str
    status: Literal["confirme", "echoue"]
    is_valid: bool        # True si la signature/format est valide
    raw_payload: dict


# ── Interface abstraite ───────────────────────────────────────────────────────

class PaymentProvider(ABC):
    """
    Interface que tout provider de paiement doit implémenter.

    Pour ajouter un nouveau provider (ex: Orange Money) :
    1. Créer orange_money_provider.py
    2. Implémenter les 3 méthodes ci-dessous
    3. Enregistrer le provider dans get_payment_provider()
    Aucun autre fichier ne doit être modifié.
    """

    @abstractmethod
    async def initiate_payment(
        self,
        job_id: uuid.UUID,
        amount_fcfa: int,
        phone_number: str,
    ) -> PaymentInitiateResult:
        """
        Initie un paiement auprès du provider.

        Args:
            job_id: UUID du job (utilisé comme référence de commande)
            amount_fcfa: Montant en FCFA
            phone_number: Numéro de téléphone de l'usager (NE PAS logger en clair)

        Returns:
            PaymentInitiateResult avec le statut initial et l'ID de transaction
        """

    @abstractmethod
    async def check_status(
        self,
        provider_transaction_id: str,
    ) -> PaymentStatusResult:
        """
        Interroge le provider pour le statut actuel d'une transaction.
        Utilisé en fallback si le webhook n'est pas reçu dans les temps.
        """

    @abstractmethod
    async def handle_webhook(
        self,
        payload: dict,
    ) -> WebhookResult:
        """
        Valide et traite un callback entrant du provider.

        Doit vérifier la signature/authenticité du webhook avant tout traitement.
        Retourne is_valid=False si la signature est invalide.
        """


# ── Factory ───────────────────────────────────────────────────────────────────

def get_payment_provider(provider_name: str) -> PaymentProvider:
    """
    Retourne le provider correspondant au nom.
    Point d'extension unique : ajouter ici les nouveaux providers.
    """
    from app.services.payment_providers.mock_provider import MockPaymentProvider

    providers: dict[str, PaymentProvider] = {
        "mock": MockPaymentProvider(),
        # "orange_money": OrangeMoneyProvider(),  # À décommenter lors de l'intégration réelle
        # "wave": WaveProvider(),
    }

    provider = providers.get(provider_name)
    if provider is None:
        raise ValueError(f"Provider inconnu : {provider_name}")
    return provider
