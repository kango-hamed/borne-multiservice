"""
scan_session.py — Modèle de session de scan physique (WIA).

Une ScanSession représente une séquence d'acquisitions WIA page par page.
Chaque acquisition produit une image PNG sur disque :
    uploads/scan_{id}/page_001.png
    uploads/scan_{id}/page_002.png
    ...

Quand l'agent finalise, les images sont assemblées en PDF et un PrintJob
standard est créé — il rejoint la file d'impression comme n'importe quel upload.

États :
    ouvert          → session créée, prête à acquérir des pages
    en_acquisition  → WIA en cours (verrou contre les double-clics agent)
    termine         → PDF assemblé, PrintJob créé
    annule          → session abandonnée
"""
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class ScanSession(Base):
    __tablename__ = "scan_sessions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # ── Borne et session usager ───────────────────────────────────────────────
    kiosk_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("kiosks.id", ondelete="CASCADE"), nullable=False
    )
    # session_id est nullable : la photocopie peut être initiée sans QR scan
    session_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sessions.id", ondelete="SET NULL"), nullable=True
    )

    # ── Paramètres de scan ────────────────────────────────────────────────────
    color_mode: Mapped[str] = mapped_column(
        Enum("nb", "couleur", name="color_mode"),
        nullable=False,
        default="nb",
    )
    # Résolution DPI demandée par l'agent (150 / 200 / 300)
    resolution: Mapped[int] = mapped_column(Integer, nullable=False, default=200)

    # ── État de la session ────────────────────────────────────────────────────
    status: Mapped[str] = mapped_column(
        Enum(
            "ouvert",
            "en_acquisition",
            "termine",
            "annule",
            name="scan_session_status",
        ),
        nullable=False,
        default="ouvert",
    )

    # Nombre de pages correctement acquises
    pages_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # ── Résultat ──────────────────────────────────────────────────────────────
    # Rempli par finalize() : chemin du PDF assemblé
    pdf_path: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    # Rempli par finalize() : PrintJob créé à partir du PDF
    print_job_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("print_jobs.id", ondelete="SET NULL"), nullable=True
    )

    # ── Horodatage ────────────────────────────────────────────────────────────
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # ── Relations ─────────────────────────────────────────────────────────────
    kiosk: Mapped["Kiosk"] = relationship("Kiosk")
    print_job: Mapped["PrintJob | None"] = relationship("PrintJob")
