"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session-context";

// ── Icônes ────────────────────────────────────────────────────────────────────

function PrinterIcon() {
  return (
    <svg
      className="w-10 h-10"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.3}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z"
      />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg
      className="w-10 h-10"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.3}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75"
      />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg
      className="w-5 h-5"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2.2}
      stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
    </svg>
  );
}

// ── Composant principal ──────────────────────────────────────────────────────

export default function ServiceSelectionPage() {
  const router = useRouter();
  const { kioskName, setServiceType } = useSession();

  const handleSelectImpression = () => {
    setServiceType("impression");
    router.push("/flow/upload");
  };

  return (
    <div className="flex flex-col flex-1">
      {/* Header */}
      <div className="bg-primary px-5 pt-12 pb-8">
        <p className="text-accent/60 text-xs font-semibold uppercase tracking-widest mb-1">
          {kioskName || "Borne Multiservice"}
        </p>
        <h1 className="text-2xl font-bold text-white">
          Que souhaitez-vous faire ?
        </h1>
        <p className="text-accent/50 text-sm mt-1">
          Choisissez un service pour commencer
        </p>
      </div>

      {/* Services */}
      <div className="flex-1 px-4 py-6 flex flex-col gap-4">
        {/* 🖨️ Impression — Actif */}
        <button
          onClick={handleSelectImpression}
          id="btn-service-impression"
          className="relative flex items-start gap-4 rounded-2xl p-5 bg-white border-2 border-primary/15 shadow-lg shadow-primary/5 text-left active:scale-[0.99] transition-all duration-200 hover:border-primary/30 hover:shadow-xl group"
        >
          {/* Badge populaire */}
          <span className="absolute top-3 right-3 px-2.5 py-0.5 bg-success/15 text-success text-[10px] font-bold uppercase tracking-wider rounded-full">
            Populaire
          </span>

          {/* Icône */}
          <div className="w-16 h-16 rounded-2xl bg-primary/8 flex items-center justify-center shrink-0 text-primary group-hover:bg-primary/12 transition-colors">
            <PrinterIcon />
          </div>

          {/* Contenu */}
          <div className="flex-1 min-w-0 pr-4">
            <h2 className="text-lg font-bold text-neutral-dark">Impression</h2>
            <p className="text-sm text-neutral-dark/55 mt-1 leading-relaxed">
              Envoyez un document depuis votre téléphone et récupérez-le imprimé à la borne
            </p>
            <div className="flex items-center gap-1.5 mt-3 text-xs font-semibold text-primary/70">
              <span>À partir de 50 FCFA</span>
              <span className="text-primary/30">•</span>
              <span>PDF, JPG, DOCX</span>
            </div>
          </div>

          {/* Flèche */}
          <div className="self-center text-primary/40 group-hover:text-primary transition-colors shrink-0">
            <ArrowRightIcon />
          </div>
        </button>

        {/* 📋 Photocopie — Désactivé */}
        <div
          id="btn-service-photocopie"
          className="relative flex items-start gap-4 rounded-2xl p-5 bg-white/60 border-2 border-dashed border-neutral-dark/10 text-left opacity-60 cursor-not-allowed"
        >
          {/* Badge Bientôt */}
          <span className="absolute top-3 right-3 px-2.5 py-0.5 bg-warning/40 text-neutral-dark/70 text-[10px] font-bold uppercase tracking-wider rounded-full">
            Bientôt disponible
          </span>

          {/* Icône */}
          <div className="w-16 h-16 rounded-2xl bg-neutral-dark/5 flex items-center justify-center shrink-0 text-neutral-dark/30">
            <CopyIcon />
          </div>

          {/* Contenu */}
          <div className="flex-1 min-w-0 pr-4">
            <h2 className="text-lg font-bold text-neutral-dark/50">Photocopie</h2>
            <p className="text-sm text-neutral-dark/35 mt-1 leading-relaxed">
              Copiez un document papier directement à la borne
            </p>
            <div className="flex items-center gap-1.5 mt-3 text-xs font-semibold text-neutral-dark/25">
              <span>Prochainement</span>
            </div>
          </div>
        </div>

        {/* Info footer */}
        <div className="mt-auto bg-accent/10 rounded-2xl p-4 border border-accent/20 flex gap-3">
          <svg
            className="w-5 h-5 text-primary shrink-0 mt-0.5"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
            />
          </svg>
          <p className="text-xs text-primary/60 leading-relaxed">
            Sélectionnez <strong>Impression</strong> pour envoyer un fichier (PDF, photo, DOCX) depuis votre téléphone. Vous pouvez aussi scanner un document papier avec votre caméra.
          </p>
        </div>
      </div>
    </div>
  );
}
