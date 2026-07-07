"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { StepHeader } from "@/components/StepHeader";
import { useSession } from "@/lib/session-context";

export default function PricePage() {
  const router = useRouter();
  const { fileMetadata, serviceType } = useSession();

  if (!fileMetadata) {
    router.replace("/flow/upload");
    return null;
  }

  const { filename, pages, copies, colorMode, duplex, price } = fileMetadata;

  // Label lisibles
  const colorLabel = colorMode === "nb" ? "Noir & Blanc" : "Couleur";
  const duplexLabel = duplex ? "Recto-verso" : "Recto simple";

  const isScan = serviceType === "scan";

  // Affichage des détails de tarification
  const perSheetPrice = price !== null && copies > 0
    ? (isScan ? (colorMode === "couleur" ? 75 : 25) : Math.round(price / copies / Math.ceil(pages / (duplex ? 2 : 1))))
    : null;

  return (
    <div className="h-[100dvh] bg-slate-50 flex flex-col overflow-hidden">
      <StepHeader title="Récapitulatif" step={4} />

      <div className="flex-1 px-4 py-5 flex flex-col gap-4 overflow-hidden">
        {/* Ticket de caisse */}
        <div className="flex-1 bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm flex flex-col min-h-0">
          {/* En-tête ticket */}
          <div className="bg-primary px-4 py-3.5 shrink-0">
            <p className="text-accent/80 text-[10px] font-bold uppercase tracking-wider">
              {isScan ? "Détails de la numérisation" : "Détails de l'impression"}
            </p>
            <p className="text-white font-bold truncate text-sm mt-0.5">{filename}</p>
          </div>

          {/* Lignes du ticket */}
          <div className="flex-1 divide-y divide-slate-100 overflow-y-auto min-h-0 text-xs">
            <ReceiptRow label="Service" value={isScan ? "Scan de document" : "Impression"} />
            <ReceiptRow label="Nombre de pages" value={`${pages} page${pages > 1 ? "s" : ""}`} />
            {!isScan && <ReceiptRow label="Copies" value={`× ${copies}`} />}
            <ReceiptRow label="Mode" value={colorLabel} />
            {!isScan && <ReceiptRow label="Format" value={duplexLabel} />}
            {perSheetPrice && (
              <ReceiptRow label={isScan ? "Tarif par page" : "Tarif par feuille"} value={`${perSheetPrice} FCFA`} />
            )}
          </div>

          {/* Total */}
          <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-t border-slate-100 shrink-0">
            <span className="font-bold text-neutral-dark text-sm">Total à payer</span>
            <span className="text-xl font-extrabold text-primary">
              {price !== null ? `${price.toLocaleString("fr-FR")} FCFA` : "—"}
            </span>
          </div>
        </div>

        {/* Info tarification */}
        <div className="bg-accent/10 rounded-2xl p-3.5 border border-accent/20 flex gap-3 shrink-0">
          <svg className="w-4 h-4 text-primary shrink-0 mt-0.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
          </svg>
          <p className="text-[11px] text-primary/70 leading-relaxed">
            {isScan
              ? "Votre fichier PDF sera disponible en téléchargement après validation de la transaction sur votre téléphone."
              : "Votre document sera imprimé automatiquement après validation de la transaction sur votre téléphone."}
          </p>
        </div>

        <button
          onClick={() => router.push("/flow/payment")}
          className="w-full py-4 rounded-2xl font-bold text-lg bg-success text-white shadow-lg shadow-success/30 active:scale-[0.98] transition-all shrink-0"
        >
          Payer {price !== null ? `${price.toLocaleString("fr-FR")} FCFA` : ""} →
        </button>
      </div>
    </div>
  );
}

function ReceiptRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <span className="text-neutral-dark/60">{label}</span>
      <span className="font-semibold text-neutral-dark">{value}</span>
    </div>
  );
}
