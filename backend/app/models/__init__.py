# Importe tous les modèles pour qu'Alembic les détecte via autogenerate
from app.models.agent import Agent
from app.models.base import Base
from app.models.kiosk import Kiosk
from app.models.payment import Payment
from app.models.print_job import PrintJob
from app.models.scan_session import ScanSession
from app.models.session import Session

__all__ = ["Base", "Kiosk", "Session", "PrintJob", "Payment", "Agent", "ScanSession"]

