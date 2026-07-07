"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session-context";

function PrinterIcon() {
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
    </svg>
  );
}

function ScanIcon() {
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5z" />
      <path d="M3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5z" />
      <path d="M13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
      <path d="M6.75 6.75h.75m9 0h.75m-9 9h.75m3-3h.75M13.5 21v-3.375A1.125 1.125 0 0114.625 16.5h4.5c.621 0 1.125.504 1.125 1.125V21M13.5 21H21M13.5 21h-1.5m9 0v-3.375m0 3.375H21" />
    </svg>
  );
}

export default function ServiceSelectionPage() {
  const router = useRouter();
  const { kioskName, setServiceType } = useSession();

  const handleSelectImpression = () => {
    setServiceType("impression");
    router.push("/flow/upload");
  };

  const handleSelectPhotocopie = () => {
    setServiceType("photocopie");
    router.push("/flow/photocopie");
  };

  const handleSelectScan = () => {
    router.push("/flow/scan");
  };

  const services = [
    {
      id: "btn-service-impression",
      icon: <PrinterIcon />,
      label: "Impression",
      description: "Envoyez un fichier depuis votre téléphone",
      price: "À partir de 50 FCFA",
      onClick: handleSelectImpression,
    },
    {
      id: "btn-service-photocopie",
      icon: <CopyIcon />,
      label: "Photocopie",
      description: "Copiez un document avec le scanner de la borne",
      price: "À partir de 50 FCFA",
      onClick: handleSelectPhotocopie,
    },
    {
      id: "btn-service-scan",
      icon: <ScanIcon />,
      label: "Scan de document",
      description: "Numérisez et recevez un PDF sur votre téléphone",
      price: "À partir de 25 FCFA",
      onClick: handleSelectScan,
    },
  ];

  return (
    <div style={{
      height: "100dvh",
      background: "#F5F6FA",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      fontFamily: "var(--font-sans, sans-serif)",
    }}>

      {/* Header */}
      <div style={{ background: "#1E2258", padding: "14px 16px 12px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ width: 40 }} />
          <span style={{ color: "#FFFFFF", fontSize: 14, fontWeight: 500 }}>
            {kioskName || "Borne Multiservice"}
          </span>
          <button
            onClick={() => router.push("/")}
            style={{ background: "none", border: "none", color: "#B8BCE0", fontSize: 12, padding: "4px", cursor: "pointer", width: 40, textAlign: "right" }}
          >
            Fermer
          </button>
        </div>

        {/* Stepper dots */}
        <div style={{ display: "flex", justifyContent: "center", gap: 5, paddingTop: 10 }}>
          <span style={{ width: 18, height: 6, borderRadius: 3, background: "#16A38A", display: "inline-block" }} />
          {[0, 1, 2, 3].map((i) => (
            <span key={i} style={{ width: 6, height: 6, borderRadius: 3, background: "#3A3E72", display: "inline-block" }} />
          ))}
        </div>
      </div>

      {/* Contenu principal */}
      <div style={{ flex: 1, padding: "20px 18px", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <p style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 600, color: "#1B1B2E", flexShrink: 0 }}>
          Que souhaitez-vous faire ?
        </p>

        {/* Cartes service */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
          {services.map((s) => (
            <button
              key={s.id}
              id={s.id}
              onClick={s.onClick}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                width: "100%",
                flex: 1,
                padding: "0 16px",
                borderRadius: 12,
                border: "0.5px solid #D8DBEE",
                background: "#FFFFFF",
                cursor: "pointer",
                textAlign: "left",
                boxSizing: "border-box",
              }}
            >
              {/* Icône */}
              <div style={{
                width: 46,
                height: 46,
                borderRadius: 10,
                background: "#EAF7F3",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                color: "#16A38A",
              }}>
                {s.icon}
              </div>

              {/* Texte */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 500, color: "#1B1B2E" }}>{s.label}</p>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: "#6B6E8C" }}>{s.description}</p>
                <p style={{ margin: "4px 0 0", fontSize: 11, color: "#16A38A", fontWeight: 600 }}>{s.price}</p>
              </div>

              {/* Flèche */}
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#C8CAD8" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <path d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          ))}
        </div>
      </div>

      {/* Bouton CTA bas */}
      <div style={{ padding: "0 18px 24px", flexShrink: 0 }}>
        <div style={{ borderTop: "0.5px solid #D8DBEE", marginBottom: 14 }} />
        <div style={{
          background: "#EAF7F3",
          borderRadius: 10,
          padding: "11px 14px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          border: "0.5px solid #C5EDE5",
        }}>
          <span style={{ fontSize: 14, flexShrink: 0 }}>ℹ️</span>
          <p style={{ margin: 0, fontSize: 11, color: "#0F6E56", lineHeight: 1.45 }}>
            Sélectionnez un service. Vous serez guidé étape par étape.
          </p>
        </div>
      </div>
    </div>
  );
}
