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
