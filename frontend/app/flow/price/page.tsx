"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { StepHeader } from "@/components/StepHeader";
import { useSession } from "@/lib/session-context";

export default function PricePage() {
  const router = useRouter();
  const { fileMetadata } = useSession();

  if (!fileMetadata) {
    router.replace("/flow/upload");
    return null;
  }

  const { filename, pages, copies, colorMode, duplex, price } = fileMetadata;

  // Label lisibles
  const colorLabel = colorMode === "nb" ? "Noir & Blanc" : "Couleur";
  const duplexLabel = duplex ? "Recto-verso" : "Recto simple";

  // Affichage des détails de tarification
  const perSheetPrice = price !== null && copies > 0
    ? Math.round(price / copies / Math.ceil(pages / (duplex ? 2 : 1)))
    : null;

  return (
    <div className="flex flex-col flex-1">
      <StepHeader title="Récapitulatif" step={3} />

      <div className="flex-1 px-4 py-6 flex flex-col gap-5">
        {/* Ticket de caisse */}
        <div className="bg-white rounded-2xl border border-accent/30 overflow-hidden shadow-sm">
          {/* En-tête ticket */}
          <div className="bg-primary px-5 py-4">
            <p className="text-accent/80 text-xs font-semibold uppercase tracking-widest">Détails de l'impression</p>
            <p className="text-white font-bold truncate mt-0.5">{filename}</p>
          </div>

          {/* Lignes du ticket */}
          <div className="divide-y divide-accent/20">
            <ReceiptRow label="Nombre de pages" value={`${pages} page${pages > 1 ? "s" : ""}`} />
            <ReceiptRow label="Copies" value={`× ${copies}`} />
            <ReceiptRow label="Mode d'impression" value={colorLabel} />
            <ReceiptRow label="Format" value={duplexLabel} />
            {perSheetPrice && (
              <ReceiptRow label="Tarif par feuille" value={`${perSheetPrice} FCFA`} />
            )}
          </div>

          {/* Total */}
          <div className="flex items-center justify-between px-5 py-4 bg-neutral-light">
            <span className="font-bold text-neutral-dark text-base">Total</span>
            <span className="text-2xl font-extrabold text-primary">
              {price !== null ? `${price.toLocaleString("fr-FR")} FCFA` : "—"}
            </span>
          </div>
        </div>

        {/* Info tarification */}
        <div className="bg-accent/10 rounded-2xl p-4 border border-accent/30 flex gap-3">
          <svg className="w-5 h-5 text-primary shrink-0 mt-0.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
          </svg>
          <p className="text-xs text-primary/70 leading-relaxed">
            Le paiement s'effectue par Mobile Money. Votre document sera imprimé automatiquement après confirmation du paiement.
          </p>
        </div>

        <button
          onClick={() => router.push("/flow/payment")}
          className="mt-auto w-full py-4 rounded-2xl font-bold text-lg bg-success text-white shadow-lg shadow-success/30 active:scale-[0.98] transition-all"
        >
          Payer {price !== null ? `${price.toLocaleString("fr-FR")} FCFA` : ""} →
        </button>
      </div>
    </div>
  );
}

function ReceiptRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-5 py-3">
      <span className="text-sm text-neutral-dark/60">{label}</span>
      <span className="text-sm font-semibold text-neutral-dark">{value}</span>
    </div>
  );
}
