"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { StepHeader } from "@/components/StepHeader";
import { WithdrawalCodeDisplay } from "@/components/WithdrawalCodeDisplay";
import { useSession } from "@/lib/session-context";
import { usePolling } from "@/hooks/usePolling";
import { api } from "@/lib/api";

export default function ReadyPage() {
  const router = useRouter();
  const { withdrawalCode, kioskName, kioskId, clearSession, jobId } = useSession();

  const queryFn = React.useCallback(() => {
    if (!jobId) throw new Error("Pas de job");
    return api.getJobStatus(jobId);
  }, [jobId]);

  const checkSuccess = React.useCallback(
    (data: any) => data.status === "recupere",
    []
  );

  const { status } = usePolling({
    queryFn,
    checkSuccess,
    intervalMs: 4000,
    enabled: !!jobId,
  });

  React.useEffect(() => {
    if (status === "success") {
      router.push("/flow/success");
    }
  }, [status, router]);

  const handleNew = () => {
    clearSession();
    if (kioskId) {
      router.replace(`/?kiosk=${kioskId}`);
    } else {
      router.replace("/");
    }
  };

  const handleHome = () => {
    clearSession();
    router.replace("/");
  };

  return (
    <div style={{ height: "100dvh", background: "#F5F6FA", display: "flex", flexDirection: "column", overflow: "hidden", fontFamily: "var(--font-sans, sans-serif)" }}>

      {/* Header */}
      <div style={{ background: "#1E2258", padding: "20px 18px 16px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: 11, color: "rgba(184,188,224,0.65)", fontWeight: 500 }}>Étape 6/6</p>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#FFFFFF" }}>Récupération</p>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {[0,1,2,3,4,5].map(i => (
              <div key={i} style={{ width: 20, height: 3, borderRadius: 2, background: "#16A38A" }} />
            ))}
          </div>
        </div>
      </div>

      {/* Corps */}
      <div style={{ flex: 1, padding: "20px 18px", display: "flex", flexDirection: "column", gap: 14, overflow: "hidden" }}>

        {/* Code de retrait ou confirmation */}
        {withdrawalCode ? (
          <WithdrawalCodeDisplay code={withdrawalCode} kioskName={kioskName} />
        ) : (
          <div style={{ background: "#FFFFFF", border: "0.5px solid #D8DBEE", borderRadius: 14, padding: "24px 16px", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, textAlign: "center" }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#EAF7F3", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="#16A38A" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#1B1B2E" }}>Document imprimé !</p>
              <p style={{ margin: "6px 0 0", fontSize: 12, color: "#6B6E8C", lineHeight: 1.5 }}>
                Présentez-vous à l'agent pour récupérer votre document.
              </p>
            </div>
          </div>
        )}

        {/* Instructions */}
        <div style={{ background: "#FFFFFF", border: "0.5px solid #D8DBEE", borderRadius: 14, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
          <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: "#9B9DB8", textTransform: "uppercase", letterSpacing: "0.07em" }}>Comment récupérer</p>
          {[
            { icon: "👆", text: "Mémorisez ou prenez en photo ce code." },
            { icon: "🚶", text: "Rendez-vous au comptoir agent." },
            { icon: "🗣️", text: "Communiquez le code à l'agent." },
            { icon: "📄", text: "Recevez votre document imprimé." },
          ].map((step, idx) => (
            <div key={idx} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 10px", background: "#F5F6FA", borderRadius: 10 }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>{step.icon}</span>
              <p style={{ margin: 0, fontSize: 12, color: "#4B4E72", lineHeight: 1.4 }}>{step.text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Footer — deux boutons */}
      <div style={{ padding: "12px 18px 28px", flexShrink: 0, display: "flex", flexDirection: "column", gap: 10 }}>
        <button
          onClick={handleNew}
          style={{
            width: "100%",
            padding: "16px",
            borderRadius: 14,
            border: "none",
            background: "#16A38A",
            color: "#FFFFFF",
            fontSize: 15,
            fontWeight: 700,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12l7-7 7 7" />
          </svg>
          Nouveau service
        </button>
        <button
          onClick={handleHome}
          style={{
            width: "100%",
            padding: "14px",
            borderRadius: 14,
            border: "1.5px solid #D8DBEE",
            background: "#FFFFFF",
            color: "#6B6E8C",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Page d'accueil
        </button>
      </div>
    </div>
  );
}
