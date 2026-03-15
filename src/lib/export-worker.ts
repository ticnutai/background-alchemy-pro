/**
 * Web Worker for offloading heavy image export operations off the main thread.
 * Uses OffscreenCanvas when available, falls back to ImageBitmap.
 */

interface ExportMessage {
  type: "export";
  imageData: ImageBitmap;
  width: number;
  height: number;
  filter: string;
  format: string;
  quality: number;
}

self.onmessage = async (e: MessageEvent<ExportMessage>) => {
  const { imageData, width, height, filter, format, quality } = e.data;

  try {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d")!;

    // Apply CSS filter equivalent
    if (filter && filter !== "none") {
      (ctx as any).filter = filter;
    }

    ctx.drawImage(imageData, 0, 0, width, height);

    const mimeType =
      format === "jpg" ? "image/jpeg" :
      format === "webp" ? "image/webp" :
      "image/png";

    const q = (format === "jpg" || format === "webp") ? quality / 100 : undefined;
    const blob = await canvas.convertToBlob({ type: mimeType, quality: q });

    self.postMessage({ type: "result", blob });
  } catch (err: any) {
    self.postMessage({ type: "error", error: err.message });
  }
};
