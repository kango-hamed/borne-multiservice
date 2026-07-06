"""
exceptions.py — Exceptions métier centralisées.
Chaque exception est mappée à un code HTTP précis dans main.py.
"""
from fastapi import HTTPException, status


class KioskNotFoundError(HTTPException):
    def __init__(self, kiosk_id: str):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Borne introuvable : {kiosk_id}",
        )


class KioskOfflineError(HTTPException):
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="La borne est hors ligne ou en maintenance.",
        )


class SessionNotFoundError(HTTPException):
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session introuvable.",
        )


class SessionExpiredError(HTTPException):
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_410_GONE,
            detail="Session expirée. Veuillez rescanner le QR code.",
        )


class JobNotFoundError(HTTPException):
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job d'impression introuvable.",
        )


class JobAlreadyPaidError(HTTPException):
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ce job a déjà été payé.",
        )


class FileTooLargeError(HTTPException):
    def __init__(self, max_mb: int):
        super().__init__(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Fichier trop volumineux. Taille maximale : {max_mb} Mo.",
        )


class UnsupportedFileFormatError(HTTPException):
    def __init__(self, mime_type: str):
        super().__init__(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Format de fichier non supporté : {mime_type}. Formats acceptés : PDF, JPG, PNG, DOCX.",
        )


class EmptyScanError(HTTPException):
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Aucune page à scanner. Prenez au moins une photo du document.",
        )


class TooManyScanPagesError(HTTPException):
    def __init__(self, max_pages: int):
        super().__init__(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Trop de pages scannées. Maximum : {max_pages} pages par document.",
        )


class PaymentAlreadyConfirmedError(HTTPException):
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ce paiement a déjà été confirmé.",
        )


class InvalidWithdrawalCodeError(HTTPException):
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Code de retrait invalide.",
        )


class InvalidAgentPinError(HTTPException):
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="PIN agent invalide.",
        )


class JobNotReadyForWithdrawalError(HTTPException):
    def __init__(self, current_status: str):
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Le document n'est pas encore prêt à être retiré (statut actuel : {current_status}).",
        )


# ── Scan WIA ──────────────────────────────────────────────────────────────────

class ScanSessionNotFoundError(HTTPException):
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session de scan introuvable.",
        )


class ScanSessionClosedError(HTTPException):
    """Session déjà terminée ou annulée — on ne peut plus acquérir."""
    def __init__(self, current_status: str):
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Session de scan non modifiable (statut : {current_status}).",
        )


class ScanSessionBusyError(HTTPException):
    """Une acquisition est déjà en cours sur cette session (double-clic agent)."""
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            detail="Une acquisition est déjà en cours. Attendez la fin avant d'en déclencher une nouvelle.",
        )


class ScanNoPageError(HTTPException):
    """Finalize appelé sans aucune page acquise."""
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Aucune page n'a été scannée. Acquérez au moins une page avant de finaliser.",
        )


class ScannerNotFoundError(HTTPException):
    """WIA n'a trouvé aucun scanner connecté et allumé."""
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Aucun scanner détecté. Vérifiez que le scanner est allumé "
                "et correctement connecté à la borne."
            ),
        )


class ScanAcquisitionError(HTTPException):
    """Erreur WIA pendant l'acquisition (bourrage, vitre sale, timeout…)."""
    def __init__(self, detail: str = "Erreur lors de l'acquisition. Vérifiez le scanner et réessayez."):
        super().__init__(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=detail,
        )
