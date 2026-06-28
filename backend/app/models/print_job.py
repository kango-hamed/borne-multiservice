import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class PrintJob(Base):
    __tablename__ = "print_jobs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sessions.id", ondelete="SET NULL"), nullable=True
    )
    kiosk_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("kiosks.id", ondelete="CASCADE"), nullable=False
    )

    # ── Fichier ───────────────────────────────────────────────────────────────
    file_path: Mapped[str] = mapped_column(String(1000), nullable=False)
    original_filename: Mapped[str] = mapped_column(String(500), nullable=False)

    # ── Options d'impression ──────────────────────────────────────────────────
    pages: Mapped[int] = mapped_column(Integer, nullable=False)  # calculé à l'upload
    copies: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    color_mode: Mapped[str] = mapped_column(
        Enum("nb", "couleur", name="color_mode"),
        nullable=False,
        default="nb",
    )
    duplex: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    paper_format: Mapped[str] = mapped_column(String(10), nullable=False, default="A4")

    # ── Prix ──────────────────────────────────────────────────────────────────
    price_fcfa: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # ── Statut (contrat partagé avec le frontend — NE PAS RENOMMER) ───────────
    status: Mapped[str] = mapped_column(
        Enum(
            "en_creation",
            "attente_paiement",
            "paye",
            "paiement_expire",
            "impression_en_cours",
            "pret_a_retirer",
            "recupere",
            name="print_job_status",
        ),
        nullable=False,
        default="en_creation",
    )

    # ── Retrait ───────────────────────────────────────────────────────────────
    # Code à 4 chiffres, généré uniquement lorsque status → "paye"
    withdrawal_code: Mapped[str | None] = mapped_column(String(4), nullable=True)

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
    session: Mapped["Session"] = relationship("Session", back_populates="print_jobs")
    kiosk: Mapped["Kiosk"] = relationship("Kiosk", back_populates="print_jobs")
    payment: Mapped["Payment | None"] = relationship(
        "Payment", back_populates="print_job", uselist=False
    )
