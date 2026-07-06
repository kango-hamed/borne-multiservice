"use client";

import Link from "next/link";

// Icône imprimante
function PrinterIcon() {
  return (
    <svg
      className="w-14 h-14"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.2}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z"
      />
    </svg>
  );
}

// Icône carte
function MapPinIcon() {
  return (
    <svg
      className="w-5 h-5"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0116 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

// Icône QR code
function QrCodeIcon() {
  return (
    <svg
      className="w-5 h-5"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="2" width="8" height="8" rx="1" />
      <rect x="14" y="2" width="8" height="8" rx="1" />
      <rect x="2" y="14" width="8" height="8" rx="1" />
      <path d="M14 14h2v2h-2z" />
      <path d="M20 14h2v2h-2z" />
      <path d="M14 20h2v2h-2z" />
      <path d="M20 20h2v2h-2z" />
      <path d="M18 14h-1v4h1" />
      <path d="M14 18v-1h4v1" />
    </svg>
  );
}

// Petit badge de service
function ServiceBadge({ icon, label }: { icon: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 backdrop-blur-sm rounded-full text-xs font-medium text-accent/90">
      <span>{icon}</span>
      {label}
    </span>
  );
}

export default function HomePage() {
  return (
    <div className="min-h-screen bg-primary flex flex-col items-center justify-center px-6 gap-10 relative overflow-hidden">
      {/* Cercles décoratifs en arrière-plan */}
      <div className="absolute top-[-120px] right-[-80px] w-[300px] h-[300px] rounded-full bg-accent/5 blur-3xl" />
      <div className="absolute bottom-[-100px] left-[-60px] w-[250px] h-[250px] rounded-full bg-success/5 blur-3xl" />

      {/* Logo et branding */}
      <div className="flex flex-col items-center gap-5 z-10">
        <div className="w-28 h-28 rounded-[2rem] bg-white/10 backdrop-blur-md flex items-center justify-center shadow-2xl border border-white/10 text-accent">
          <PrinterIcon />
        </div>
        <div className="text-center">
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            Borne Multiservice
          </h1>
          <p className="text-accent/60 mt-2 text-sm font-medium tracking-wide">
            Impression • Photocopie • Scan
          </p>
        </div>
      </div>

      {/* Badges de services */}
      <div className="flex flex-wrap justify-center gap-2 z-10">
        <ServiceBadge icon="🖨️" label="Impression" />
        <ServiceBadge icon="📋" label="Photocopie" />
        <ServiceBadge icon="📱" label="Scan" />
      </div>

      {/* Boutons d'action */}
      <div className="w-full max-w-sm flex flex-col gap-3 z-10">
        <Link
          href="/carte"
          id="btn-find-kiosk"
          className="flex items-center justify-center gap-2.5 w-full py-4 rounded-2xl bg-accent text-primary font-bold text-lg shadow-xl shadow-accent/20 active:scale-[0.98] transition-transform"
        >
          <MapPinIcon />
          Trouver une borne près de moi
        </Link>

        <Link
          href="/carte"
          id="btn-scan-qr"
          className="flex items-center justify-center gap-2.5 w-full py-3.5 rounded-2xl font-semibold text-base text-accent/90 active:scale-[0.98] transition-all"
          style={{
            background: "rgba(202,220,252,0.08)",
            border: "1px solid rgba(202,220,252,0.15)",
          }}
        >
          <QrCodeIcon />
          J&apos;ai déjà un QR code
        </Link>
      </div>

      {/* Footer */}
      <p className="text-white/15 text-xs text-center absolute bottom-6 z-10">
        © 2026 Borne Multiservice — Tous droits réservés
      </p>
    </div>
  );
}
