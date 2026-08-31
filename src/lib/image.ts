/**
 * Turn a photo from a phone into something small enough to keep.
 *
 * On the demo backend every placement lives in localStorage, and the whole
 * database is serialised on each write against a 5 MB quota. A photo straight
 * off a phone camera is three to eight megabytes, so one upload would fill it
 * and the *next* write would fail — silently, taking somebody's finds with it.
 *
 * So the file never gets stored as-is. It is drawn into a canvas at a sane
 * width and re-encoded as JPEG, which lands around 40–80 kB. That is more than
 * enough for a card in a gallery, and it means a few dozen photos still fit.
 *
 * On a real Supabase backend this would go to object storage instead and the
 * column would hold a URL. The shape of the value is the same either way, so
 * only this function changes.
 */

/** Wide enough for a card on a retina screen, small enough to keep dozens. */
const MAX_WIDTH = 900;

/** Refuse anything that would be slow to decode before we even start. */
const MAX_INPUT_BYTES = 20 * 1024 * 1024;

/** A data URL over this is not worth keeping in a 5 MB store. */
const MAX_OUTPUT_BYTES = 250 * 1024;

export async function fileToCompressedDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('That file is not an image.');
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new Error('That photo is very large. Try one under 20 MB.');
  }

  const bitmap = await loadBitmap(file);

  const scale = Math.min(1, MAX_WIDTH / bitmap.width);
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not read that photo.');
  context.drawImage(bitmap as CanvasImageSource, 0, 0, width, height);

  // Step the quality down rather than failing outright on a busy photograph.
  for (const quality of [0.72, 0.6, 0.45]) {
    const url = canvas.toDataURL('image/jpeg', quality);
    if (url.length <= MAX_OUTPUT_BYTES) return url;
  }

  throw new Error('That photo is too detailed to store. Try a simpler one.');
}

/**
 * createImageBitmap where it exists, an <img> everywhere else.
 *
 * Safari only grew createImageBitmap recently and still trips over some HEIC
 * conversions, so the fallback is not academic.
 */
async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file);
    } catch {
      /* fall through to the <img> path */
    }
  }

  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Could not read that photo.'));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
