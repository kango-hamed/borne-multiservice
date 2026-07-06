"""
seed.py — Script d'initialisation (seeding) de la base de données.

Crée les bornes et agents par défaut pour un environnement de production/test.
Le script est idempotent : il peut être relancé sans créer de doublons.

Bornes :
  - Cocody Riviera     (actif)
  - Plateau Centre     (actif)
  - Yopougon Marché    (maintenance)
  - Treichville Gare   (hors_ligne)
  - Abobo Marché       (actif)

Agents :
  - Agent Hamed   → Cocody     (PIN 1234)
  - Agent Rachelle  → Plateau    (PIN 5678)
  - Agent Christ  → Yopougon   (PIN 9012)
  - Agent Isaac → Abobo      (PIN 3456)
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

# ── Données des bornes ────────────────────────────────────────────────────────

KIOSKS = [
    {
        "id": uuid.UUID("3fa85f64-5717-4562-b3fc-2c963f66afa6"),
        "name": "Borne Cocody Riviera",
        "location_lat": 5.3484,
        "location_lng": -3.9785,
        "status": "actif",
        "printer_endpoint": "HP LaserJet Pro M404",
    },
    {
        "id": uuid.UUID("a1b2c3d4-e5f6-7890-abcd-ef1234567890"),
        "name": "Borne Plateau Centre",
        "location_lat": 5.3220,
        "location_lng": -4.0166,
        "status": "actif",
        "printer_endpoint": "Canon imageRUNNER 2530",
    },
    {
        "id": uuid.UUID("b2c3d4e5-f6a7-8901-bcde-f12345678901"),
        "name": "Borne Yopougon Marché",
        "location_lat": 5.3395,
        "location_lng": -4.0820,
        "status": "maintenance",
        "printer_endpoint": "Epson EcoTank L3250",
    },
    {
        "id": uuid.UUID("c3d4e5f6-a7b8-9012-cdef-123456789012"),
        "name": "Borne Treichville Gare",
        "location_lat": 5.3050,
        "location_lng": -3.9960,
        "status": "hors_ligne",
        "printer_endpoint": "Brother HL-L2350DW",
    },
    {
        "id": uuid.UUID("d4e5f6a7-b8c9-0123-defa-234567890123"),
        "name": "Borne Abobo Marché",
        "location_lat": 5.4185,
        "location_lng": -4.0200,
        "status": "actif",
        "printer_endpoint": "HP LaserJet Pro M404",
    },
]

# ── Données des agents ────────────────────────────────────────────────────────

AGENTS = [
    {
        "kiosk_id": uuid.UUID("3fa85f64-5717-4562-b3fc-2c963f66afa6"),
        "name": "Agent Hamed",
        "pin": "1234",
    },
    {
        "kiosk_id": uuid.UUID("a1b2c3d4-e5f6-7890-abcd-ef1234567890"),
        "name": "Agent Rachelle",
        "pin": "5678",
    },
    {
        "kiosk_id": uuid.UUID("b2c3d4e5-f6a7-8901-bcde-f12345678901"),
        "name": "Agent Christ",
        "pin": "9012",
    },
    {
        "kiosk_id": uuid.UUID("d4e5f6a7-b8c9-0123-defa-234567890123"),
        "name": "Agent Isaac",
        "pin": "3456",
    },
]


async def _upsert_kiosk(db: AsyncSession, data: dict) -> None:
    """Crée ou met à jour une borne (idempotent)."""
    result = await db.execute(select(Kiosk).where(Kiosk.id == data["id"]))
    kiosk = result.scalar_one_or_none()

    if kiosk is None:
        kiosk = Kiosk(**data)
        db.add(kiosk)
        logger.info(f"  ✅ Borne '{data['name']}' créée.")
    else:
        # Patch les champs si nécessaire
        changed = False
        for field in ("name", "location_lat", "location_lng", "status", "printer_endpoint"):
            if getattr(kiosk, field) != data[field]:
                setattr(kiosk, field, data[field])
                changed = True
        if changed:
            logger.info(f"  🔄 Borne '{data['name']}' mise à jour.")
        else:
            logger.info(f"  ⏭️  Borne '{data['name']}' déjà à jour.")


async def _upsert_agent(db: AsyncSession, data: dict) -> None:
    """Crée ou met à jour un agent (idempotent)."""
    result = await db.execute(
        select(Agent).where(
            Agent.kiosk_id == data["kiosk_id"],
            Agent.name == data["name"],
        )
    )
    agent = result.scalar_one_or_none()

    if agent is None:
        pin_hash = pwd_context.hash(data["pin"])
        agent = Agent(
            id=uuid.uuid4(),
            kiosk_id=data["kiosk_id"],
            name=data["name"],
            pin_hash=pin_hash,
        )
        db.add(agent)
        logger.info(f"  ✅ Agent '{data['name']}' créé (PIN: {data['pin']}).")
    else:
        logger.info(f"  ⏭️  Agent '{data['name']}' existe déjà.")


async def seed_database():
    logger.info("🌱 Démarrage du seeding...")

    async with AsyncSessionLocal() as db:
        # 1. Bornes
        logger.info("── Bornes ──")
        for kiosk_data in KIOSKS:
            await _upsert_kiosk(db, kiosk_data)

        await db.flush()

        # 2. Agents
        logger.info("── Agents ──")
        for agent_data in AGENTS:
            await _upsert_agent(db, agent_data)

        await db.commit()
        logger.info("✅ Seeding terminé avec succès !")


if __name__ == "__main__":
    async def main():
        await seed_database()

    asyncio.run(main())
