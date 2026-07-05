import Link from "next/link";

const DEMO_KIOSK_ID = "3fa85f64-5717-4562-b3fc-2c963f66afa6";

// Icône imprimante
function PrinterIcon() {
  return (
    <svg
      className="w-12 h-12 text-accent"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
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

// Icône fusée (démo)
function RocketIcon() {
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
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 00-2.91-.09z" />
      <path d="M12 15l-3-3a22 22 0 012-3.95A12.88 12.88 0 0122 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 01-4 2z" />
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
      <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
    </svg>
  );
}

// Icône carte / map-pin
function MapIcon() {
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
      <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
      <line x1="9" y1="3" x2="9" y2="18" />
      <line x1="15" y1="6" x2="15" y2="21" />
    </svg>
  );
}

export default function HomePage() {
  return (
    <div className="min-h-screen bg-primary flex flex-col items-center justify-center px-6 gap-8">
      {/* Logo */}
      <div className="flex flex-col items-center gap-4">
        <div className="w-24 h-24 rounded-3xl bg-white/10 backdrop-blur flex items-center justify-center shadow-2xl">
          <PrinterIcon />
        </div>
        <div className="text-center">
          <h1 className="text-3xl font-extrabold text-white">Borne Multiservice</h1>
          <p className="text-accent/70 mt-1">Impression mobile · Paiement sécurisé</p>
        </div>
      </div>

      {/* CTA */}
      <div className="w-full max-w-sm flex flex-col gap-3">
        <Link
          href={`/s?kiosk=${DEMO_KIOSK_ID}`}
          className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl bg-accent text-primary font-bold text-lg shadow-xl active:scale-[0.98] transition-transform"
        >
          <RocketIcon />
          Lancer la démo
        </Link>

        <Link
          href="/carte"
          className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl font-semibold text-base text-accent/90 active:scale-[0.98] transition-all"
          style={{
            background: "rgba(202,220,252,0.08)",
            border: "1px solid rgba(202,220,252,0.18)",
          }}
        >
          <MapIcon />
          Voir les bornes sur la carte
        </Link>

        <p className="text-center text-white/30 text-xs mt-1">
          Borne démo : {DEMO_KIOSK_ID}
        </p>
      </div>

      <p className="text-white/20 text-xs text-center absolute bottom-6">
        Prototype — Démonstration uniquement
      </p>
    </div>
  );
}
