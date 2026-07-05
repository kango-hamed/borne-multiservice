/**
 * Compresse une image côté client à l'aide d'un Canvas HTML5
 * pour limiter l'utilisation de la bande passante mobile.
 */
export async function compressImage(file: File, maxWidth = 2048, quality = 0.8): Promise<File> {
  // Si ce n'est pas une image ou si elle fait moins de 2 Mo, on ne compresse pas
  if (!file.type.startsWith("image/") || file.size < 2 * 1024 * 1024) {
    return file;
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;

      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        // Redimensionnement proportionnel si supérieur au max
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(file); // Fallback au fichier d'origine si canvas non supporté
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Convertit le canvas en Blob (format JPEG pour une meilleure compression)
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(file);
              return;
            }

            // Génère un nouveau fichier compressé
            const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", {
              type: "image/jpeg",
              lastModified: Date.now(),
            });

            console.log(
              `Compression client : ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} Mo) ` +
              `-> (${(compressedFile.size / 1024 / 1024).toFixed(2)} Mo)`
            );

            resolve(compressedFile);
          },
          "image/jpeg",
          quality
        );
      };

      img.onerror = () => resolve(file);
    };

    reader.onerror = () => resolve(file);
  });
}

/**
 * Normalise une photo de page scannée en JPEG.
 *
 * Contrairement à `compressImage`, la conversion est TOUJOURS appliquée :
 * cela uniformise le format (une photo galerie peut être HEIC/PNG),
 * réduit le poids avant envoi sur réseau faible, et garantit que le
 * backend reçoit du JPEG décodable par Pillow.
 *
 * En cas d'échec (canvas non supporté, décodage impossible), on retombe
 * sur le fichier d'origine pour ne jamais bloquer le scan.
 */
export async function prepareScanImage(
  file: File,
  maxWidth = 2000,
  quality = 0.85
): Promise<File> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;

      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(file);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(file);
              return;
            }
            const baseName = file.name.replace(/\.[^/.]+$/, "") || "page";
            resolve(
              new File([blob], `${baseName}.jpg`, {
                type: "image/jpeg",
                lastModified: Date.now(),
              })
            );
          },
          "image/jpeg",
          quality
        );
      };

      img.onerror = () => resolve(file);
    };

    reader.onerror = () => resolve(file);
  });
}
