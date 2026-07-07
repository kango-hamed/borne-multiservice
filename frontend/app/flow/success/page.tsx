"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session-context";
import { api } from "@/lib/api";

function DownloadIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

export default function SuccessPage() {
  const router = useRouter();
  const { kioskId, clearSession, serviceType, jobId } = useSession();

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

  const isScan = serviceType === "scan";
  const downloadUrl = isScan && jobId ? api.getDownloadUrl(jobId) : null;

  return (
    <div style={{
      height: "100dvh",
      background: isScan ? "#1E2258" : "#16A38A",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px 20px",
      boxSizing: "border-box",
      fontFamily: "var(--font-sans, sans-serif)",
      overflow: "hidden",
      transition: "background 0.3s ease",
    }}>
      {/* Icône succès */}
      <div style={{ width: 96, height: 96, borderRadius: "50%", background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 24 }}>
        <svg width={48} height={48} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 13l4 4L19 7" />
        </svg>
      </div>

      <h1 style={{ margin: "0 0 10px", fontSize: 28, fontWeight: 900, color: "#FFFFFF", textAlign: "center" }}>
        {isScan ? "Scan réussi !" : "Merci !"}
      </h1>
      <p style={{ margin: "0 0 32px", fontSize: 14, color: "rgba(255,255,255,0.85)", textAlign: "center", maxWidth: 260, lineHeight: 1.6 }}>
        {isScan 
          ? "Votre document a été numérisé avec succès. Téléchargez votre PDF ci-dessous."
          : "Votre document a été récupéré avec succès. À très bientôt sur nos bornes."}
      </p>

      {/* Téléchargement pour scan */}
      {isScan && downloadUrl && (
        <a
          href={downloadUrl}
          target="_blank"
          rel="noopener noreferrer"
          download="scan.pdf"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            width: "100%",
            maxWidth: 340,
            padding: "16px",
            borderRadius: 14,
            background: "#16A38A",
            color: "#FFFFFF",
            fontWeight: 700,
            fontSize: 15,
            textDecoration: "none",
            boxSizing: "border-box",
            marginBottom: 20,
            textAlign: "center",
            boxShadow: "0 4px 12px rgba(22,163,138,0.2)",
          }}
        >
          <DownloadIcon />
          Télécharger le PDF
        </a>
      )}

      {/* Boutons d'actions */}
      <div style={{ width: "100%", maxWidth: 340, display: "flex", flexDirection: "column", gap: 12 }}>
        <button
          onClick={handleNew}
          style={{
            width: "100%",
            padding: "16px",
            borderRadius: 14,
            border: "none",
            background: "#FFFFFF",
            color: isScan ? "#1E2258" : "#16A38A",
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
          {isScan ? "Nouveau scan" : "Nouveau service"}
        </button>
        <button
          onClick={handleHome}
          style={{
            width: "100%",
            padding: "14px",
            borderRadius: 14,
            border: "2px solid rgba(255,255,255,0.4)",
            background: "transparent",
            color: "#FFFFFF",
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
