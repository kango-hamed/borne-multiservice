"""
pricing.py — Calcul du prix d'impression en FCFA.

Tarifs unitaires (par feuille physique imprimée) :
  - N&B recto         : 50 FCFA
  - N&B recto-verso   : 80 FCFA  (une feuille = 2 pages de contenu)
  - Couleur recto     : 150 FCFA
  - Couleur recto-verso : 250 FCFA

Note : ces tarifs sont en dur pour le prototype.
Une table `pricing_config` par borne est prévue pour une future itération.
"""
import math

# ── Grille tarifaire ──────────────────────────────────────────────────────────
PRICE_TABLE: dict[str, int] = {
    "nb_recto": 50,
    "nb_recto_verso": 80,
    "couleur_recto": 150,
    "couleur_recto_verso": 250,
}


def calculate_price(
    pages: int,
    copies: int,
    color_mode: str,  # "nb" | "couleur"
    duplex: bool,
) -> int:
    """
    Calcule le prix total en FCFA.

    Logique recto-verso :
    - En duplex, 2 pages de contenu tiennent sur une seule feuille physique.
    - Le prix est calculé sur le nombre de feuilles physiques × tarif.

    Exemple : 3 pages, 2 copies, N&B, duplex
      → feuilles par copie = ceil(3 / 2) = 2
      → total feuilles = 2 × 2 = 4
      → prix = 4 × 80 = 320 FCFA
    """
    mode_key = f"{color_mode}_{'recto_verso' if duplex else 'recto'}"
    unit_price = PRICE_TABLE[mode_key]

    if duplex:
        # Nombre de feuilles physiques par copie (arrondi au supérieur)
        sheets_per_copy = math.ceil(pages / 2)
    else:
        sheets_per_copy = pages

    total_sheets = sheets_per_copy * copies
    return unit_price * total_sheets


def get_price_breakdown(
    pages: int,
    copies: int,
    color_mode: str,
    duplex: bool,
) -> dict:
    """
    Retourne le détail du calcul — utile pour l'affichage dans l'UI.
    """
    mode_key = f"{color_mode}_{'recto_verso' if duplex else 'recto'}"
    unit_price = PRICE_TABLE[mode_key]
    sheets_per_copy = math.ceil(pages / 2) if duplex else pages
    total_sheets = sheets_per_copy * copies
    total_price = unit_price * total_sheets

    return {
        "pages_per_copy": pages,
        "sheets_per_copy": sheets_per_copy,
        "copies": copies,
        "total_sheets": total_sheets,
        "unit_price_fcfa": unit_price,
        "total_price_fcfa": total_price,
        "color_mode": color_mode,
        "duplex": duplex,
    }
