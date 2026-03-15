/**
 * Client-side image compression/resize utilities.
 * Reduces bandwidth before sending to edge functions.
 */

const MAX_DIMENSION = 2048;
const COMPRESSION_QUALITY = 0.85;

/**
 * Compress and resize an image to reduce size before API calls.
 * Converts to JPEG at 85% quality, max 2048px on longest side.
 * Returns base64 data URL.
 */
export function compressImage(
  base64: string,
  maxDimension = MAX_DIMENSION,
  quality = COMPRESSION_QUALITY,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { naturalWidth: w, naturalHeight: h } = img;

      // Only downscale if needed
      if (w > maxDimension || h > maxDimension) {
        const ratio = Math.min(maxDimension / w, maxDimension / h);
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
      }

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, w, h);

      // Detect if image has transparency (PNG with alpha)
      const hasAlpha = base64.includes("data:image/png");
      if (hasAlpha) {
        // Keep PNG for transparency but still resize
        resolve(canvas.toDataURL("image/png"));
      } else {
        resolve(canvas.toDataURL("image/jpeg", quality));
      }
    };
    img.onerror = () => reject(new Error("Failed to load image for compression"));
    img.src = base64;
  });
}

/**
 * Get the byte size of a base64 string (approximate).
 */
export function getBase64Size(base64: string): number {
  const padding = (base64.match(/=+$/) || [""])[0].length;
  return Math.floor((base64.length * 3) / 4) - padding;
}

/**
 * Format bytes to human readable string.
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
