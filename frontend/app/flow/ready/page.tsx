"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { StepHeader } from "@/components/StepHeader";
import { WithdrawalCodeDisplay } from "@/components/WithdrawalCodeDisplay";
import { useSession } from "@/lib/session-context";

export default function ReadyPage() {
  const router = useRouter();
  const { withdrawalCode, kioskName, clearSession } = useSession();

  const handleNewPrint = () => {
    clearSession();
    router.replace("/flow/upload");
  };

  return (
    <div className="flex flex-col flex-1">
      <StepHeader title="Récupérez votre document" step={6} showBack={false} />

      <div className="flex-1 flex flex-col items-center justify-between px-6 py-8 gap-6">
        <div className="w-full max-w-sm flex flex-col items-center">
          {/* Code de retrait */}
          {withdrawalCode ? (
            <WithdrawalCodeDisplay code={withdrawalCode} kioskName={kioskName} />
          ) : (
            <div className="text-center py-8">
              <div className="w-20 h-20 rounded-full bg-success/15 flex items-center justify-center mx-auto mb-4">
                <svg className="w-10 h-10 text-success" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-neutral-dark">Document imprimé !</h2>
              <p className="text-neutral-dark/60 text-sm mt-2">
                Présentez-vous à l'agent pour récupérer votre document.
              </p>
            </div>
          )}

          {/* Instructions d'étapes */}
          <div className="mt-6 w-full space-y-3">
            <p className="text-xs font-semibold text-neutral-dark/40 uppercase tracking-wider text-center mb-2">
              Comment récupérer votre document
            </p>
            {[
              { icon: "👆", text: "Mémorisez ou prenez en photo ce code." },
              { icon: "🚶", text: "Rendez-vous au comptoir agent." },
              { icon: "🗣️", text: "Communiquez le code à l'agent." },
              { icon: "📄", text: "Recevez votre document imprimé." },
            ].map((step, idx) => (
              <div key={idx} className="flex items-start gap-3 p-3 bg-white rounded-xl border border-accent/20">
                <span className="text-lg shrink-0">{step.icon}</span>
                <p className="text-sm text-neutral-dark/70">{step.text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Nouvelle impression */}
        <button
          onClick={handleNewPrint}
          className="w-full max-w-sm py-4 rounded-2xl font-bold text-lg bg-primary text-white shadow-lg shadow-primary/25 active:scale-[0.98] transition-all"
        >
          Nouvelle impression
        </button>
      </div>
    </div>
  );
}
