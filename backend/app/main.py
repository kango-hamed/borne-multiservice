"""
main.py — Point d'entrée de l'API FastAPI Borne Multiservice.

Responsabilités :
  - Déclaration de l'app FastAPI
  - Lifespan : démarrage/arrêt du worker d'impression
  - Enregistrement des routers
  - Middleware CORS
  - Création du répertoire d'uploads au démarrage
"""
import asyncio
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import admin, jobs, payments, sessions
from app.workers.print_queue_worker import print_queue_worker

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)


# ── Lifespan ──────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Tâches au démarrage et à l'arrêt de l'application.
    """
    # Création du répertoire d'uploads
    Path(settings.UPLOAD_DIR).mkdir(parents=True, exist_ok=True)
    logger.info(f"Répertoire uploads : {Path(settings.UPLOAD_DIR).resolve()}")

    # ── Log de configuration CORS (visible immédiatement au démarrage) ────────
    logger.info("=" * 60)
    logger.info(f"Environnement       : {settings.ENVIRONMENT}")
    logger.info(f"Mode production     : {settings.is_production}")
    logger.info(f"Origines CORS       : {settings.cors_origins_list}")
    logger.info("=" * 60)

    # Démarrage du worker d'impression en arrière-plan
    worker_task = asyncio.create_task(print_queue_worker())
    logger.info("Worker d'impression démarré.")

    yield  # L'application tourne ici

    # Arrêt propre du worker
    worker_task.cancel()
    try:
        await worker_task
    except asyncio.CancelledError:
        pass
    logger.info("Worker d'impression arrêté.")


# ── Application ───────────────────────────────────────────────────────────────
app = FastAPI(
    title="Borne Multiservice — API",
    description=(
        "API backend pour la borne d'accès numérique multiservice. "
        "Gère les sessions, les jobs d'impression, les paiements (mock) "
        "et l'interface admin pour les agents."
    ),
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS ──────────────────────────────────────────────────────────────────────
# Origines lues depuis CORS_ORIGINS dans .env (liste CSV).
# Valeur par défaut : http://localhost:3000,http://127.0.0.1:3000
# IMPORTANT : ne JAMAIS combiner allow_origins=["*"] avec allow_credentials=True
#             → rejeté par tous les navigateurs (violation spec CORS).
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(sessions.router, prefix="/sessions")
app.include_router(jobs.router, prefix="/jobs")
app.include_router(payments.router, prefix="/payments")
app.include_router(admin.router, prefix="/admin")


# ── Endpoint de debug (dev uniquement) ───────────────────────────────────────
if not settings.is_production:
    from fastapi import APIRouter

    dev_router = APIRouter(prefix="/dev", tags=["Debug (dev uniquement)"])

    @dev_router.post("/payments/{txn_id}/force-success")
    async def force_payment_success(txn_id: str) -> dict:
        """Force la confirmation d'un paiement mock."""
        from app.services.payment_providers.mock_provider import force_mock_status
        ok = await force_mock_status(txn_id, "confirme")
        return {"success": ok, "transaction_id": txn_id, "status": "confirme"}

    @dev_router.post("/payments/{txn_id}/force-fail")
    async def force_payment_fail(txn_id: str) -> dict:
        """Force l'échec d'un paiement mock."""
        from app.services.payment_providers.mock_provider import force_mock_status
        ok = await force_mock_status(txn_id, "echoue")
        return {"success": ok, "transaction_id": txn_id, "status": "echoue"}

    app.include_router(dev_router)


# ── Health check ──────────────────────────────────────────────────────────────
@app.get("/health", tags=["Système"])
async def health_check() -> dict:
    """Vérifie que l'API est opérationnelle."""
    return {
        "status": "ok",
        "environment": settings.ENVIRONMENT,
        "version": "0.1.0",
    }
