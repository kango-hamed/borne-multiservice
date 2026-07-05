"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { StepHeader } from "@/components/StepHeader";
import { useSession } from "@/lib/session-context";
import { api } from "@/lib/api";
import { prepareScanImage } from "@/lib/image-utils";

const MAX_PAGES = 30;

interface ScanPage {
  id: string;
  file: File;
  url: string;
}

export default function ScanPage() {
  const router = useRouter();
  const { sessionToken, setJob } = useSession();

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const [pages, setPages] = useState<ScanPage[]>([]);
  const [grayscale, setGrayscale] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Révoque toutes les URLs objets encore vivantes au démontage de l'écran.
  // Le ref suit l'état des pages (mis à jour dans un effet, pas pendant le render)
  // pour disposer de la liste courante au moment du nettoyage.
  const pagesRef = useRef<ScanPage[]>([]);
  useEffect(() => {
    pagesRef.current = pages;
  }, [pages]);
  useEffect(() => {
    return () => {
      pagesRef.current.forEach((p) => URL.revokeObjectURL(p.url));
    };
  }, []);

  const addFiles = useCallback((fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setError(null);

    const incoming = Array.from(fileList).filter((f) => f.type.startsWith("image/"));
    if (incoming.length === 0) {
      setError("Seules des photos (images) peuvent être scannées.");
      return;
    }

    setPages((prev) => {
      const room = MAX_PAGES - prev.length;
      if (room <= 0) {
        setError(`Maximum ${MAX_PAGES} pages par document.`);
        return prev;
      }
      if (incoming.length > room) {
        setError(`Maximum ${MAX_PAGES} pages : seules les ${room} premières ont été ajoutées.`);
      }
      const added = incoming.slice(0, room).map((file) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        url: URL.createObjectURL(file),
      }));
      return [...prev, ...added];
    });
  }, []);

  const handleCameraChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    addFiles(e.target.files);
    e.target.value = ""; // permet de reprendre une photo identique
  };

  const handleGalleryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    addFiles(e.target.files);
    e.target.value = "";
  };

  const removePage = (id: string) => {
    setPages((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter((p) => p.id !== id);
    });
  };

  const movePage = (index: number, direction: -1 | 1) => {
    setPages((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const handleFinish = async () => {
    if (pages.length === 0) return;

    if (!sessionToken) {
      setError("Session expirée ou invalide. Veuillez rescanner le QR code.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // Normalisation JPEG de chaque page, dans l'ordre affiché
      const prepared = await Promise.all(pages.map((p) => prepareScanImage(p.file)));

      const data = await api.scanDocument(sessionToken, prepared, grayscale);
      setJob(data.job_id, data.original_filename, data.pages, data.preview_url);
      router.push("/flow/config");
    } catch (err: any) {
      setError(err.message || "Erreur lors de l'envoi du document scanné.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col flex-1">
      <StepHeader title="Scanner un document" step={1} />

      {/* Inputs cachés : appareil photo + galerie */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleCameraChange}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleGalleryChange}
      />

      <div className="flex-1 px-4 py-6 flex flex-col gap-5">
        {pages.length === 0 ? (
          /* ── État vide : invitation à photographier ── */
          <button
            onClick={() => cameraInputRef.current?.click()}
            className="border-2 border-dashed border-accent rounded-2xl p-8 flex flex-col items-center justify-center gap-4 text-center min-h-56 bg-white hover:border-primary/50 hover:bg-accent/10 active:scale-[0.99] transition-all"
          >
            <div className="w-16 h-16 rounded-2xl bg-accent/30 flex items-center justify-center">
              <svg className="w-8 h-8 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-primary text-lg">Photographier une page</p>
              <p className="text-xs text-neutral-dark/50 mt-1">
                Placez le document sur une surface plane, bien éclairée
              </p>
            </div>
          </button>
        ) : (
          /* ── Grille des pages capturées ── */
          <div className="grid grid-cols-2 gap-3">
            {pages.map((page, index) => (
              <div
                key={page.id}
                className="relative rounded-xl overflow-hidden border border-accent/40 bg-white shadow-sm"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={page.url}
                  alt={`Page ${index + 1}`}
                  className="w-full h-40 object-cover bg-neutral-light"
                />

                {/* Numéro de page */}
                <span className="absolute top-2 left-2 w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center shadow">
                  {index + 1}
                </span>

                {/* Supprimer */}
                <button
                  onClick={() => removePage(page.id)}
                  aria-label={`Supprimer la page ${index + 1}`}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/90 text-red-600 flex items-center justify-center shadow active:scale-90 transition-transform"
                >
                  <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>

                {/* Réordonnancement */}
                <div className="absolute bottom-0 inset-x-0 flex justify-between p-1.5 bg-gradient-to-t from-black/40 to-transparent">
                  <button
                    onClick={() => movePage(index, -1)}
                    disabled={index === 0}
                    aria-label="Déplacer avant"
                    className="w-7 h-7 rounded-full bg-white/90 text-primary flex items-center justify-center shadow active:scale-90 transition-transform disabled:opacity-30"
                  >
                    <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                    </svg>
                  </button>
                  <button
                    onClick={() => movePage(index, 1)}
                    disabled={index === pages.length - 1}
                    aria-label="Déplacer après"
                    className="w-7 h-7 rounded-full bg-white/90 text-primary flex items-center justify-center shadow active:scale-90 transition-transform disabled:opacity-30"
                  >
                    <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Actions d'ajout (visibles dès qu'il y a au moins une page) */}
        {pages.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => cameraInputRef.current?.click()}
              className="flex items-center justify-center gap-2 py-3 rounded-xl bg-primary/10 text-primary font-semibold text-sm active:scale-[0.98] transition-transform"
            >
              📷 Ajouter une page
            </button>
            <button
              onClick={() => galleryInputRef.current?.click()}
              className="flex items-center justify-center gap-2 py-3 rounded-xl bg-accent/20 text-primary font-semibold text-sm active:scale-[0.98] transition-transform"
            >
              🖼️ Depuis la galerie
            </button>
          </div>
        )}

        {/* Import galerie depuis l'état vide */}
        {pages.length === 0 && (
          <button
            onClick={() => galleryInputRef.current?.click()}
            className="text-sm text-primary/70 font-medium underline underline-offset-2 self-center"
          >
            ou importer des photos existantes
          </button>
        )}

        {/* Optimisation N&B */}
        {pages.length > 0 && (
          <div className="bg-white rounded-2xl p-4 border border-accent/30">
            <div className="flex items-center justify-between">
              <div className="pr-3">
                <p className="font-semibold text-neutral-dark">Optimiser pour le texte</p>
                <p className="text-xs text-neutral-dark/50 mt-0.5">
                  Noir & blanc plus net, fichier plus léger
                </p>
              </div>
              <button
                onClick={() => setGrayscale(!grayscale)}
                aria-label="Optimiser pour le texte"
                className={`relative w-14 h-7 rounded-full transition-colors duration-200 shrink-0
                  ${grayscale ? "bg-success" : "bg-neutral-dark/15"}`}
              >
                <span className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow-sm transition-all duration-200
                  ${grayscale ? "translate-x-7" : "translate-x-0.5"}`} />
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600 font-medium">
            ⚠️ {error}
          </div>
        )}

        {/* Validation */}
        <button
          suppressHydrationWarning
          disabled={pages.length === 0 || submitting}
          onClick={handleFinish}
          className={`mt-auto w-full py-4 rounded-2xl font-bold text-lg transition-all duration-200
            ${pages.length > 0 && !submitting
              ? "bg-primary text-white shadow-lg shadow-primary/30 active:scale-[0.98]"
              : "bg-neutral-dark/10 text-neutral-dark/30 cursor-not-allowed"
            }`}
        >
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Assemblage...
            </span>
          ) : pages.length > 0 ? (
            `Continuer avec ${pages.length} page${pages.length > 1 ? "s" : ""} →`
          ) : (
            "Ajoutez au moins une page"
          )}
        </button>
      </div>
    </div>
  );
}
