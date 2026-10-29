// Fotos beim Speichern verkleinern (SPEC.md, Abschnitt 2): max. 1024 px Kantenlänge, JPEG 0,7
const MAX_EDGE = 1024;
const JPEG_QUALITY = 0.7;

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Das Bild konnte nicht gelesen werden.'));
    };
    img.src = url;
  });
}

export async function resizePhoto(file) {
  // Safari dreht das Bild beim Laden selbst richtig herum (EXIF-Ausrichtung)
  const img = await loadImage(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.round(img.naturalWidth * scale);
  const height = Math.round(img.naturalHeight * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').drawImage(img, 0, 0, width, height);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Bild konnte nicht gespeichert werden.'))), 'image/jpeg', JPEG_QUALITY);
  });
}

// Objekt-URLs für gespeicherte Fotos, einmal pro Blob
const urls = new WeakMap();

export function photoUrl(blob) {
  if (!blob) return null;
  if (!urls.has(blob)) urls.set(blob, URL.createObjectURL(blob));
  return urls.get(blob);
}
