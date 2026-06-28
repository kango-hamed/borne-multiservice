# Borne Multiservice d'Accès Numérique — Prototype Logiciel

> **Contexte** : par manque de financement, le prototype se concentre exclusivement sur la partie **logicielle**. Le matériel custom (boîtier, tiroir verrouillé par solénoïde) est remplacé par des équivalents logiciels ou des processus manuels simples (imprimante standard, supervision par un agent).

---

## 1. Flux utilisateur

### Étapes

1. **Affichage du QR code** à la borne (écran/tablette/PC), lié à un `kiosk_id` unique.
2. **Scan → ouverture d'une PWA** dans le navigateur du téléphone (pas d'installation d'application). L'URL encode le `kiosk_id` ; une session unique (`session_token`) est créée côté backend.
3. **Sélection du service** — pour ce proto : **impression uniquement** (photocopie/scan via caméra téléphone repoussés à une itération ultérieure).
4. **Upload du fichier** depuis le téléphone (galerie, fichier reçu par WhatsApp, etc.). Formats cibles : PDF, JPG/PNG, éventuellement DOCX.
5. **Configuration de l'impression** : nombre de copies, N&B/couleur, recto-verso, format papier.
6. **Aperçu** du document avant validation.
7. **Calcul du prix** (basé sur le nombre de pages × options).
8. **Paiement mobile money** (Orange Money, MTN, Moov, Wave) avec confirmation par webhook.
9. **Génération d'un code de retrait à 4 chiffres**, affiché à l'usager.
10. **Lancement du job d'impression** sur l'imprimante connectée à la borne.
11. **Retrait** : l'usager présente son code à l'agent, qui le valide via une interface admin et remet le document.
12. **Reçu / fin de session** (SMS ou affichage écran).

### Décisions actées

| Sujet | Choix retenu |
|---|---|
| Accès à l'app | PWA web (scan QR → navigateur), pas d'appli native |
| Photocopie / scan | Hors scope pour ce proto, focus impression uniquement |
| Sécurisation du retrait | Code à 4 chiffres + validation par un agent |
| File d'attente | Polling simple sur PostgreSQL (pas de Redis/Celery pour le proto) |
| Paiement mobile money | Pas d'API marchand pour l'instant → simulation (mock provider) |

---

## 2. Cas limites traités

### File d'attente (plusieurs usagers sur une même borne)
- Une imprimante = un job à la fois → file **FIFO** par `kiosk_id`.
- Statuts du job : `en_attente` → `impression_en_cours` → `pret_a_retirer` → `recupere`.
- L'usager voit sa position en file après paiement.
- Un worker backend traite les jobs séquentiellement via polling (toutes les 2-3 secondes).

### Échec de paiement / timeout
- **Session expirée sans paiement confirmé** : timeout de 5-10 min → statut `paiement_expire`, place libérée en file.
- **Paiement refusé/insuffisant** : message immédiat, retour à l'étape paiement, fichier conservé (pas de re-upload).
- **Paiement confirmé après expiration de session** (webhook en retard) : le paiement est tout de même honoré (l'argent a été prélevé) → job créé + notification SMS à l'usager.
- Toutes les transactions sont **idempotentes** (via `provider_transaction_id`) pour éviter un double prélèvement en cas de nouvelle tentative.

### Code de retrait non récupéré
- Le document reste physiquement dans le bac de l'imprimante tant qu'il n'est pas retiré (pas de risque de blocage de la file, qui ne gère que les impressions, pas les retraits).
- Délai de grâce indicatif avant alerte à l'agent pour ranger le document de côté avec son code.
- Le code n'expire pas techniquement ; la vérification reste sous supervision humaine.

---

## 3. Architecture Backend (FastAPI + PostgreSQL)

### Modèle de données

**`kiosks`**
| Colonne | Type | Notes |
|---|---|---|
| id | UUID | PK |
| name | varchar | ex: "Borne Cocody Riviera" |
| location_lat / location_lng | float | géolocalisation |
| status | enum | `actif`, `maintenance`, `hors_ligne` |
| printer_endpoint | varchar | imprimante CUPS connectée |
| created_at | timestamp | |

**`sessions`**
| Colonne | Type | Notes |
|---|---|---|
| id | UUID | PK = session_token |
| kiosk_id | UUID | FK → kiosks |
| created_at / expires_at | timestamp | expiration ~5-10 min |
| status | enum | `active`, `expiree`, `terminee` |

**`print_jobs`**
| Colonne | Type | Notes |
|---|---|---|
| id | UUID | PK |
| session_id / kiosk_id | UUID | FK |
| file_path / original_filename | varchar | |
| pages | int | calculé à l'upload |
| copies | int | |
| color_mode | enum | `nb`, `couleur` |
| duplex | bool | |
| price_fcfa | int | |
| status | enum | `en_creation`, `attente_paiement`, `paye`, `paiement_expire`, `impression_en_cours`, `pret_a_retirer`, `recupere` |
| withdrawal_code | varchar(4) | généré à `paye` |
| created_at / updated_at | timestamp | |

**`payments`**
| Colonne | Type | Notes |
|---|---|---|
| id | UUID | PK |
| print_job_id | UUID | FK |
| provider | enum | `orange_money`, `mtn`, `wave`, `mock` |
| provider_transaction_id | varchar | idempotence |
| amount_fcfa | int | |
| status | enum | `initie`, `en_attente`, `confirme`, `echoue` |
| created_at / confirmed_at | timestamp | |

**`agents`** (optionnel)
| id, kiosk_id, name, pin_code | Auth locale simple pour valider les retraits |

### Structure du projet

```
backend/
├── app/
│   ├── main.py
│   ├── config.py
│   ├── database.py
│   ├── models/            # kiosk.py, session.py, print_job.py, payment.py
│   ├── schemas/            # Pydantic
│   ├── routers/             # sessions.py, jobs.py, payments.py, admin.py
│   ├── services/
│   │   ├── pricing.py
│   │   ├── pdf_utils.py
│   │   ├── payment_providers/
│   │   │   ├── base.py            # interface abstraite
│   │   │   ├── mock_provider.py
│   │   │   └── orange_money_provider.py   # à venir
│   │   └── printing.py
│   └── workers/
│       └── print_queue_worker.py
└── alembic/                # migrations
```

### Endpoints principaux

```
POST   /sessions                     # créé au scan du QR → retourne session_token
GET    /sessions/{id}                # vérifie validité/expiration

POST   /jobs                          # créé un job (upload fichier)
PATCH  /jobs/{id}/config              # copies, couleur, recto-verso
GET    /jobs/{id}                     # statut + position file
GET    /jobs/{id}/preview             # aperçu du fichier

POST   /payments/{job_id}/initiate    # déclenche le paiement (mock ou réel)
POST   /payments/webhook              # callback provider
GET    /payments/{job_id}/status      # polling frontend

GET    /admin/kiosks/{id}/queue       # file d'attente pour l'agent
POST   /admin/jobs/{id}/withdraw      # validation du code à 4 chiffres
```

### Worker d'impression (polling)

```python
async def print_queue_worker():
    while True:
        job = await get_next_paid_job()  # FIFO par kiosk_id
        if job:
            await mark_status(job.id, "impression_en_cours")
            success = await send_to_printer(job)
            if success:
                code = generate_withdrawal_code()
                await mark_ready(job.id, code)
            else:
                await mark_failed(job.id)
        await asyncio.sleep(2)
```

> **À trancher plus tard** : worker unique filtrant par `kiosk_id`, ou un worker par borne — pertinent seulement si plusieurs bornes sont déployées en parallèle.

### Paiement mobile money — stratégie de simulation

- Interface abstraite `payment_providers/base.py` (`initiate_payment()`, `check_status()`, `handle_webhook()`).
- `MockPaymentProvider` simule un comportement réel (transition automatique "en attente" → "payé" après un délai, ou déclenchement manuel "Forcer succès/échec" pour les démos).
- Le jour où l'accès à une vraie API (Orange Money, Wave) est obtenu, seule une nouvelle implémentation (`OrangeMoneyProvider`) sera nécessaire, sans toucher au reste du système.

---

## 4. Architecture Frontend (PWA — Next.js + Tailwind)

### Setup PWA

```bash
npm install next-pwa
```

```js
// next.config.js
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
});

module.exports = withPWA({ reactStrictMode: true });
```

### Arborescence (App Router)

```
app/
├── s/
│   └── page.tsx              # SessionInit — lit ?kiosk=XXX, POST /sessions
├── flow/
│   ├── layout.tsx            # contexte de session
│   ├── upload/page.tsx
│   ├── config/page.tsx
│   ├── price/page.tsx
│   ├── payment/page.tsx
│   ├── pending/page.tsx       # polling paiement
│   ├── queue/page.tsx         # polling file/impression
│   └── ready/page.tsx         # code de retrait
├── components/
│   ├── StepHeader.tsx
│   ├── PriceSummary.tsx
│   ├── PollingStatus.tsx      # spinner + reconnexion auto
│   └── WithdrawalCodeDisplay.tsx
├── lib/
│   ├── api.ts
│   └── session-context.tsx   # session_token, job_id en mémoire (pas dans l'URL)
└── hooks/
    └── usePolling.ts
```

**Pourquoi des routes par étape** : bouton retour navigateur fonctionnel, plus facile à déboguer/démontrer pendant le pilote. Le `session_token` reste en Context React, pas dans l'URL.

### Convention Tailwind

```js
theme: {
  extend: {
    colors: {
      primary: '#1E2761',
      accent: '#CADCFC',
      success: '#02C39A',
      warning: '#F9E795',
    }
  }
}
```

### Points d'attention spécifiques au contexte (connectivité faible)

- Polling avec arrêt automatique dès statut final atteint, pour limiter la charge réseau/batterie.
- État "reconnexion en cours" visible en cas d'échec de requête, avec retry automatique.
- Compression des fichiers image côté client avant upload (cas fréquent : photo prise directement).
- Limite de taille de fichier (ex. 20 Mo) avec message clair côté frontend.

---

## 5. Prochaines étapes

- [ ] Détailler le calcul du prix (`pricing.py`) et le comptage de pages
- [ ] Démarrer l'implémentation (modèles SQLAlchemy, structure Next.js)
- [ ] Définir la palette de couleurs finale (cohérente avec le pitch deck MASS)
- [ ] Explorer les conditions d'accès aux API mobile money (Orange Money, Wave) pour une future intégration réelle
