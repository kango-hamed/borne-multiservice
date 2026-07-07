"""
scan.py — Endpoints pour la gestion du scanner WIA.

Accès libre (réseau local de la borne) — pas d'authentification requise.
"""
import logging
import uuid
import shutil
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.exceptions import (
    KioskNotFoundError,
    KioskOfflineError,
    ScanSessionNotFoundError,
    ScanSessionClosedError,
    ScanSessionBusyError,
    ScanNoPageError,
)
from app.models.kiosk import Kiosk
from app.models.scan_session import ScanSession
from app.models.print_job import PrintJob
from app.schemas.scan import (
    ScanSessionCreate,
    ScanSessionResponse,
    ScanAcquireResponse,
    ScanFinalizeResponse,
    ScanDeviceListResponse,
    ScannedPageInfo,
)
from app.services.wia_scanner import scan_page, list_wia_devices, _build_page_path
from app.services.pdf_utils import assemble_scan_pdf

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Scan WIA"])


async def _get_scan_session(scan_session_id: uuid.UUID, db: AsyncSession) -> ScanSession:
    """Récupère une ScanSession active, lève une exception si introuvable."""
    result = await db.execute(select(ScanSession).where(ScanSession.id == scan_session_id))
    scan_sess = result.scalar_one_or_none()
    if scan_sess is None:
        raise ScanSessionNotFoundError()
    return scan_sess


def _get_session_pages(scan_session_id: uuid.UUID) -> list[ScannedPageInfo]:
    """Liste dynamiquement les pages scannées sur disque."""
    session_dir = Path(settings.UPLOAD_DIR) / f"scan_{scan_session_id}"
    if not session_dir.exists():
        return []

    pages = []
    for filepath in sorted(session_dir.glob("page_*.png")):
        filename = filepath.name
        try:
            # page_001.png -> 001 -> 1
            parts = filename.split("_")
            if len(parts) >= 2:
                page_num = int(parts[1].split(".")[0])
                preview_url = f"/scan/sessions/{scan_session_id}/pages/{page_num}/preview"
                pages.append(ScannedPageInfo(page_number=page_num, preview_url=preview_url))
        except (IndexError, ValueError):
            continue
    return pages


@router.post("/sessions", response_model=ScanSessionResponse, status_code=201)
async def create_scan_session(
    body: ScanSessionCreate,
    db: AsyncSession = Depends(get_db),
) -> ScanSessionResponse:
    """
    Crée une nouvelle session de scan.
    Vérifie uniquement que la borne est active (accès libre réseau local).
    """
    # 1. Vérification borne
    result = await db.execute(select(Kiosk).where(Kiosk.id == body.kiosk_id))
    kiosk = result.scalar_one_or_none()
    if kiosk is None:
        raise KioskNotFoundError(str(body.kiosk_id))
    if kiosk.status != "actif":
        raise KioskOfflineError()

    # 2. Création
    scan_sess = ScanSession(
        id=uuid.uuid4(),
        kiosk_id=body.kiosk_id,
        session_id=None,
        color_mode=body.color_mode,
        resolution=body.resolution,
        status="ouvert",
        pages_count=0,
    )
    db.add(scan_sess)
    await db.flush()

    return ScanSessionResponse(
        scan_session_id=scan_sess.id,
        status=scan_sess.status,
        pages_count=0,
        color_mode=scan_sess.color_mode,
        resolution=scan_sess.resolution,
        pages=[],
        created_at=scan_sess.created_at,
    )


@router.post("/sessions/{scan_session_id}/acquire", response_model=ScanAcquireResponse)
async def acquire_page(
    scan_session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> ScanAcquireResponse:
    """
    Déclenche l'acquisition d'une page (synchrone/bloquant).
    Accès libre — pas d'authentification requise.
    """
    # 1. Récupération de la session de scan
    scan_sess = await _get_scan_session(scan_session_id, db)

    # 2. Validation statut session
    if scan_sess.status == "en_acquisition":
        raise ScanSessionBusyError()
    if scan_sess.status != "ouvert":
        raise ScanSessionClosedError(scan_sess.status)

    # 4. Passage en acquisition
    scan_sess.status = "en_acquisition"
    await db.commit()

    # 5. Déclenchement du scan
    next_page_num = scan_sess.pages_count + 1
    success = False
    try:
        await scan_page(
            scan_session_id=scan_sess.id,
            page_number=next_page_num,
            color_mode=scan_sess.color_mode,
            resolution=scan_sess.resolution,
        )
        success = True
    except Exception as e:
        logger.error(f"Erreur d'acquisition scan_session={scan_sess.id} : {e}")
        # Restauration de l'état ouvert pour réessai
        async with AsyncSessionLocal() as db2:
            res2 = await db2.execute(select(ScanSession).where(ScanSession.id == scan_session_id))
            sess2 = res2.scalar_one_or_none()
            if sess2:
                sess2.status = "ouvert"
                await db2.commit()
        raise e

    # 6. Succès -> mise à jour
    if success:
        # Re-fetch pour mise à jour
        result = await db.execute(select(ScanSession).where(ScanSession.id == scan_session_id))
        scan_sess = result.scalar_one()
        scan_sess.pages_count += 1
        scan_sess.status = "ouvert"
        await db.commit()

        preview_url = f"/scan/sessions/{scan_sess.id}/pages/{next_page_num}/preview"
        return ScanAcquireResponse(
            scan_session_id=scan_sess.id,
            page_number=next_page_num,
            pages_count=scan_sess.pages_count,
            status=scan_sess.status,
            preview_url=preview_url,
        )


@router.get("/sessions/{scan_session_id}", response_model=ScanSessionResponse)
async def get_scan_session(
    scan_session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> ScanSessionResponse:
    """Récupère l'état d'une session de scan."""
    result = await db.execute(select(ScanSession).where(ScanSession.id == scan_session_id))
    scan_sess = result.scalar_one_or_none()
    if scan_sess is None:
        raise ScanSessionNotFoundError()

    pages = _get_session_pages(scan_session_id)

    return ScanSessionResponse(
        scan_session_id=scan_sess.id,
        status=scan_sess.status,
        pages_count=scan_sess.pages_count,
        color_mode=scan_sess.color_mode,
        resolution=scan_sess.resolution,
        pages=pages,
        print_job_id=scan_sess.print_job_id,
        created_at=scan_sess.created_at,
    )


@router.get("/sessions/{scan_session_id}/pages/{page_number}/preview")
async def get_scan_page_preview(
    scan_session_id: uuid.UUID,
    page_number: int,
) -> FileResponse:
    """Retourne l'aperçu de l'image PNG scannée."""
    preview_path = _build_page_path(scan_session_id, page_number)
    if not preview_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Aperçu de la page de scan introuvable.",
        )

    return FileResponse(
        path=str(preview_path),
        media_type="image/png",
        filename=f"page_{page_number}.png",
    )


@router.delete("/sessions/{scan_session_id}/pages/{page_number}", response_model=ScanSessionResponse)
async def delete_scan_page(
    scan_session_id: uuid.UUID,
    page_number: int,
    db: AsyncSession = Depends(get_db),
) -> ScanSessionResponse:
    """
    Supprime la dernière page scannée de la session (pour corriger un mauvais scan).
    Ne permet que de supprimer la dernière page pour conserver l'ordre séquentiel.
    """
    scan_sess = await _get_scan_session(scan_session_id, db)

    if scan_sess.status != "ouvert":
        raise ScanSessionClosedError(scan_sess.status)

    if page_number != scan_sess.pages_count or page_number <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Seule la dernière page scannée peut être supprimée pour préserver l'ordre.",
        )

    # Suppression du fichier sur disque
    filepath = _build_page_path(scan_session_id, page_number)
    if filepath.exists():
        filepath.unlink()

    # Mise à jour de la base de données
    scan_sess.pages_count -= 1
    await db.commit()

    pages = _get_session_pages(scan_session_id)
    return ScanSessionResponse(
        scan_session_id=scan_sess.id,
        status=scan_sess.status,
        pages_count=scan_sess.pages_count,
        color_mode=scan_sess.color_mode,
        resolution=scan_sess.resolution,
        pages=pages,
        print_job_id=scan_sess.print_job_id,
        created_at=scan_sess.created_at,
    )


@router.post("/sessions/{scan_session_id}/finalize", response_model=ScanFinalizeResponse)
async def finalize_scan_session(
    scan_session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> ScanFinalizeResponse:
    """
    Finalise la session : assemble les PNGs en PDF et crée le PrintJob associé.
    """
    scan_sess = await _get_scan_session(scan_session_id, db)

    if scan_sess.status != "ouvert":
        raise ScanSessionClosedError(scan_sess.status)

    if scan_sess.pages_count <= 0:
        raise ScanNoPageError()

    # 1. Lister les fichiers PNG
    pages_info = _get_session_pages(scan_session_id)
    image_paths = [str(_build_page_path(scan_session_id, p.page_number)) for p in pages_info]

    # 2. Générer le job ID
    job_id = uuid.uuid4()

    # 3. Assembler le PDF
    pdf_path, pages_count = await assemble_scan_pdf(image_paths, job_id)

    # 4. Calcul du prix du scan : 25 FCFA/page en N&B, 75 FCFA/page en Couleur
    price_per_page = 75 if scan_sess.color_mode == "couleur" else 25
    total_price = price_per_page * pages_count

    # 5. Création du PrintJob standard directement prêt pour le paiement
    job = PrintJob(
        id=job_id,
        session_id=scan_sess.session_id,
        kiosk_id=scan_sess.kiosk_id,
        file_path=pdf_path,
        original_filename="Document scanné.pdf",
        pages=pages_count,
        copies=1,
        color_mode=scan_sess.color_mode,
        duplex=False,
        price_fcfa=total_price,
        status="attente_paiement",
    )
    db.add(job)

    # 6. Clôture de la session de scan
    scan_sess.status = "termine"
    scan_sess.pdf_path = pdf_path
    scan_sess.print_job_id = job_id
    await db.commit()

    return ScanFinalizeResponse(
        scan_session_id=scan_sess.id,
        print_job_id=job_id,
        pages=pages_count,
        status="termine",
    )


@router.post("/sessions/{scan_session_id}/cancel")
async def cancel_scan_session(
    scan_session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Annule la session de scan et nettoie les fichiers temporaires sur disque.
    """
    scan_sess = await _get_scan_session(scan_session_id, db)

    if scan_sess.status not in ("ouvert", "en_acquisition"):
        raise ScanSessionClosedError(scan_sess.status)

    # Nettoyage des fichiers
    session_dir = Path(settings.UPLOAD_DIR) / f"scan_{scan_session_id}"
    if session_dir.exists():
        shutil.rmtree(session_dir)

    # Annulation
    scan_sess.status = "annule"
    await db.commit()

    return {"status": "annule", "scan_session_id": scan_session_id}


@router.get("/devices", response_model=ScanDeviceListResponse)
async def get_scan_devices() -> ScanDeviceListResponse:
    """Liste les scanners physiques disponibles (diagnostic)."""
    devices = await list_wia_devices()
    return ScanDeviceListResponse(
        devices=devices,
        scanning_mode=settings.SCANNING_MODE,
    )


# Importation différée pour éviter les cycles d'importation
from app.database import AsyncSessionLocal
