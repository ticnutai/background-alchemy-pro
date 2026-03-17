/**
 * Shared export utilities — used by Tool.tsx, Gallery.tsx, etc.
 * Centralises PDF generation, TIFF generation, and download helpers.
 */

// ─── Download helper ─────────────────────────────────────────
export function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadBlob(blob: Blob | string, filename: string, _mimeType?: string) {
  const url = typeof blob === "string" ? blob : URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  if (typeof blob !== "string") URL.revokeObjectURL(url);
}

// ─── Simple PDF (manual, no library) ─────────────────────────
export async function generateSimplePDF(
  imageDataUrl: string,
  w: number,
  h: number,
): Promise<Blob> {
  // Convert source to JPEG for DCTDecode
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const img = new Image();
  await new Promise<void>((resolve) => {
    img.onload = () => resolve();
    img.src = imageDataUrl;
  });
  ctx.drawImage(img, 0, 0);
  const jpegDataUrl = canvas.toDataURL("image/jpeg", 1.0);
  const jpegBase64 = jpegDataUrl.split(",")[1];
  const jpegBinary = atob(jpegBase64);
  const jpegBytes = new Uint8Array(jpegBinary.length);
  for (let i = 0; i < jpegBinary.length; i++) jpegBytes[i] = jpegBinary.charCodeAt(i);

  const scale = Math.min(575 / w, 822 / h);
  const pw = Math.round(w * scale);
  const ph = Math.round(h * scale);
  const pageW = Math.max(pw + 20, 595);
  const pageH = Math.max(ph + 20, 842);
  const xOff = Math.round((pageW - pw) / 2);
  const yOff = Math.round((pageH - ph) / 2);

  const stream = `q ${pw} 0 0 ${ph} ${xOff} ${yOff} cm /Img Do Q`;
  const realImgHeader = `5 0 obj\n<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`;
  const imgObjFooter = `\nendstream\nendobj\n`;

  const objects: string[] = [];
  objects.push(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`);
  objects.push(`2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n`);
  objects.push(`3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Contents 4 0 R /Resources << /XObject << /Img 5 0 R >> >> >>\nendobj\n`);
  objects.push(`4 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\n`);

  const header = `%PDF-1.4\n`;
  const body = objects.join("");

  const enc = new TextEncoder();
  const p1 = enc.encode(header + body + realImgHeader);
  const p2 = enc.encode(imgObjFooter);

  const xrefPos = p1.length + jpegBytes.length + p2.length;
  let xref = `xref\n0 6\n0000000000 65535 f \n`;
  let offset = header.length;
  for (const obj of objects) {
    xref += `${String(offset).padStart(10, "0")} 00000 n \n`;
    offset += obj.length;
  }
  xref += `${String(offset).padStart(10, "0")} 00000 n \n`;
  const trailer = `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;
  const p3 = enc.encode(xref + trailer);

  const final = new Uint8Array(p1.length + jpegBytes.length + p2.length + p3.length);
  final.set(p1, 0);
  final.set(jpegBytes, p1.length);
  final.set(p2, p1.length + jpegBytes.length);
  final.set(p3, p1.length + jpegBytes.length + p2.length);
  return new Blob([final], { type: "application/pdf" });
}

// ─── TIFF (uncompressed RGB) ─────────────────────────────────
export function generateTIFF(canvas: HTMLCanvasElement): Blob {
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext("2d")!;
  const imageData = ctx.getImageData(0, 0, w, h);
  const rgba = imageData.data;
  const rgb = new Uint8Array(w * h * 3);
  for (let i = 0, j = 0; i < rgba.length; i += 4, j += 3) {
    rgb[j] = rgba[i];
    rgb[j + 1] = rgba[i + 1];
    rgb[j + 2] = rgba[i + 2];
  }
  const stripSize = rgb.length;
  const headerSize = 8;
  const ifdEntryCount = 10;
  const ifdSize = 2 + ifdEntryCount * 12 + 4;
  const dataOffset = headerSize + ifdSize;

  const buf = new ArrayBuffer(dataOffset + stripSize);
  const view = new DataView(buf);
  const arr = new Uint8Array(buf);

  view.setUint16(0, 0x4949, false);
  view.setUint16(2, 42, true);
  view.setUint32(4, headerSize, true);

  let off = headerSize;
  view.setUint16(off, ifdEntryCount, true);
  off += 2;

  const writeIFD = (tag: number, type: number, count: number, value: number) => {
    view.setUint16(off, tag, true); off += 2;
    view.setUint16(off, type, true); off += 2;
    view.setUint32(off, count, true); off += 4;
    view.setUint32(off, value, true); off += 4;
  };

  writeIFD(256, 3, 1, w);
  writeIFD(257, 3, 1, h);
  writeIFD(258, 3, 3, 8 | (8 << 16));
  writeIFD(259, 3, 1, 1);
  writeIFD(262, 3, 1, 2);
  writeIFD(273, 4, 1, dataOffset);
  writeIFD(277, 3, 1, 3);
  writeIFD(278, 4, 1, h);
  writeIFD(279, 4, 1, stripSize);
  writeIFD(282, 5, 1, 0);

  view.setUint32(off, 0, true);
  arr.set(rgb, dataOffset);

  return new Blob([buf], { type: "image/tiff" });
}

// ─── Canvas to Blob ──────────────────────────────────────────
export function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Failed to create blob"))),
      type,
      quality,
    );
  });
}
