"""
pdf_utils.py — Traitement des fichiers uploadés.

Responsabilités :
  - Validation du type MIME et de la taille
  - Comptage du nombre de pages
  - Génération d'un aperçu (PNG de la première page)
  - Sauvegarde sécurisée sur disque
"""
import io
import logging
import mimetypes
import os
import re
import uuid
from pathlib import Path

import aiofiles
from PIL import Image

from app.config import settings
from app.exceptions import FileTooLargeError, UnsupportedFileFormatError

logger = logging.getLogger(__name__)

# ── Types MIME autorisés ──────────────────────────────────────────────────────
ALLOWED_MIME_TYPES: dict[str, str] = {
    "application/pdf": ".pdf",
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
}


def _sanitize_filename(filename: str) -> str:
    """Supprime les caractères dangereux du nom de fichier."""
    # Garde uniquement alphanum, tirets, underscores, points
    name = re.sub(r"[^\w.\-]", "_", Path(filename).name)
    return name[:200]  # Limite la longueur


async def save_upload(
    file_content: bytes,
    original_filename: str,
    content_type: str,
    job_id: uuid.UUID,
) -> tuple[str, int]:
    """
    Sauvegarde le fichier uploadé et retourne (file_path, pages).

    Args:
        file_content: Contenu brut du fichier
        original_filename: Nom original côté client
        content_type: MIME type déclaré
        job_id: UUID du job (utilisé pour nommer le répertoire)

    Returns:
        (chemin absolu du fichier, nombre de pages)

    Raises:
        FileTooLargeError: si taille > MAX_FILE_SIZE_MB
        UnsupportedFileFormatError: si MIME non autorisé
    """
    # Validation taille
    if len(file_content) > settings.max_file_size_bytes:
        raise FileTooLargeError(settings.MAX_FILE_SIZE_MB)

    # Validation MIME
    # Normalise le MIME (certains navigateurs ajoutent des paramètres ex: "application/pdf; charset=...")
    mime = content_type.split(";")[0].strip()
    if mime not in ALLOWED_MIME_TYPES:
        raise UnsupportedFileFormatError(mime)

    # Création du répertoire du job
    job_dir = Path(settings.UPLOAD_DIR) / str(job_id)
    job_dir.mkdir(parents=True, exist_ok=True)

    # Nom de fichier sécurisé
    safe_name = _sanitize_filename(original_filename)
    file_path = job_dir / safe_name

    # Écriture async sur disque
    async with aiofiles.open(file_path, "wb") as f:
        await f.write(file_content)

    logger.info(f"Fichier sauvegardé : {file_path} ({len(file_content)} octets)")

    # Comptage des pages
    pages = await count_pages(str(file_path), mime)

    return str(file_path.resolve()), pages


async def count_pages(file_path: str, mime_type: str) -> int:
    """Compte le nombre de pages selon le type de fichier."""
    if mime_type == "application/pdf":
        return _count_pdf_pages(file_path)
    elif mime_type in ("image/jpeg", "image/png"):
        return 1
    elif mime_type == "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        return _estimate_docx_pages(file_path)
    return 1


def _count_pdf_pages(file_path: str) -> int:
    """Compte les pages d'un PDF via pypdf."""
    try:
        from pypdf import PdfReader
        reader = PdfReader(file_path)
        return len(reader.pages)
    except Exception as e:
        logger.warning(f"Impossible de compter les pages PDF : {e}")
        return 1


def _estimate_docx_pages(file_path: str) -> int:
    """
    Estimation grossière du nombre de pages d'un DOCX.
    Environ 40 lignes par page (heuristique simple pour le proto).
    """
    try:
        from docx import Document
        doc = Document(file_path)
        lines = sum(1 for p in doc.paragraphs if p.text.strip())
        return max(1, round(lines / 40))
    except Exception as e:
        logger.warning(f"Impossible d'estimer les pages DOCX : {e}")
        return 1


async def generate_preview(file_path: str, mime_type: str, job_id: uuid.UUID) -> str:
    """
    Génère un aperçu PNG de la première page et le sauvegarde.
    Retourne le chemin du fichier preview.
    """
    preview_path = Path(settings.UPLOAD_DIR) / str(job_id) / "preview.png"

    try:
        if mime_type == "application/pdf":
            _render_pdf_preview(file_path, str(preview_path))
        elif mime_type in ("image/jpeg", "image/png"):
            _resize_image_preview(file_path, str(preview_path))
        else:
            # Pour DOCX : pas de preview pour ce proto
            return ""
    except Exception as e:
        logger.warning(f"Génération du preview échouée pour {job_id} : {e}")
        return ""

    return str(preview_path.resolve())


def _render_pdf_preview(pdf_path: str, output_path: str) -> None:
    """
    Rendu de la page 1 du PDF en PNG.
    Utilise pypdf pour extraire + Pillow pour sauvegarder.
    Note : pour un rendu haute qualité, utiliser pdf2image/poppler.
          Pour le proto, on génère une image simple.
    """
    from pypdf import PdfReader, PdfWriter
    import io

    # Extrait la page 1 dans un buffer
    reader = PdfReader(pdf_path)
    writer = PdfWriter()
    writer.add_page(reader.pages[0])

    buf = io.BytesIO()
    writer.write(buf)
    buf.seek(0)

    # Crée une image placeholder avec les métadonnées
    # (un rendu réel nécessiterait poppler/ghostscript)
    img = Image.new("RGB", (595, 842), color=(255, 255, 255))
    img.save(output_path, "PNG")


def _resize_image_preview(image_path: str, output_path: str) -> None:
    """Redimensionne une image pour l'aperçu (max 800px de large)."""
    with Image.open(image_path) as img:
        img.thumbnail((800, 1200), Image.LANCZOS)
        img.save(output_path, "PNG")
