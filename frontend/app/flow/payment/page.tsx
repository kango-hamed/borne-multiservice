"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { StepHeader } from "@/components/StepHeader";
import { useSession } from "@/lib/session-context";
import { api } from "@/lib/api";

const PROVIDERS = [
  {
    id: "orange_money",
    label: "Orange Money",
    icon: <svg className="w-8 h-8 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" /></svg>,
    color: "bg-orange-50 border-orange-200"
  },
  {
    id: "wave",
    label: "Wave",
    icon: <svg className="w-8 h-8 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" /></svg>,
    color: "bg-blue-50 border-blue-200"
  },
  {
    id: "mtn",
    label: "MTN MoMo",
    icon: <svg className="w-8 h-8 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" /></svg>,
    color: "bg-yellow-50 border-yellow-200"
  },
  {
    id: "moov",
    label: "Moov Money",
    icon: <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" /></svg>,
    color: "bg-green-50 border-green-200"
  },
];

export default function PaymentPage() {
  const router = useRouter();
  const { jobId, fileMetadata } = useSession();

  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formatPhone = (val: string) => {
    // Ne garder que les chiffres
    const digits = val.replace(/\D/g, '');
    // Regrouper par blocs de 2
    return digits.match(/.{1,2}/g)?.join(' ') || '';
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(formatPhone(e.target.value));
  };

  // On vérifie que la longueur (chiffres sans espaces) est d'au moins 8, et max 10
  const digitsOnly = phone.replace(/\D/g, '');
  const canPay = selectedProvider !== null && digitsOnly.length >= 8 && !loading;

  const handlePay = async () => {
    if (!jobId || !selectedProvider) return;
    setLoading(true);
    setError(null);
    try {
      // Dans cette version "en simulation", on n'envoie pas à l'API du provider directement,
      // on utilise l'endpoint backend existant qui va simuler ou router vers un mock.
      await api.initiatePayment(jobId, selectedProvider, digitsOnly);
      router.push("/flow/pending");
    } catch (err: any) {
      setError(err.message || "Erreur lors de l'initiation du paiement.");
      setLoading(false);
    }
  };

  return (
    <div className="h-[100dvh] bg-slate-50 flex flex-col overflow-hidden">
      <StepHeader title="Paiement" step={5} />

      <div className="flex-1 px-4 py-5 flex flex-col gap-4 overflow-hidden">
        {/* Montant */}
        {fileMetadata?.price && (
          <div className="bg-primary rounded-2xl px-4 py-3 flex items-center justify-between text-white shrink-0 shadow-sm">
            <span className="font-semibold text-accent/80 text-xs uppercase tracking-wider">Montant total</span>
            <span className="text-xl font-extrabold">{fileMetadata.price.toLocaleString("fr-FR")} FCFA</span>
          </div>
        )}

        {/* Sélection opérateur */}
        <div className="flex flex-col min-h-0">
          <p className="text-[10px] font-bold text-neutral-dark/60 mb-2 uppercase tracking-wider shrink-0">Choisir l'opérateur</p>
          <div className="grid grid-cols-2 gap-2.5 shrink-0">
            {PROVIDERS.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedProvider(p.id)}
                className={`
                  border rounded-xl p-2.5 flex items-center gap-3 transition-all duration-200 text-left
                  ${selectedProvider === p.id
                    ? "border-primary bg-primary/5 shadow-sm scale-[1.01]"
                    : `${p.color} hover:border-primary/20`
                  }
                `}
              >
                <div className="shrink-0">{p.icon}</div>
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-bold text-neutral-dark block truncate">{p.label}</span>
                  {selectedProvider === p.id && (
                    <span className="text-[8px] bg-primary text-white px-1.5 py-0.5 rounded-full font-bold uppercase mt-1 inline-block">Sélectionné</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Numéro de téléphone */}
        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm shrink-0">
          <label className="block text-[10px] font-bold text-neutral-dark/60 mb-1.5 uppercase tracking-wider">
            Numéro Mobile Money
          </label>
          <div className="flex items-center gap-2">
            <span className="text-neutral-dark/50 text-sm font-semibold shrink-0">🇨🇮 +225</span>
            <input
              type="tel"
              value={phone}
              onChange={handlePhoneChange}
              placeholder="07 00 00 00 00"
              className="flex-1 bg-transparent text-base font-bold text-neutral-dark placeholder:text-neutral-dark/20 outline-none"
              maxLength={14} // 10 chiffres + 4 espaces max
            />
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2 text-xs text-red-600 font-semibold shrink-0">
            ⚠️ {error}
          </div>
        )}

        <button
          onClick={handlePay}
          disabled={!canPay}
          className={`
            mt-auto w-full py-4 rounded-2xl font-bold text-lg transition-all duration-200 shrink-0
            ${canPay
              ? "bg-success text-white shadow-lg shadow-success/30 active:scale-[0.98]"
              : "bg-neutral-dark/10 text-neutral-dark/30 cursor-not-allowed"
            }
          `}
        >
          {loading ? "Traitement..." : `Payer ${fileMetadata?.price ? `${fileMetadata.price.toLocaleString("fr-FR")} FCFA` : ""}`}
        </button>
      </div>
    </div>
  );
}
