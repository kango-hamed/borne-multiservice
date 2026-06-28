import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    print_job_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("print_jobs.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,  # 1 paiement par job maximum
    )

    # ── Provider ──────────────────────────────────────────────────────────────
    provider: Mapped[str] = mapped_column(
        Enum("orange_money", "mtn", "moov", "wave", "mock", name="payment_provider"),
        nullable=False,
    )
    # Identifiant unique côté provider — clé d'idempotence
    # UNIQUE + nullable : NULL avant confirmation, valeur unique après
    provider_transaction_id: Mapped[str | None] = mapped_column(
        String(255), nullable=True, unique=True
    )

    # ── Montant ───────────────────────────────────────────────────────────────
    amount_fcfa: Mapped[int] = mapped_column(Integer, nullable=False)

    # ── Statut (contrat partagé avec le frontend — NE PAS RENOMMER) ───────────
    status: Mapped[str] = mapped_column(
        Enum("initie", "en_attente", "confirme", "echoue", name="payment_status"),
        nullable=False,
        default="initie",
    )

    # ── Horodatage ────────────────────────────────────────────────────────────
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    confirmed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # ── Relations ─────────────────────────────────────────────────────────────
    print_job: Mapped["PrintJob"] = relationship("PrintJob", back_populates="payment")
