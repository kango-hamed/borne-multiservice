# Feuille Directive — Équipe Backend
## Borne Multiservice d'Accès Numérique — Prototype Logiciel

---

## 1. Périmètre de la mission

Construire l'API et la logique métier qui orchestrent tout le flux : sessions, jobs d'impression, paiement (simulé), file d'attente, et interface admin pour les agents. Le backend est la **source de vérité unique** sur l'état de chaque job — le frontend ne fait que refléter ce que le backend lui renvoie.

**Hors périmètre pour cette itération** : intégration réelle d'une API mobile money (Orange Money/Wave), gestion multi-bornes en parallèle (architecture conçue pour le permettre plus tard, mais pas implémentée).

---

## 2. Stack technique imposée

| Composant | Choix |
|---|---|
| Framework | FastAPI |
| Base de données | PostgreSQL |
| ORM | SQLAlchemy (async) |
| Migrations | Alembic |
| File d'attente | Polling PostgreSQL (pas de Redis/Celery pour ce proto) |
| Paiement | Provider mocké, derrière une interface abstraite |
| Impression | CUPS (`lp` / `pycups`) |

**Ne pas introduire Redis, Celery ou tout autre composant d'infrastructure supplémentaire sans validation** — l'objectif du proto est la simplicité de déploiement.

---

## 3. Modèle de données — à respecter strictement

Les schémas (`kiosks`, `sessions`, `print_jobs`, `payments`, `agents`) sont déjà actés dans le document d'architecture partagé. **Ne pas modifier les noms de colonnes ou les valeurs d'enum sans en informer l'équipe frontend** — ce sont des contrats partagés.

Enums critiques à ne jamais renommer une fois communiqués au frontend :
- `print_jobs.status` : `en_creation`, `attente_paiement`, `paye`, `paiement_expire`, `impression_en_cours`, `pret_a_retirer`, `recupere`
- `payments.status` : `initie`, `en_attente`, `confirme`, `echoue`

---

## 4. Structure du projet attendue

```
backend/
├── app/
│   ├── main.py
│   ├── config.py
│   ├── database.py
│   ├── models/
│   ├── schemas/
│   ├── routers/             # sessions.py, jobs.py, payments.py, admin.py
│   ├── services/
│   │   ├── pricing.py
│   │   ├── pdf_utils.py
│   │   ├── payment_providers/
│   │   │   ├── base.py
│   │   │   └── mock_provider.py
│   │   └── printing.py
│   └── workers/print_queue_worker.py
└── alembic/
```

---

## 5. Ordre de développement (priorités)

1. **Modèles + migrations Alembic** — fondation, à valider avant tout endpoint
2. **`POST /sessions`** et gestion de l'expiration
3. **`POST /jobs`** (upload fichier) + `pricing.py` (calcul prix) + `pdf_utils.py` (comptage pages)
4. **`payment_providers/base.py` + `mock_provider.py`** — interface abstraite dès le départ, même pour le mock
5. **`POST /payments/{job_id}/initiate`** + **`POST /payments/webhook`**
6. **`print_queue_worker.py`** — boucle de polling, traitement FIFO
7. **Endpoints admin** (`/admin/kiosks/{id}/queue`, `/admin/jobs/{id}/withdraw`)

Ne jamais commencer le worker d'impression avant que les statuts de paiement soient fiables — le worker dépend entièrement de la cohérence de `print_jobs.status`.

---

## 6. Règles non négociables

- **Idempotence des paiements** : chaque transaction doit être identifiable de façon unique (`provider_transaction_id`) pour empêcher tout double traitement en cas de retry ou de webhook dupliqué.
- **Le mock provider doit être une vraie implémentation de l'interface abstraite**, pas un raccourci codé en dur dans les routers. Le jour de l'intégration réelle, seul un nouveau fichier `orange_money_provider.py` doit être nécessaire.
- **Le worker ne doit jamais bloquer sur une borne en erreur** — si l'envoi à l'imprimante échoue, le job passe en statut d'échec et le worker continue sur le job suivant.
- **Aucune information de paiement sensible** (numéro de téléphone complet, etc.) ne doit être loggée en clair.
- **Toutes les requêtes de polling du frontend** (`GET /jobs/{id}`, `GET /payments/{job_id}/status`) doivent rester légères — pas de jointures lourdes à chaque appel.

---

## 7. Contrat avec le frontend

Avant de coder les routers, produire et partager avec l'équipe frontend :
- La liste exacte des endpoints, méthodes HTTP, et schémas JSON de requête/réponse (idéalement via la documentation auto-générée FastAPI `/docs`, à partager en lien direct)
- Les valeurs exactes des enums de statut
- Les codes d'erreur HTTP utilisés (404, 409, 422...) et leur signification

**Point de synchronisation obligatoire** : valider ce contrat avec le frontend avant que celui-ci commence `api.ts`.

---

## 8. Définition du "fini" pour chaque endpoint

Un endpoint n'est considéré terminé que si :
- [ ] Il est documenté automatiquement via Swagger/FastAPI (`/docs`)
- [ ] Les cas d'erreur (session expirée, job introuvable, paiement déjà confirmé) sont gérés explicitement, pas seulement le cas heureux
- [ ] Il est testé manuellement via Swagger ou un script avant d'être annoncé comme prêt au frontend

---

## 9. Livrables attendus pour la prochaine revue

- Migrations Alembic appliquées, base de données fonctionnelle
- Flux complet testable via Swagger : création de session → job → paiement mocké → file → statut "prêt à retirer"
- Worker d'impression démontrable (même avec une imprimante de test ou un `printing.py` simulé qui logue au lieu d'imprimer réellement)
- Documentation des endpoints partagée avec l'équipe frontend
