"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, type KioskPublic } from "@/lib/api";

// Import dynamique pour éviter le rendu SSR de Leaflet
const KioskMap = dynamic(() => import("@/components/KioskMap"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center w-full h-full bg-neutral-dark/60">
      <div className="flex flex-col items-center gap-3">
        <svg
          className="animate-spin w-8 h-8 text-accent"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8v8H4z"
          />
        </svg>
        <span className="text-accent/60 text-sm">Chargement de la carte…</span>
      </div>
    </div>
  ),
});

const STATUS_LABELS: Record<string, string> = {
  actif: "Actif",
  maintenance: "En maintenance",
  hors_ligne: "Hors ligne",
};

const STATUS_COLORS: Record<string, string> = {
  actif: "#02C39A",
  maintenance: "#F59E0B",
  hors_ligne: "#EF4444",
};

// Icône SVG pour le statut (point pulsant pour actif)
function StatusIcon({ status }: { status: string }) {
  const color = STATUS_COLORS[status] ?? "#9ca3af";
  if (status === "actif") {
    return (
      <span className="relative flex h-3 w-3 shrink-0">
        <span
          className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
          style={{ backgroundColor: color }}
        />
        <span
          className="relative inline-flex h-3 w-3 rounded-full"
          style={{ backgroundColor: color }}
        />
      </span>
    );
  }
  return (
    <span
      className="inline-flex h-3 w-3 shrink-0 rounded-full"
      style={{ backgroundColor: color }}
    />
  );
}

// Icône kiosk SVG
function KioskIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      className={className}
      style={style}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="4" y="3" width="16" height="12" rx="2" />
      <path d="M9 15v4m6-4v4M7 19h10" />
      <path d="M4 8h16" />
    </svg>
  );
}

// Icône map-pin SVG
function MapPinIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  );
}

// Icône arrow-left SVG
function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 12H5M12 5l-7 7 7 7" />
    </svg>
  );
}

// Icône signal-slash
function SignalSlashIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 2l20 20M9.5 9.5A5 5 0 0012 7c2.76 0 5 2.24 5 5a5 5 0 01-.5 2.18M6.34 6.34A8 8 0 004 12c0 4.42 3.58 8 8 8 1.9 0 3.64-.66 5.01-1.76M2 12a10 10 0 0110-10" />
    </svg>
  );
}

export default function CartePage() {
  const [kiosks, setKiosks] = useState<KioskPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .listKiosks()
      .then(setKiosks)
      .catch(() => setError("Impossible de charger les bornes."))
      .finally(() => setLoading(false));
  }, []);

  const counts = {
    actif: kiosks.filter((k) => k.status === "actif").length,
    maintenance: kiosks.filter((k) => k.status === "maintenance").length,
    hors_ligne: kiosks.filter((k) => k.status === "hors_ligne").length,
  };

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "#0f1129" }}
    >
      {/* ── Header ─────────────────────────────────────────── */}
      <header
        className="flex items-center gap-4 px-5 py-4 border-b"
        style={{ borderColor: "#1E2761", background: "#141736" }}
      >
        <Link
          href="/"
          className="flex items-center justify-center w-9 h-9 rounded-xl transition-colors"
          style={{ background: "#1E2761" }}
          aria-label="Retour à l'accueil"
        >
          <ArrowLeftIcon className="w-4 h-4 text-accent" />
        </Link>

        <div className="flex items-center gap-2 flex-1">
          <MapPinIcon className="w-5 h-5 text-accent" />
          <h1 className="text-white font-bold text-lg leading-none">
            Carte des bornes
          </h1>
        </div>

        {/* Stats rapides */}
        {!loading && !error && (
          <div className="flex items-center gap-3">
            {counts.actif > 0 && (
              <span
                className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
                style={{ background: "#02C39A22", color: "#02C39A" }}
              >
                <span className="w-2 h-2 rounded-full bg-[#02C39A]" />
                {counts.actif}
              </span>
            )}
            {counts.maintenance > 0 && (
              <span
                className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
                style={{ background: "#F59E0B22", color: "#F59E0B" }}
              >
                <span className="w-2 h-2 rounded-full bg-[#F59E0B]" />
                {counts.maintenance}
              </span>
            )}
            {counts.hors_ligne > 0 && (
              <span
                className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
                style={{ background: "#EF444422", color: "#EF4444" }}
              >
                <span className="w-2 h-2 rounded-full bg-[#EF4444]" />
                {counts.hors_ligne}
              </span>
            )}
          </div>
        )}
      </header>

      {/* ── Content ─────────────────────────────────────────── */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: "#1E2761" }}
            >
              <MapPinIcon className="w-7 h-7 text-accent animate-bounce" />
            </div>
            <p className="text-white/50 text-sm">Chargement des bornes…</p>
          </div>
        </div>
      ) : error ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4 text-center px-6">
            <SignalSlashIcon className="w-12 h-12 text-red-400" />
            <p className="text-white/60 text-sm">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
              style={{ background: "#1E2761" }}
            >
              Réessayer
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
          {/* ── Carte (principale sur grand écran) ── */}
          <div className="relative flex-1 min-h-[55vh] lg:min-h-0">
            <div className="absolute inset-0 rounded-none overflow-hidden">
              <KioskMap kiosks={kiosks} />
            </div>

            {/* Légende superposée sur la carte */}
            <div
              className="absolute bottom-4 left-4 z-[1000] flex flex-col gap-1.5 px-3 py-2.5 rounded-xl text-xs"
              style={{
                background: "rgba(20,23,54,0.85)",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(202,220,252,0.12)",
              }}
            >
              {Object.entries(STATUS_LABELS).map(([status, label]) => (
                <div key={status} className="flex items-center gap-2">
                  <StatusIcon status={status} />
                  <span className="text-white/70">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Liste des bornes (sidebar) ── */}
          <aside
            className="w-full lg:w-80 xl:w-96 overflow-y-auto flex flex-col"
            style={{
              background: "#141736",
              borderLeft: "1px solid #1E2761",
            }}
          >
            <div className="px-4 py-3 border-b" style={{ borderColor: "#1E2761" }}>
              <p className="text-white/40 text-xs font-medium uppercase tracking-wider">
                {kiosks.length} borne{kiosks.length > 1 ? "s" : ""} au total
              </p>
            </div>

            {kiosks.length === 0 ? (
              <div className="flex flex-col items-center justify-center flex-1 gap-3 p-8 text-center">
                <KioskIcon className="w-10 h-10 text-white/20" />
                <p className="text-white/40 text-sm">Aucune borne enregistrée</p>
              </div>
            ) : (
              <ul className="divide-y" style={{ borderColor: "#1E2761" }}>
                {kiosks.map((kiosk) => {
                  const color = STATUS_COLORS[kiosk.status] ?? "#9ca3af";
                  const hasCoords =
                    kiosk.location_lat !== null && kiosk.location_lng !== null;

                  return (
                    <li
                      key={kiosk.id}
                      className="flex items-center gap-3 px-4 py-3.5 group hover:bg-white/5 transition-colors"
                    >
                      {/* Icône borne colorée */}
                      <div
                        className="flex items-center justify-center w-10 h-10 rounded-xl shrink-0"
                        style={{ background: `${color}18`, border: `1px solid ${color}44` }}
                      >
                        <KioskIcon className="w-5 h-5" style={{ color }} />
                      </div>

                      {/* Infos */}
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-semibold text-sm truncate">
                          {kiosk.name}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <StatusIcon status={kiosk.status} />
                          <span className="text-xs" style={{ color }}>
                            {STATUS_LABELS[kiosk.status] ?? kiosk.status}
                          </span>
                        </div>
                        {!hasCoords && (
                          <p className="text-xs text-white/25 mt-0.5 flex items-center gap-1">
                            <MapPinIcon className="w-3 h-3" />
                            Position non renseignée
                          </p>
                        )}
                      </div>

                      {/* Bouton utiliser */}
                      {kiosk.status === "actif" ? (
                        <Link
                          href={`/s?kiosk=${kiosk.id}`}
                          className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                          style={{
                            background: "#1E2761",
                            color: "#CADCFC",
                            border: "1px solid #CADCFC22",
                          }}
                        >
                          Utiliser
                        </Link>
                      ) : (
                        <span className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium text-white/20 cursor-not-allowed">
                          Indisponible
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
