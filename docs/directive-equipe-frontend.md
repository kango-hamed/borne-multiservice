# Feuille Directive — Équipe Frontend
## Borne Multiservice d'Accès Numérique — Prototype Logiciel

---

## 1. Périmètre de la mission

Construire la **PWA** (Progressive Web App) que l'usager ouvre en scannant le QR code à la borne. C'est l'unique point de contact visible par l'usager final — l'exigence de fluidité et de clarté est donc maximale, en particulier pour un public peu familier du numérique et sur réseau parfois instable.

**Hors périmètre pour cette itération** : photocopie, scan, services administratifs, interface admin/agent (gérée séparément).

---

## 2. Stack technique imposée

| Composant | Choix |
|---|---|
| Framework | Next.js (App Router) |
| PWA | `next-pwa` |
| Style | Tailwind CSS |
| Gestion d'état | React Context (pas de Redux/Zustand) |
| Communication backend | `fetch` simple, pas de librairie tierce (axios, etc.) sauf besoin justifié |

**Ne pas dévier de cette stack sans validation** — elle a été choisie pour rester légère sur réseau faible et cohérente avec le reste de l'écosystème de projets (MUSIA).

---

## 3. Arborescence attendue

```
app/
├── s/page.tsx                  # SessionInit
├── flow/
│   ├── layout.tsx              # contexte de session
│   ├── upload/page.tsx
│   ├── config/page.tsx
│   ├── price/page.tsx
│   ├── payment/page.tsx
│   ├── pending/page.tsx
│   ├── queue/page.tsx
│   └── ready/page.tsx
├── components/
│   ├── StepHeader.tsx
│   ├── PriceSummary.tsx
│   ├── PollingStatus.tsx
│   └── WithdrawalCodeDisplay.tsx
├── lib/
│   ├── api.ts
│   └── session-context.tsx
└── hooks/usePolling.ts
```

Respecter cette structure pour que n'importe quel membre de l'équipe (ou du backend) puisse retrouver un écran rapidement.

---

## 4. Ordre de développement (priorités)

1. **`SessionInit`** — lecture `?kiosk=XXX`, appel `POST /sessions`, stockage du `session_token` en Context (jamais dans l'URL ni le localStorage)
2. **`FileUpload`** — upload + validation taille (max 20 Mo) + aperçu
3. **`PrintConfig`** — copies, couleur, recto-verso
4. **`PriceConfirm`** — récap + appel prix
5. **`PaymentSelect` + `PaymentPending`** — choix opérateur + polling statut
6. **`QueueStatus`** — position file + statut impression
7. **`WithdrawalCode`** — affichage final du code à 4 chiffres

Ne pas paralléliser au-delà de 2 écrans en simultané sans avoir d'abord validé le `session-context.tsx` et `api.ts` — ce sont les fondations partagées par tous les écrans.

---

## 5. Règles non négociables

- **Pas d'appli native, pas d'installation requise.** Tout doit fonctionner dans un navigateur mobile standard.
- **Le `session_token` ne doit jamais apparaître dans l'URL** après l'écran `SessionInit`.
- **Polling avec arrêt automatique** dès qu'un statut final est atteint (`pret_a_retirer`, `paiement_expire`, `echoue`) — ne jamais laisser un polling tourner indéfiniment.
- **Gestion explicite des erreurs réseau** : tout écran avec polling doit afficher un état "reconnexion en cours" en cas d'échec de requête, avec retry automatique. Ne jamais laisser un écran figé sans feedback.
- **Compression des images côté client** avant upload si le fichier dépasse une taille raisonnable.
- **Mobile-first strictement** — aucun écran ne doit être pensé desktop puis adapté.

---

## 6. Contrat avec le backend

Le frontend ne doit jamais halluciner un format de réponse — toujours se synchroniser avec l'équipe backend sur :
- Le format exact de chaque endpoint (`/sessions`, `/jobs`, `/payments/{id}/initiate`, `/payments/{id}/status`)
- Les valeurs exactes des enums de statut (`status` des jobs et paiements) — copier-coller ces valeurs depuis le backend, ne pas les redéfinir indépendamment
- Les codes d'erreur HTTP attendus (404, 409 pour file pleine, etc.)

**Point de synchronisation obligatoire avant de coder `api.ts`** : valider ensemble la liste des endpoints et leurs schémas JSON exacts.

---

## 7. Définition du "fini" pour chaque écran

Un écran n'est considéré terminé que si :
- [ ] Il fonctionne sur un viewport mobile réel (pas juste responsive desktop réduit)
- [ ] Les états de chargement et d'erreur sont gérés (pas seulement le cas "tout va bien")
- [ ] Il respecte la palette Tailwind définie (`primary`, `accent`, `success`, `warning`)
- [ ] Aucune information sensible (token, code de retrait) n'est exposée dans l'URL ou les logs console

---

## 8. Livrables attendus pour la prochaine revue

- PWA installable/affichable avec manifest fonctionnel
- Flux complet `SessionInit → WithdrawalCode` navigable de bout en bout (même avec backend mocké)
- Démo sur téléphone réel, pas seulement sur émulateur navigateur
