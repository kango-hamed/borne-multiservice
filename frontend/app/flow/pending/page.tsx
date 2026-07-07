"use client";

import React, { useCallback } from "react";
import { useRouter } from "next/navigation";
import { StepHeader } from "@/components/StepHeader";
import { PollingStatusBanner } from "@/components/PollingStatus";
import { useSession } from "@/lib/session-context";
import { usePolling } from "@/hooks/usePolling";
import { api, PaymentStatusResponse } from "@/lib/api";

const TERMINAL_PAYMENT_STATUSES = ["confirme", "echoue"];

export default function PendingPage() {
  const router = useRouter();
  const { jobId, serviceType } = useSession();

  const queryFn = useCallback(() => {
    if (!jobId) throw new Error("Pas de job");
    return api.getPaymentStatus(jobId);
  }, [jobId]);

  const checkSuccess = useCallback(
    (data: PaymentStatusResponse) => data.status === "confirme",
    []
  );
  const checkFailure = useCallback(
    (data: PaymentStatusResponse) => data.status === "echoue",
    []
  );

  const { data, status, error } = usePolling<PaymentStatusResponse>({
    queryFn,
    checkSuccess,
    checkFailure,
    intervalMs: 2500,
    enabled: !!jobId,
  });

  // Redirection automatique après confirmation
  React.useEffect(() => {
    if (status === "success") {
      if (serviceType === "scan") {
        router.push("/flow/success");
      } else {
        router.push("/flow/queue");
      }
    }
  }, [status, router, serviceType]);

  const isPaymentFailed = status === "error" || data?.status === "echoue";

  return (
    <div className="h-[100dvh] bg-slate-50 flex flex-col overflow-hidden">
      <StepHeader title="Confirmation" step={5} showBack={false} />

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-5 gap-6 overflow-hidden">
        {isPaymentFailed ? (
          /* Échec */
          <>
            <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center shrink-0">
              <svg className="w-10 h-10 text-red-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <div className="text-center shrink-0">
              <h2 className="text-lg font-bold text-neutral-dark">Paiement refusé</h2>
              <p className="text-neutral-dark/60 text-xs mt-2">
                Votre paiement n'a pas pu être confirmé. Veuillez réessayer.
              </p>
            </div>
            <button
              onClick={() => router.push("/flow/payment")}
              className="w-full max-w-sm py-4 rounded-2xl bg-primary text-white font-bold shadow-lg shadow-primary/25 shrink-0"
            >
              Réessayer le paiement
            </button>
          </>
        ) : (
          /* En attente */
          <>
            {/* Animation de progression du paiement */}
            <div className="relative shrink-0">
              <div className="w-24 h-24 rounded-full border-4 border-accent flex items-center justify-center">
                <svg className="w-10 h-10 text-primary animate-pulse" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
                </svg>
              </div>
              {/* Anneau de chargement qui tourne */}
              <svg className="absolute inset-0 w-24 h-24 animate-spin" viewBox="0 0 100 100" fill="none">
                <circle cx="50" cy="50" r="46" stroke="#CADCFC" strokeWidth="4" strokeDasharray="72 216" strokeLinecap="round" />
              </svg>
            </div>

            <div className="text-center shrink-0">
              <h2 className="text-lg font-bold text-neutral-dark">Paiement en attente</h2>
              <p className="text-neutral-dark/60 text-xs mt-2 max-w-xs leading-relaxed">
                Confirmez le paiement sur votre téléphone. Cette page se met à jour automatiquement.
              </p>
            </div>

            {/* Étapes visuelles */}
            <div className="w-full max-w-sm space-y-2">
              {[
                { label: "Paiement initié", done: true },
                { label: "En attente de confirmation", done: false, active: true },
                { label: "Document envoyé à l'imprimante", done: false },
              ].map((step, idx) => (
                <div key={idx} className={`flex items-center gap-3 p-2.5 rounded-xl border ${step.active ? "bg-accent/15 border-accent/40" : "bg-white border-slate-100 shadow-sm"}`}>
                  {step.done ? (
                    <div className="w-5 h-5 rounded-full bg-success flex items-center justify-center shrink-0">
                      <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    </div>
                  ) : step.active ? (
                    <div className="w-5 h-5 rounded-full border-2 border-primary flex items-center justify-center shrink-0">
                      <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
                    </div>
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-neutral-dark/20 shrink-0" />
                  )}
                  <p className={`text-xs font-semibold ${step.done ? "text-success" : step.active ? "text-primary" : "text-neutral-dark/45"}`}>
                    {step.label}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <PollingStatusBanner
        status={status}
        error={error}
        loadingText="Vérification du paiement..."
        reconnectingText="Reconnexion..."
      />
    </div>
  );
}
