"use client";

import { useEffect, useRef } from "react";
import type { KioskPublic } from "@/lib/api";

interface KioskMapProps {
  kiosks: KioskPublic[];
}

const STATUS_CONFIG = {
  actif: {
    color: "#02C39A",
    shadow: "rgba(2,195,154,0.4)",
    label: "Actif",
  },
  maintenance: {
    color: "#F59E0B",
    shadow: "rgba(245,158,11,0.4)",
    label: "Maintenance",
  },
  hors_ligne: {
    color: "#EF4444",
    shadow: "rgba(239,68,68,0.4)",
    label: "Hors ligne",
  },
} as const;

// SVG marker pin with inner dot
function createMarkerSvg(color: string, shadow: string): string {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="36" height="44" viewBox="0 0 36 44">
      <defs>
        <filter id="shadow-${color.replace('#','')}" x="-40%" y="-20%" width="180%" height="180%">
          <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="${shadow}" />
        </filter>
      </defs>
      <!-- Pin body -->
      <path
        d="M18 2C10.268 2 4 8.268 4 16c0 10.5 14 26 14 26s14-15.5 14-26C32 8.268 25.732 2 18 2z"
        fill="${color}"
        filter="url(#shadow-${color.replace('#','')})"
      />
      <!-- Inner circle (kiosk icon) -->
      <circle cx="18" cy="16" r="6" fill="white" opacity="0.9"/>
      <!-- Kiosk icon inside -->
      <rect x="14" y="13" width="8" height="6" rx="1" fill="${color}"/>
      <rect x="16" y="19" width="4" height="2" fill="${color}"/>
      <line x1="14" y1="13" x2="22" y2="13" stroke="white" stroke-width="1"/>
    </svg>
  `.trim();
}

export default function KioskMap({ kiosks }: KioskMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<import("leaflet").Map | null>(null);

  useEffect(() => {
    if (!mapRef.current) return;

    let initialized = true; // flag to cancel async init if cleanup runs first

    // Dynamically import Leaflet to avoid SSR issues
    import("leaflet").then((L) => {
      if (!initialized || mapInstanceRef.current) return; // already cleaned up or initialized
      // Fix default icon paths
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl:
          "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
        iconUrl:
          "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
        shadowUrl:
          "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
      });

      // Calculate center from kiosks with GPS coords
      const withCoords = kiosks.filter(
        (k) => k.location_lat !== null && k.location_lng !== null
      );

      const center: [number, number] =
        withCoords.length > 0
          ? [
              withCoords.reduce((sum, k) => sum + k.location_lat!, 0) /
                withCoords.length,
              withCoords.reduce((sum, k) => sum + k.location_lng!, 0) /
                withCoords.length,
            ]
          : [3.848, 11.502]; // Default: Yaoundé, Cameroun

      const zoom = withCoords.length > 0 ? 13 : 12;

      const map = L.map(mapRef.current!, {
        center,
        zoom,
        zoomControl: true,
        attributionControl: true,
      });

      mapInstanceRef.current = map;

      // OpenStreetMap tiles — dark variant via CartoDB
      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
          subdomains: "abcd",
          maxZoom: 19,
        }
      ).addTo(map);

      // Add markers
      withCoords.forEach((kiosk) => {
        const cfg =
          STATUS_CONFIG[kiosk.status] ?? STATUS_CONFIG["hors_ligne"];

        const icon = L.divIcon({
          html: createMarkerSvg(cfg.color, cfg.shadow),
          className: "",
          iconSize: [36, 44],
          iconAnchor: [18, 44],
          popupAnchor: [0, -44],
        });

        const marker = L.marker([kiosk.location_lat!, kiosk.location_lng!], {
          icon,
        });

        const statusBadge = `
          <span style="
            display:inline-flex;align-items:center;gap:5px;
            background:${cfg.color}22;color:${cfg.color};
            border:1px solid ${cfg.color}55;
            border-radius:999px;padding:2px 10px;font-size:11px;font-weight:600;
          ">
            <span style="width:7px;height:7px;border-radius:50%;background:${cfg.color};display:inline-block;"></span>
            ${cfg.label}
          </span>
        `;

        marker.bindPopup(`
          <div style="
            font-family:'Outfit',system-ui,sans-serif;
            min-width:180px;padding:4px 2px;
          ">
            <div style="font-size:15px;font-weight:700;color:#1E2761;margin-bottom:6px;">
              ${kiosk.name}
            </div>
            <div style="margin-bottom:10px;">${statusBadge}</div>
            ${
              kiosk.status === "actif"
                ? `<a
                    href="/s?kiosk=${kiosk.id}"
                    style="
                      display:block;width:100%;text-align:center;
                      background:#1E2761;color:#CADCFC;
                      padding:7px 0;border-radius:8px;
                      font-weight:600;font-size:13px;text-decoration:none;
                    "
                  >Utiliser cette borne</a>`
                : `<div style="text-align:center;color:#9ca3af;font-size:12px;">Borne indisponible</div>`
            }
          </div>
        `);

        marker.addTo(map);
      });

      // Bornes sans coordonnées : overlay direct sur le conteneur
      if (withCoords.length === 0) {
        const overlay = document.createElement("div");
        overlay.style.cssText = `
          position:absolute;top:10px;right:10px;z-index:1000;
          background:rgba(30,39,97,0.85);color:#CADCFC;
          padding:8px 14px;border-radius:10px;font-size:12px;
          backdrop-filter:blur(8px);pointer-events:none;
        `;
        overlay.textContent = "Aucune borne avec coordonnées GPS";
        mapRef.current!.appendChild(overlay);
      }
    });

    return () => {
      initialized = false; // cancel pending async init
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [kiosks]);

  return (
    <div
      ref={mapRef}
      style={{ width: "100%", height: "100%", borderRadius: "inherit" }}
    />
  );
}
