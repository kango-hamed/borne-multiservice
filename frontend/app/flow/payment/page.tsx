"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { StepHeader } from "@/components/StepHeader";
import { useSession } from "@/lib/session-context";
import { api } from "@/lib/api";

const PROVIDERS = [
  { id: "orange_money", label: "Orange Money", emoji: "🟠", color: "bg-orange-50 border-orange-200" },
  { id: "wave", label: "Wave", emoji: "🔵", color: "bg-blue-50 border-blue-200" },
  { id: "mtn", label: "MTN MoMo", emoji: "🟡", color: "bg-yellow-50 border-yellow-200" },
  { id: "moov", label: "Moov Money", emoji: "🟢", color: "bg-green-50 border-green-200" },
  { id: "mock", label: "Simulateur (test)", emoji: "🧪", color: "bg-purple-50 border-purple-200" },
];

export default function PaymentPage() {
  const router = useRouter();
  const { jobId, fileMetadata } = useSession();

  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canPay = selectedProvider !== null && phone.trim().length >= 8 && !loading;

  const handlePay = async () => {
    if (!jobId || !selectedProvider) return;
    setLoading(true);
    setError(null);
    try {
      await api.initiatePayment(jobId, selectedProvider, phone.trim());
      router.push("/flow/pending");
    } catch (err: any) {
      setError(err.message || "Erreur lors de l'initiation du paiement.");
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col flex-1">
      <StepHeader title="Paiement" step={4} />

      <div className="flex-1 px-4 py-6 flex flex-col gap-5">
        {/* Montant */}
        {fileMetadata?.price && (
          <div className="bg-primary rounded-2xl px-5 py-4 flex items-center justify-between text-white">
            <span className="font-medium text-accent/80 text-sm">À payer</span>
            <span className="text-2xl font-extrabold">{fileMetadata.price.toLocaleString("fr-FR")} FCFA</span>
          </div>
        )}

        {/* Sélection opérateur */}
        <div>
          <p className="text-sm font-semibold text-neutral-dark/60 mb-3 uppercase tracking-wider">Choisir l'opérateur</p>
          <div className="grid grid-cols-2 gap-3">
            {PROVIDERS.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedProvider(p.id)}
                className={`
                  border-2 rounded-2xl p-4 flex flex-col items-center gap-2 transition-all duration-200
                  ${selectedProvider === p.id
                    ? "border-primary bg-primary/5 shadow-md scale-[1.02]"
                    : `${p.color} hover:border-primary/30`
                  }
                `}
              >
                <span className="text-3xl">{p.emoji}</span>
                <span className="text-xs font-semibold text-neutral-dark text-center leading-tight">{p.label}</span>
                {selectedProvider === p.id && (
                  <span className="text-xs bg-primary text-white px-2 py-0.5 rounded-full font-semibold">Sélectionné</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Numéro de téléphone */}
        <div className="bg-white rounded-2xl border border-accent/30 p-4">
          <label className="block text-sm font-semibold text-neutral-dark/60 mb-2">
            Numéro Mobile Money
          </label>
          <div className="flex items-center gap-3">
            <span className="text-neutral-dark/50 text-sm font-medium shrink-0">🇨🇮 +225</span>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="07 00 00 00 00"
              className="flex-1 bg-transparent text-lg font-semibold text-neutral-dark placeholder:text-neutral-dark/25 outline-none"
              maxLength={12}
            />
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600 font-medium">
            ⚠️ {error}
          </div>
        )}

        <button
          onClick={handlePay}
          disabled={!canPay}
          className={`
            mt-auto w-full py-4 rounded-2xl font-bold text-lg transition-all duration-200
            ${canPay
              ? "bg-success text-white shadow-lg shadow-success/30 active:scale-[0.98]"
              : "bg-neutral-dark/10 text-neutral-dark/30 cursor-not-allowed"
            }
          `}
        >
          {loading ? "Traitement..." : `Initier le paiement →`}
        </button>
      </div>
    </div>
  );
}
