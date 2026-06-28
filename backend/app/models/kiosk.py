import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum, Float, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Kiosk(Base):
    __tablename__ = "kiosks"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    location_lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    location_lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    status: Mapped[str] = mapped_column(
        Enum("actif", "maintenance", "hors_ligne", name="kiosk_status"),
        nullable=False,
        default="actif",
    )
    # Nom de l'imprimante Windows (ex: "HP LaserJet Pro M404")
    printer_endpoint: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relations
    sessions: Mapped[list["Session"]] = relationship("Session", back_populates="kiosk")
    print_jobs: Mapped[list["PrintJob"]] = relationship("PrintJob", back_populates="kiosk")
    agents: Mapped[list["Agent"]] = relationship("Agent", back_populates="kiosk")
