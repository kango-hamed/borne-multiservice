"""
print_queue_worker.py — Worker de file d'impression FIFO.

Responsabilités :
  - Interroge PostgreSQL toutes les WORKER_POLL_INTERVAL_SECONDS secondes
  - Traite les jobs payés dans l'ordre FIFO par kiosk_id
  - Ne bloque jamais sur une erreur — continue sur le job suivant
  - Utilise FOR UPDATE SKIP LOCKED pour éviter les doublons si plusieurs workers

Lancé au démarrage de l'app via le lifespan FastAPI dans main.py.
"""
import asyncio
import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import AsyncSessionLocal
from app.models.print_job import PrintJob
from app.services.printing import send_to_printer

logger = logging.getLogger(__name__)


async def print_queue_worker() -> None:
    """
    Boucle principale du worker d'impression.
    Tourne indéfiniment jusqu'à annulation de la tâche asyncio.
    """
    logger.info(
        f"Worker d'impression démarré — "
        f"polling toutes les {settings.WORKER_POLL_INTERVAL_SECONDS}s"
    )

    while True:
        try:
            await _process_next_job()
        except asyncio.CancelledError:
            logger.info("Worker d'impression arrêté.")
            break
        except Exception as e:
            # Ne jamais laisser une exception tuer le worker
            logger.error(f"Erreur inattendue dans le worker : {e}", exc_info=True)

        await asyncio.sleep(settings.WORKER_POLL_INTERVAL_SECONDS)


async def _process_next_job() -> None:
    """
    Récupère et traite le prochain job payé en attente (FIFO).
    Utilise FOR UPDATE SKIP LOCKED pour la concurrence future.
    """
    async with AsyncSessionLocal() as db:
        # Sélection du prochain job payé dans l'ordre FIFO
        # FOR UPDATE SKIP LOCKED : si un autre worker traite déjà ce job, on le saute
        result = await db.execute(
            select(PrintJob)
            .where(PrintJob.status == "paye")
            .order_by(PrintJob.created_at)  # FIFO
            .limit(1)
            .with_for_update(skip_locked=True)
        )
        job = result.scalar_one_or_none()

        if job is None:
            return  # Rien à traiter

        logger.info(
            f"[WORKER] Traitement du job — "
            f"id={job.id} | fichier={job.original_filename} | "
            f"borne={job.kiosk_id}"
        )

        # Passage en "impression_en_cours" avant l'envoi
        job.status = "impression_en_cours"
        await db.commit()

        # Envoi à l'imprimante (dans une nouvelle session pour éviter les timeouts)
        try:
            success = await send_to_printer(job)
        except Exception as e:
            logger.error(
                f"[WORKER] Exception lors de l'impression — job={job.id} : {e}",
                exc_info=True,
            )
            success = False

        # Mise à jour du statut final
        async with AsyncSessionLocal() as db2:
            result2 = await db2.execute(
                select(PrintJob).where(PrintJob.id == job.id)
            )
            job2 = result2.scalar_one_or_none()
            if job2:
                if success:
                    # Le code de retrait a déjà été généré lors du paiement
                    job2.status = "pret_a_retirer"
                    logger.info(
                        f"[WORKER] Impression réussie — "
                        f"job={job.id} | code={job2.withdrawal_code}"
                    )
                else:
                    # Échec d'impression : repasse en "paye" pour un re-essai ultérieur
                    # (le worker le reprendra au prochain polling)
                    job2.status = "paye"
                    logger.warning(
                        f"[WORKER] Échec d'impression — job={job.id} "
                        f"→ remis en file pour re-essai"
                    )
                await db2.commit()
