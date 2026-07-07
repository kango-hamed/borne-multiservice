"""
jobs.py — Endpoints de gestion des jobs d'impression.

<<<<<<< HEAD
POST  /jobs                → upload fichier, crée le job
PATCH /jobs/{id}/config    → configure options d'impression + calcule prix
GET   /jobs/{id}           → statut + position en file (polling léger)
GET   /jobs/{id}/preview   → aperçu de la première page (PNG)
GET   /jobs/{id}/download  → téléchargement du fichier source (PDF)
=======
POST   /jobs                          → upload fichier, crée le job
PATCH  /jobs/{id}/config              → configure options d'impression + calcule prix
GET    /jobs/{id}                     → statut + position en file (polling léger)
GET    /jobs/{id}/preview            → aperçu de la première page

Scan matériel (page par page depuis le scanner de la borne) :
POST   /jobs/scan/start              → ouvre une session de scan
POST   /jobs/scan/{scan_id}/page     → numérise UNE page, l'ajoute au document
GET    /jobs/scan/{id}/page/{n}/preview → vignette d'une page numérisée
DELETE /jobs/scan/{id}/page/{n}      → retire une page mal numérisée
POST   /jobs/scan/{scan_id}/finish   → clôture : assemble le PDF et crée le job
POST   /jobs/scan/{scan_id}/cancel   → abandonne la session de scan
>>>>>>> 11a7742272bcc674ea84898105eeb599d631f1f4
"""
import json
import shutil
import uuid
from datetime import datetime, timezone
from pathlib import Path

import aiofiles
from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Response,
    UploadFile,
    status,
)
from fastapi.responses import FileResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.exceptions import (
    EmptyScanError,
    JobNotFoundError,
    ScanSessionNotFoundError,
    SessionExpiredError,
    SessionNotFoundError,
    TooManyScanPagesError,
)
from app.models.print_job import PrintJob
from app.models.session import Session
from app.schemas.job import (
    JobConfig,
    JobCreateResponse,
    JobStatusResponse,
    ScanPageResponse,
    ScanPagesResponse,
    ScanStartResponse,
)
from app.services.pdf_utils import (
    assemble_scan_session,
    delete_scan_page,
    generate_preview,
    next_scan_page_number,
    save_scan_page,
    save_upload,
    scan_page_count,
    scan_preview_path,
    scan_session_dir,
)
from app.services.pricing import calculate_price
from app.services.scanner import acquire_page

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


# ── Scan matériel : acquisition page par page depuis le scanner de la borne ───
#
# Les images ne viennent plus du client : le backend pilote le scanner branché
# sur l'hôte de la borne et accumule les pages dans un dossier de travail
# (`UPLOAD_DIR/scan-<scan_id>/`). Le job d'impression n'est créé qu'à la clôture,
# entièrement formé, pour rejoindre le flux classique (config → prix → paiement).

def _load_scan_meta(scan_dir: Path) -> dict:
    """Charge les métadonnées d'une session de scan (lève 404 si absente)."""
    meta_path = scan_dir / "meta.json"
    if not meta_path.exists():
        raise ScanSessionNotFoundError()
    return json.loads(meta_path.read_text(encoding="utf-8"))


@router.post("/scan/start", response_model=ScanStartResponse, status_code=201)
async def start_scan(
    session_token: uuid.UUID = Form(...),
    grayscale: bool = Form(False),
    db: AsyncSession = Depends(get_db),
) -> ScanStartResponse:
    """
    Ouvre une session de scan. Valide la session borne et crée un dossier de
    travail vide. Le choix N&B (`grayscale`) est figé pour tout le document.
    """
    session = await _get_valid_session(session_token, db)

    scan_id = uuid.uuid4()
    scan_dir = scan_session_dir(scan_id)
    scan_dir.mkdir(parents=True, exist_ok=True)

    meta = {
        "session_id": str(session.id),
        "kiosk_id": str(session.kiosk_id),
        "grayscale": grayscale,
    }
    (scan_dir / "meta.json").write_text(json.dumps(meta), encoding="utf-8")

    return ScanStartResponse(scan_id=scan_id, pages=0)


@router.post("/scan/{scan_id}/page", response_model=ScanPageResponse, status_code=201)
async def scan_page(scan_id: uuid.UUID) -> ScanPageResponse:
    """
    Numérise UNE page sur le scanner de la borne et l'ajoute au document.

    Le pilotage matériel peut lever ScannerUnavailableError (503) ou
    ScanTimeoutError (504) ; le maximum de pages lève TooManyScanPagesError (413).
    """
    scan_dir = scan_session_dir(scan_id)
    meta = _load_scan_meta(scan_dir)

    if scan_page_count(scan_dir) >= settings.MAX_SCAN_PAGES:
        raise TooManyScanPagesError(settings.MAX_SCAN_PAGES)

    grayscale = bool(meta.get("grayscale", False))

    # Acquisition matérielle (peut lever ScannerUnavailableError / ScanTimeoutError)
    raw = await acquire_page(grayscale)

    page_number = next_scan_page_number(scan_dir)
    await save_scan_page(scan_dir, raw, grayscale, page_number)

    return ScanPageResponse(
        scan_id=scan_id,
        page_number=page_number,
        pages=scan_page_count(scan_dir),
        page_preview_url=f"/jobs/scan/{scan_id}/page/{page_number}/preview",
    )


@router.get("/scan/{scan_id}/page/{page_number}/preview")
async def get_scan_page_preview(scan_id: uuid.UUID, page_number: int) -> FileResponse:
    """Retourne la vignette PNG d'une page numérisée."""
    scan_dir = scan_session_dir(scan_id)
    preview_path = scan_preview_path(scan_dir, page_number)

    if not preview_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Aperçu de page introuvable.",
        )

    return FileResponse(
        path=str(preview_path),
        media_type="image/png",
        filename=f"scan-page-{page_number}.png",
    )


@router.delete("/scan/{scan_id}/page/{page_number}", response_model=ScanPagesResponse)
async def remove_scan_page(scan_id: uuid.UUID, page_number: int) -> ScanPagesResponse:
    """Retire une page mal numérisée (sans renumérotation des autres)."""
    scan_dir = scan_session_dir(scan_id)
    _load_scan_meta(scan_dir)  # 404 si la session n'existe pas

    if not delete_scan_page(scan_dir, page_number):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Page introuvable.",
        )

    return ScanPagesResponse(scan_id=scan_id, pages=scan_page_count(scan_dir))


@router.post("/scan/{scan_id}/finish", response_model=JobCreateResponse, status_code=201)
async def finish_scan(
    scan_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> JobCreateResponse:
    """
    Clôture la session de scan : assemble le PDF, crée le job (statut
    "en_creation") et nettoie le dossier de travail. Le job rejoint alors le flux
    classique (config → prix → paiement).
    """
    scan_dir = scan_session_dir(scan_id)
    meta = _load_scan_meta(scan_dir)

    # Re-valide la session borne rattachée au scan
    session = await _get_valid_session(uuid.UUID(meta["session_id"]), db)

    if scan_page_count(scan_dir) == 0:
        raise EmptyScanError()

    grayscale = bool(meta.get("grayscale", False))
    job_id = uuid.uuid4()

    # Assemble les pages accumulées en un PDF imprimable + aperçu
    file_path, pages = await assemble_scan_session(scan_dir, job_id, grayscale)

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

    # Nettoyage du dossier de travail (le PDF vit désormais dans le dossier du job)
    shutil.rmtree(scan_dir, ignore_errors=True)

    return JobCreateResponse(
        job_id=job.id,
        original_filename=original_filename,
        pages=pages,
        status=job.status,
        preview_url=f"/jobs/{job_id}/preview",
    )


@router.post("/scan/{scan_id}/cancel", status_code=204)
async def cancel_scan(scan_id: uuid.UUID) -> Response:
    """Abandonne une session de scan et supprime son dossier de travail."""
    shutil.rmtree(scan_session_dir(scan_id), ignore_errors=True)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


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
