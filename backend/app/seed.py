"""
seed.py — Script d'initialisation (seeding) de la base de données.

Crée une borne et un agent par défaut pour pouvoir tester l'API immédiatement.
ID de la borne par défaut : 3fa85f64-5717-4562-b3fc-2c963f66afa6
PIN de l'agent par défaut : 1234
"""
import asyncio
import logging
import uuid

from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import AsyncSessionLocal, engine
from app.models.agent import Agent
from app.models.base import Base
from app.models.kiosk import Kiosk

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("seed")

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ── Données par défaut ────────────────────────────────────────────────────────
DEFAULT_KIOSK_ID = uuid.UUID("3fa85f64-5717-4562-b3fc-2c963f66afa6")
DEFAULT_KIOSK_NAME = "Borne Cocody Riviera"

DEFAULT_AGENT_NAME = "Agent Hamed"
DEFAULT_AGENT_PIN = "1234"


async def seed_database():
    logger.info("Démarrage du seeding...")

    async with AsyncSessionLocal() as db:
        # 1. Vérifie si la borne existe déjà
        result = await db.execute(
            select(Kiosk).where(Kiosk.id == DEFAULT_KIOSK_ID)
        )
        kiosk = result.scalar_one_or_none()

        if kiosk is None:
            kiosk = Kiosk(
                id=DEFAULT_KIOSK_ID,
                name=DEFAULT_KIOSK_NAME,
                location_lat=5.3484,  # Abidjan Cocody
                location_lng=-3.9785,
                status="actif",
                printer_endpoint="HP LaserJet Pro M404",
            )
            db.add(kiosk)
            logger.info(f"Borne '{DEFAULT_KIOSK_NAME}' créée.")
        else:
            logger.info(f"La borne '{DEFAULT_KIOSK_NAME}' existe déjà.")

        await db.flush()

        # 2. Vérifie si l'agent existe déjà
        result_agent = await db.execute(
            select(Agent).where(Agent.kiosk_id == DEFAULT_KIOSK_ID)
        )
        agent = result_agent.scalar_one_or_none()

        if agent is None:
            pin_hash = pwd_context.hash(DEFAULT_AGENT_PIN)
            agent = Agent(
                id=uuid.uuid4(),
                kiosk_id=DEFAULT_KIOSK_ID,
                name=DEFAULT_AGENT_NAME,
                pin_hash=pin_hash,
            )
            db.add(agent)
            logger.info(f"Agent '{DEFAULT_AGENT_NAME}' créé (PIN: {DEFAULT_AGENT_PIN}).")
        else:
            logger.info(f"L'agent '{DEFAULT_AGENT_NAME}' existe déjà.")

        await db.commit()
        logger.info("Seeding terminé avec succès !")


if __name__ == "__main__":
    # Permet de lancer le script directement : python app/seed.py
    # Si les tables n'existent pas, on peut les créer via Base.metadata
    async def main():
        # Optionnel: décommenter ci-dessous si on veut créer les tables sans Alembic
        # async with engine.begin() as conn:
        #     await conn.run_sync(Base.metadata.create_all)
        await seed_database()

    asyncio.run(main())
