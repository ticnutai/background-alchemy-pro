/**
 * PDF utilities: extract pages as images, and rebuild PDF from processed images.
 */
import * as pdfjsLib from "pdfjs-dist";
import jsPDF from "jspdf";

// Configure worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs`;

export interface PdfPage {
  pageNumber: number;
  dataUrl: string; // base64 PNG
  width: number;
  height: number;
}

/**
 * Extract all pages from a PDF file as PNG data URLs.
 */
export async function extractPdfPages(
  file: File,
  scale = 2,
  onProgress?: (current: number, total: number) => void,
): Promise<PdfPage[]> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const totalPages = pdf.numPages;
  const pages: PdfPage[] = [];

  for (let i = 1; i <= totalPages; i++) {
    onProgress?.(i, totalPages);
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d")!;

    await page.render({ canvasContext: ctx, viewport }).promise;

    pages.push({
      pageNumber: i,
      dataUrl: canvas.toDataURL("image/png"),
      width: viewport.width,
      height: viewport.height,
    });

    // Cleanup
    canvas.width = 0;
    canvas.height = 0;
  }

  return pages;
}

/**
 * Build a new PDF from an array of image data URLs.
 * Each image becomes one page, sized to fit.
 */
export function buildPdfFromImages(
  images: Array<{ dataUrl: string; width: number; height: number }>,
  fileName = "processed.pdf",
): Blob {
  if (images.length === 0) throw new Error("No images to build PDF");

  const first = images[0];
  const doc = new jsPDF({
    orientation: first.width > first.height ? "landscape" : "portrait",
    unit: "px",
    format: [first.width, first.height],
  });

  images.forEach((img, i) => {
    if (i > 0) {
      doc.addPage(
        [img.width, img.height],
        img.width > img.height ? "landscape" : "portrait",
      );
    }
    doc.addImage(img.dataUrl, "PNG", 0, 0, img.width, img.height);
  });

  return doc.output("blob");
}

/**
 * Download a blob as file.
 */
export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
