"""
admin.py — Interface admin pour les agents de la borne.

GET  /admin/kiosks/{kiosk_id}/queue    → file d'attente de la borne
POST /admin/jobs/{job_id}/withdraw     → validation du retrait par code
GET  /admin/printers                   → liste des imprimantes Windows disponibles
"""
import logging
import uuid

from fastapi import APIRouter, Depends, Header, HTTPException, status
from passlib.context import CryptContext
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.exceptions import (
    InvalidAgentPinError,
    InvalidWithdrawalCodeError,
    JobNotReadyForWithdrawalError,
    KioskNotFoundError,
)
from app.models.agent import Agent
from app.models.kiosk import Kiosk
from app.models.print_job import PrintJob
from app.schemas.admin import (
    KioskQueueResponse,
    PrinterListResponse,
    QueueJobItem,
    WithdrawRequest,
    WithdrawResponse,
)
from app.services.printing import list_available_printers

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Admin"])

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Statuts visibles dans la file agent
QUEUE_STATUSES = ("paye", "impression_en_cours", "pret_a_retirer")


async def _verify_agent(
    kiosk_id: uuid.UUID,
    pin: str,
    db: AsyncSession,
) -> Agent:
    """Vérifie le PIN de l'agent pour la borne donnée."""
    result = await db.execute(
        select(Agent).where(Agent.kiosk_id == kiosk_id)
    )
    agents = result.scalars().all()

    for agent in agents:
        if pwd_context.verify(pin, agent.pin_hash):
            return agent

    raise InvalidAgentPinError()


@router.get("/kiosks/{kiosk_id}/queue", response_model=KioskQueueResponse)
async def get_kiosk_queue(
    kiosk_id: uuid.UUID,
    x_agent_pin: str = Header(..., alias="X-Agent-Pin"),
    db: AsyncSession = Depends(get_db),
) -> KioskQueueResponse:
    """
    Retourne la file d'attente active de la borne.
    Authentification : PIN agent dans l'en-tête X-Agent-Pin.
    """
    # Vérification borne
    result = await db.execute(select(Kiosk).where(Kiosk.id == kiosk_id))
    kiosk = result.scalar_one_or_none()
    if kiosk is None:
        raise KioskNotFoundError(str(kiosk_id))

    # Vérification agent
    await _verify_agent(kiosk_id, x_agent_pin, db)

    # Récupération de la file FIFO
    jobs_result = await db.execute(
        select(PrintJob)
        .where(
            PrintJob.kiosk_id == kiosk_id,
            PrintJob.status.in_(QUEUE_STATUSES),
        )
        .order_by(PrintJob.created_at)
    )
    jobs = jobs_result.scalars().all()

    queue_items = [
        QueueJobItem(
            job_id=job.id,
            original_filename=job.original_filename,
            pages=job.pages,
            copies=job.copies,
            color_mode=job.color_mode,
            duplex=job.duplex,
            price_fcfa=job.price_fcfa,
            status=job.status,
            withdrawal_code=job.withdrawal_code,
            created_at=job.created_at,
            queue_position=idx + 1,
        )
        for idx, job in enumerate(jobs)
    ]

    return KioskQueueResponse(
        kiosk_id=kiosk_id,
        kiosk_name=kiosk.name,
        jobs=queue_items,
        total=len(queue_items),
    )


@router.post("/jobs/{job_id}/withdraw", response_model=WithdrawResponse)
async def withdraw_job(
    job_id: uuid.UUID,
    body: WithdrawRequest,
    db: AsyncSession = Depends(get_db),
) -> WithdrawResponse:
    """
    Valide le retrait d'un document par l'agent.

    - Vérifie le PIN agent
    - Vérifie le code de retrait à 4 chiffres
    - Passe le job en statut "recupere"
    """
    result = await db.execute(select(PrintJob).where(PrintJob.id == job_id))
    job = result.scalar_one_or_none()

    if job is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job introuvable.",
        )

    # Vérification PIN agent pour la borne du job
    await _verify_agent(job.kiosk_id, body.agent_pin, db)

    # Vérification statut
    if job.status != "pret_a_retirer":
        raise JobNotReadyForWithdrawalError(job.status)

    # Vérification code de retrait (comparaison constante pour éviter timing attacks)
    import hmac
    if not hmac.compare_digest(
        job.withdrawal_code or "", body.withdrawal_code
    ):
        logger.warning(
            f"Code de retrait invalide — job={job_id} | "
            f"code_saisi={body.withdrawal_code[:1]}***"
        )
        raise InvalidWithdrawalCodeError()

    # Mise à jour statut
    job.status = "recupere"
    await db.flush()

    logger.info(f"Document retiré — job={job_id}")

    return WithdrawResponse(job_id=job_id, status="recupere")


@router.get("/printers", response_model=PrinterListResponse)
async def get_printers() -> PrinterListResponse:
    """
    Liste les imprimantes Windows disponibles sur la borne.
    Utile pour la configuration initiale (choisir PRINTER_NAME dans .env).
    """
    printers, default = await list_available_printers()
    return PrinterListResponse(printers=printers, default_printer=default)
