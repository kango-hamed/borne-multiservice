"""
jobs.py — Endpoints de gestion des jobs d'impression.

POST  /jobs                → upload fichier, crée le job
PATCH /jobs/{id}/config    → configure options d'impression + calcule prix
GET   /jobs/{id}           → statut + position en file (polling léger)
GET   /jobs/{id}/preview   → aperçu de la première page (PNG)
GET   /jobs/{id}/download  → téléchargement du fichier source (PDF)
"""
import uuid
from datetime import datetime, timezone
from pathlib import Path

import aiofiles
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.exceptions import (
    EmptyScanError,
    JobNotFoundError,
    SessionExpiredError,
    SessionNotFoundError,
    UnsupportedFileFormatError,
)
from app.models.print_job import PrintJob
from app.models.session import Session
from app.schemas.job import JobConfig, JobCreateResponse, JobStatusResponse
from app.services.pdf_utils import (
    SCAN_ALLOWED_MIME_TYPES,
    generate_preview,
    save_scan_as_pdf,
    save_upload,
)
from app.services.pricing import calculate_price

router = APIRouter(tags=["Jobs"])


async def _get_valid_session(session_token: uuid.UUID, db: AsyncSession) -> Session:
    """Vérifie qu'une session est active, lève une exception sinon."""
    result = await db.execute(select(Session).where(Session.id == session_token))
    session = result.scalar_one_or_none()

    if session is None:
        raise SessionNotFoundError()

    now = datetime.now(timezone.utc)
    expires_at = session.expires_at
    if expires_at.tzinfo is None:
        now = now.replace(tzinfo=None)

    if session.status == "active" and expires_at < now:
        session.status = "expiree"
        await db.flush()

    if session.status != "active":
        raise SessionExpiredError()

    return session


async def _get_queue_position(job: PrintJob, db: AsyncSession) -> int | None:
    """Calcule la position du job dans la file FIFO de sa borne."""
    if job.status not in ("paye", "impression_en_cours"):
        return None

    result = await db.execute(
        select(func.count(PrintJob.id)).where(
            PrintJob.kiosk_id == job.kiosk_id,
            PrintJob.status.in_(["paye", "impression_en_cours"]),
            PrintJob.created_at <= job.created_at,
        )
    )
    return result.scalar_one()


@router.post("", response_model=JobCreateResponse, status_code=201)
async def create_job(
    session_token: uuid.UUID = Form(...),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
) -> JobCreateResponse:
    """
    Upload d'un fichier et création d'un job d'impression.

    - Valide la session
    - Valide le type et la taille du fichier
    - Sauvegarde sur disque
    - Compte les pages
    - Génère un aperçu
    - Crée le job en statut "en_creation"
    """
    # Validation session
    session = await _get_valid_session(session_token, db)

    # Lecture du fichier en mémoire (validation taille incluse dans save_upload)
    file_content = await file.read()

    job_id = uuid.uuid4()

    # Sauvegarde + comptage pages (lève FileTooLargeError / UnsupportedFileFormatError si invalide)
    file_path, pages = await save_upload(
        file_content=file_content,
        original_filename=file.filename or "document",
        content_type=file.content_type or "application/octet-stream",
        job_id=job_id,
    )

    # Génération aperçu
    mime = (file.content_type or "").split(";")[0].strip()
    preview_path = await generate_preview(file_path, mime, job_id)
    preview_url = f"/jobs/{job_id}/preview" if preview_path else ""

    # Création du job en base
    job = PrintJob(
        id=job_id,
        session_id=session.id,
        kiosk_id=session.kiosk_id,
        file_path=file_path,
        original_filename=file.filename or "document",
        pages=pages,
        status="en_creation",
    )
    db.add(job)
    await db.flush()

    return JobCreateResponse(
        job_id=job.id,
        original_filename=job.original_filename,
        pages=pages,
        status=job.status,
        preview_url=preview_url,
    )


@router.post("/scan", response_model=JobCreateResponse, status_code=201)
async def create_scan_job(
    session_token: uuid.UUID = Form(...),
    files: list[UploadFile] = File(...),
    grayscale: bool = Form(False),
    db: AsyncSession = Depends(get_db),
) -> JobCreateResponse:
    """
    Scan de document : assemble plusieurs photos de pages en un PDF imprimable.

    L'usager photographie chaque page depuis son téléphone ; les images sont
    envoyées ici dans l'ordre et combinées en un seul document multi-pages qui
    rejoint le flux d'impression classique (config → prix → paiement).

    - Valide la session
    - Valide que chaque fichier est bien une image
    - Assemble le PDF (option `grayscale` pour optimiser les documents texte)
    - Génère un aperçu de la première page
    - Crée le job en statut "en_creation"
    """
    session = await _get_valid_session(session_token, db)

    if not files:
        raise EmptyScanError()

    # Lecture + validation du type de chaque photo
    images: list[bytes] = []
    for upload in files:
        mime = (upload.content_type or "").split(";")[0].strip()
        if mime not in SCAN_ALLOWED_MIME_TYPES:
            raise UnsupportedFileFormatError(mime or "inconnu")
        images.append(await upload.read())

    job_id = uuid.uuid4()

    # Assemblage PDF + aperçu (lève EmptyScan / TooManyScanPages / FileTooLarge)
    file_path, pages = await save_scan_as_pdf(images, job_id, grayscale)

    original_filename = "Document scanné.pdf"

    job = PrintJob(
        id=job_id,
        session_id=session.id,
        kiosk_id=session.kiosk_id,
        file_path=file_path,
        original_filename=original_filename,
        pages=pages,
        status="en_creation",
    )
    db.add(job)
    await db.flush()

    return JobCreateResponse(
        job_id=job.id,
        original_filename=original_filename,
        pages=pages,
        status=job.status,
        preview_url=f"/jobs/{job_id}/preview",
    )


@router.patch("/{job_id}/config", response_model=JobStatusResponse)
async def configure_job(
    job_id: uuid.UUID,
    config: JobConfig,
    db: AsyncSession = Depends(get_db),
) -> JobStatusResponse:
    """
    Configure les options d'impression et calcule le prix.
    Passe le job en statut "attente_paiement".
    """
    result = await db.execute(select(PrintJob).where(PrintJob.id == job_id))
    job = result.scalar_one_or_none()

    if job is None:
        raise JobNotFoundError()

    if job.status not in ("en_creation", "attente_paiement"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Impossible de reconfigurer un job en statut '{job.status}'.",
        )

    # Application de la configuration
    job.copies = config.copies
    job.color_mode = config.color_mode
    job.duplex = config.duplex
    job.paper_format = config.paper_format

    # Calcul du prix
    job.price_fcfa = calculate_price(
        pages=job.pages,
        copies=config.copies,
        color_mode=config.color_mode,
        duplex=config.duplex,
    )
    job.status = "attente_paiement"
    await db.flush()

    return JobStatusResponse(
        job_id=job.id,
        status=job.status,
        pages=job.pages,
        copies=job.copies,
        color_mode=job.color_mode,
        duplex=job.duplex,
        paper_format=job.paper_format,
        price_fcfa=job.price_fcfa,
        queue_position=None,
        withdrawal_code=None,
    )


@router.get("/{job_id}", response_model=JobStatusResponse)
async def get_job_status(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> JobStatusResponse:
    """
    Retourne le statut du job et sa position en file.
    Endpoint léger — utilisé pour le polling frontend (toutes les 2-3 secondes).
    Pas de jointures lourdes.
    """
    result = await db.execute(select(PrintJob).where(PrintJob.id == job_id))
    job = result.scalar_one_or_none()

    if job is None:
        raise JobNotFoundError()

    queue_position = await _get_queue_position(job, db)

    # Le code de retrait n'est exposé que si le document est prêt
    withdrawal_code = (
        job.withdrawal_code
        if job.status in ("pret_a_retirer", "recupere")
        else None
    )

    return JobStatusResponse(
        job_id=job.id,
        status=job.status,
        pages=job.pages,
        copies=job.copies,
        color_mode=job.color_mode,
        duplex=job.duplex,
        paper_format=job.paper_format,
        price_fcfa=job.price_fcfa,
        queue_position=queue_position,
        withdrawal_code=withdrawal_code,
    )


@router.get("/{job_id}/preview")
async def get_job_preview(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> FileResponse:
    """
    Retourne l'aperçu PNG de la première page du document.
    """
    result = await db.execute(select(PrintJob).where(PrintJob.id == job_id))
    job = result.scalar_one_or_none()

    if job is None:
        raise JobNotFoundError()

    preview_path = Path(settings.UPLOAD_DIR) / str(job_id) / "preview.png"

    if not preview_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Aperçu non disponible pour ce document.",
        )

    return FileResponse(
        path=str(preview_path),
        media_type="image/png",
        filename="preview.png",
    )


@router.get("/{job_id}/download")
async def download_job_document(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> FileResponse:
    """
    Retourne le fichier source du job (PDF ou image) pour téléchargement.
    Utilisé principalement par le flux Scan de document pour permettre
    à l'utilisateur de récupérer son PDF.
    """
    result = await db.execute(select(PrintJob).where(PrintJob.id == job_id))
    job = result.scalar_one_or_none()

    if job is None:
        raise JobNotFoundError()

    file_path = Path(job.file_path)
    if not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Fichier source introuvable.",
        )

    # Détermine le Content-Type et le nom de téléchargement selon l'extension
    suffix = file_path.suffix.lower()
    media_types = {
        ".pdf":  "application/pdf",
        ".jpg":  "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png":  "image/png",
        ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }
    media_type = media_types.get(suffix, "application/octet-stream")
    filename = job.original_filename or file_path.name

    return FileResponse(
        path=str(file_path),
        media_type=media_type,
        filename=filename,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )
