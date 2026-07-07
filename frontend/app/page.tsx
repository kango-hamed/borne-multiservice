"use client";

import React, { useEffect, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session-context";

// ── Icônes ────────────────────────────────────────────────────────────────────

function PrinterIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" />
    </svg>
  );
}

function CopyIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
    </svg>
  );
}

function ScanIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5z" />
      <path d="M3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5z" />
      <path d="M13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
      <path d="M6.75 6.75h.75m9 0h.75m-9 9h.75m3-3h.75M13.5 21v-3.375A1.125 1.125 0 0114.625 16.5h4.5c.621 0 1.125.504 1.125 1.125V21M13.5 21H21M13.5 21h-1.5m9 0v-3.375m0 3.375H21" />
    </svg>
  );
}

function MapPinIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0116 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#C8CAD8" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M8.25 4.5l7.5 7.5-7.5 7.5" />
    </svg>
  );
}

// ── Carte service réutilisable ─────────────────────────────────────────────────

interface ServiceRowProps {
  icon: React.ReactNode;
  label: string;
  description: string;
  price: string;
  detail: string;
  badge?: string;
  badgeColor?: string;
  onClick?: () => void;
  href?: string;
}

function ServiceRow({ icon, label, description, price, detail, badge, badgeColor = "#EAF7F3", onClick, href }: ServiceRowProps) {
  const inner = (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 12,
      width: "100%",
      height: "100%",
      padding: "0 14px",
      borderRadius: 12,
      border: "0.5px solid #D8DBEE",
      background: "#FFFFFF",
      cursor: "pointer",
      textAlign: "left",
      boxSizing: "border-box",
      position: "relative",
    }}>
      {badge && (
        <span style={{
          position: "absolute",
          top: 8,
          right: 10,
          fontSize: 9,
          fontWeight: 700,
          padding: "2px 7px",
          borderRadius: 20,
          background: badgeColor,
          color: badgeColor === "#EAF7F3" ? "#0F6E56" : "#1E2258",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}>{badge}</span>
      )}

      <div style={{
        width: 44,
        height: 44,
        borderRadius: 10,
        background: "#EAF7F3",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        color: "#16A38A",
      }}>
        {icon}
      </div>

      <div style={{ flex: 1, minWidth: 0, paddingRight: badge ? 52 : 0 }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#1B1B2E" }}>{label}</p>
        <p style={{ margin: "1px 0 0", fontSize: 11, color: "#6B6E8C", lineHeight: 1.35 }}>{description}</p>
        <p style={{ margin: "4px 0 0", fontSize: 10, color: "#16A38A", fontWeight: 600 }}>
          {price}<span style={{ color: "#D8DBEE", margin: "0 4px" }}>•</span>{detail}
        </p>
      </div>

      <ChevronRight />
    </div>
  );

  if (href) {
    return (
      <Link href={href} style={{ textDecoration: "none", display: "flex", flex: 1 }}>
        {inner}
      </Link>
    );
  }

  return (
    <button onClick={onClick} style={{ background: "none", border: "none", padding: 0, flex: 1, display: "flex" }}>
      {inner}
    </button>
  );
}

// ── Page principale (avec détection du kiosk dans l'URL) ─────────────────────

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setSession, setServiceType, kioskId: ctxKioskId, kioskName } = useSession();

  const [loading, setLoading] = useState(false);
  const [kioskReady, setKioskReady] = useState(false);
  const [resolvedKioskName, setResolvedKioskName] = useState<string>("");
  const hasFired = useRef(false);

  useEffect(() => {
    const paramKioskId = searchParams.get("kiosk");

    // Si la session est déjà initialisée (navigation interne), on est prêts
    if (ctxKioskId) {
      setKioskReady(true);
      setResolvedKioskName(kioskName || "Borne");
      return;
    }

    // Si pas de paramètre kiosk dans l'URL → mode vitrine
    if (!paramKioskId) return;

    // Éviter le double appel React StrictMode
    if (hasFired.current) return;
    hasFired.current = true;

    setLoading(true);
    api
      .createSession(paramKioskId)
      .then((data) => {
        setSession(data.session_token, paramKioskId, data.kiosk_name);
        setResolvedKioskName(data.kiosk_name);
        setKioskReady(true);
      })
      .catch((err) => {
        console.error("Impossible d'initialiser la session:", err);
      })
      .finally(() => setLoading(false));
  }, [searchParams, setSession, ctxKioskId, kioskName]);

  // Handlers service — avec kiosk
  const goToService = (serviceType: "impression" | "photocopie", path: string) => {
    setServiceType(serviceType);
    router.push(path);
  };

  // ── Mode chargement ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{
        height: "100dvh",
        background: "#1E2258",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 20,
        fontFamily: "var(--font-sans, sans-serif)",
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: 16,
          background: "rgba(255,255,255,0.08)",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#FFFFFF",
        }}>
          <PrinterIcon size={30} />
        </div>
        <div style={{ textAlign: "center" }}>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "#FFFFFF" }}>Connexion à la borne…</p>
          <p style={{ margin: "6px 0 0", fontSize: 12, color: "rgba(184,188,224,0.6)" }}>Veuillez patienter</p>
        </div>
        <svg width={28} height={28} viewBox="0 0 24 24" fill="none" style={{ animation: "spin 1s linear infinite" }}>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <circle cx="12" cy="12" r="10" stroke="rgba(22,163,138,0.3)" strokeWidth="4" />
          <path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill="#16A38A" />
        </svg>
      </div>
    );
  }

  // ── Mode borne sélectionnée (QR scanné) ────────────────────────────────────
  if (kioskReady) {
    return (
      <div style={{
        height: "100dvh",
        background: "#F5F6FA",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        fontFamily: "var(--font-sans, sans-serif)",
      }}>
        {/* Header avec nom de borne */}
        <div style={{ background: "#1E2258", padding: "28px 20px 20px", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 8, textAlign: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#16A38A", display: "inline-block" }} />
              <span style={{ fontSize: 13, color: "rgba(184,188,224,0.8)", fontWeight: 500 }}>Borne connectée</span>
            </div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#FFFFFF" }}>
              {resolvedKioskName}
            </h1>
            <p style={{ margin: 0, fontSize: 12, color: "rgba(184,188,224,0.65)" }}>
              Sélectionnez un service pour commencer
            </p>
          </div>
        </div>

        {/* Services — s'étendent sur tout l'espace disponible */}
        <div style={{ flex: 1, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10, overflow: "hidden" }}>

          <ServiceRow
            icon={<PrinterIcon />}
            label="Impression"
            description="Envoyez un fichier depuis votre téléphone"
            price="À partir de 50 FCFA"
            detail="PDF, JPG, DOCX"
            badge="Populaire"
            badgeColor="#EAF7F3"
            onClick={() => goToService("impression", "/flow/upload")}
          />

          <ServiceRow
            icon={<CopyIcon />}
            label="Photocopie"
            description="Copiez un document avec le scanner de la borne"
            price="À partir de 50 FCFA"
            detail="Canon G3030"
            badge="Nouveau"
            badgeColor="#EEF0FF"
            onClick={() => goToService("photocopie", "/flow/photocopie")}
          />

          <ServiceRow
            icon={<ScanIcon />}
            label="Scan de document"
            description="Numérisez et recevez un PDF sur votre téléphone"
            price="À partir de 25 FCFA"
            detail="Envoi par lien"
            onClick={() => router.push("/flow/scan")}
          />
        </div>

        {/* Bas de page */}
        <div style={{ padding: "0 18px 24px", flexShrink: 0 }}>
          <div style={{ borderTop: "0.5px solid #D8DBEE", marginBottom: 14 }} />
          <p style={{ textAlign: "center", fontSize: 11, color: "#B8BCE0", margin: 0 }}>
            ℹ️ Vous serez guidé étape par étape après votre choix
          </p>
        </div>
      </div>
    );
  }

  // ── Mode vitrine (pas de kiosk dans l'URL) ─────────────────────────────────
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
      <div style={{ background: "#1E2258", padding: "32px 24px 24px", flexShrink: 0 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, textAlign: "center" }}>
          <div style={{
            width: 64, height: 64, borderRadius: 16,
            background: "rgba(255,255,255,0.08)",
            display: "flex", alignItems: "center", justifyContent: "center",
            border: "1px solid rgba(255,255,255,0.12)",
            color: "#FFFFFF",
          }}>
            <PrinterIcon size={30} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#FFFFFF" }}>Borne Multiservice</h1>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 5, marginTop: 8,
              background: "#EAF7F3", color: "#0F6E56", fontSize: 11,
              padding: "3px 10px", borderRadius: 20, fontWeight: 600,
            }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#16A38A", display: "inline-block" }} />
              Service disponible
            </span>
          </div>
          <p style={{ margin: 0, fontSize: 12, color: "rgba(184,188,224,0.7)", maxWidth: 200 }}>
            Impression, photocopie et scan de documents depuis votre téléphone.
          </p>
        </div>
      </div>

      {/* Services vitrine — liens vers /carte */}
      <div style={{ flex: 1, padding: "16px 18px 0", display: "flex", flexDirection: "column", gap: 8, overflow: "hidden" }}>
        <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, color: "#9B9DB8", textTransform: "uppercase", letterSpacing: "0.07em" }}>
          Services disponibles
        </p>

        <ServiceRow icon={<PrinterIcon />} label="Impression"
          description="Envoyez un fichier depuis votre téléphone" price="À partir de 50 FCFA" detail="PDF, JPG, DOCX"
          badge="Populaire" badgeColor="#EAF7F3" href="/carte" />

        <ServiceRow icon={<CopyIcon />} label="Photocopie"
          description="Copiez un document avec le scanner de la borne" price="À partir de 50 FCFA" detail="Canon G3030"
          badge="Nouveau" badgeColor="#EEF0FF" href="/carte" />

        <ServiceRow icon={<ScanIcon />} label="Scan de document"
          description="Numérisez et recevez un PDF sur votre téléphone" price="À partir de 25 FCFA" detail="Envoi par lien"
          href="/carte" />
      </div>

      {/* CTA trouver une borne */}
      <div style={{ padding: "14px 18px 22px", flexShrink: 0 }}>
        <div style={{ borderTop: "0.5px solid #D8DBEE", marginBottom: 14 }} />
        <Link href="/carte" id="btn-find-kiosk" style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
          width: "100%", padding: "14px", borderRadius: 12,
          background: "#16A38A", color: "#FFFFFF", fontSize: 14, fontWeight: 700,
          textDecoration: "none", boxSizing: "border-box",
        }}>
          <MapPinIcon />
          Trouver une borne près de moi
        </Link>
        <p style={{ textAlign: "center", fontSize: 10, color: "#B8BCE0", margin: "8px 0 0" }}>
          Ou scannez le QR code affiché sur la borne pour démarrer directement
        </p>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={
      <div style={{ height: "100dvh", background: "#1E2258", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg width={28} height={28} viewBox="0 0 24 24" fill="none" style={{ animation: "spin 1s linear infinite" }}>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <circle cx="12" cy="12" r="10" stroke="rgba(22,163,138,0.3)" strokeWidth="4" />
          <path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill="#16A38A" />
        </svg>
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}
