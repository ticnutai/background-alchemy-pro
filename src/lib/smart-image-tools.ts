/**
 * Smart Image Tools — Non-AI, pure Canvas/algorithm-based image processing
 * No external AI APIs needed. Runs 100% in the browser.
 */

// ─── Color Utilities ──────────────────────────────────────────────
export interface RGBA { r: number; g: number; b: number; a: number }
export interface HSL  { h: number; s: number; l: number }

function rgbToHsl(r: number, g: number, b: number): HSL {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return { h: h * 360, s, l };
}

function colorDistance(c1: RGBA, c2: RGBA): number {
  return Math.sqrt(
    (c1.r - c2.r) ** 2 +
    (c1.g - c2.g) ** 2 +
    (c1.b - c2.b) ** 2
  );
}

// ─── Image → Canvas Helper ──────────────────────────────────────
function imageToCanvas(img: HTMLImageElement): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  return { canvas, ctx };
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function canvasToDataUrl(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL('image/png');
}

// ─── 1. Color-Based Background Removal (Chromakey) ─────────────
/**
 * Removes background by color similarity. Samples the dominant edge color
 * and makes all similar pixels transparent. Pure canvas, zero AI.
 */
export async function colorBasedRemoveBg(
  imageSrc: string,
  options: { tolerance?: number; edgeSoftness?: number; sampleEdgePixels?: boolean } = {}
): Promise<string> {
  const { tolerance = 30, edgeSoftness = 2, sampleEdgePixels = true } = options;
  const img = await loadImage(imageSrc);
  const { canvas, ctx } = imageToCanvas(img);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  // Sample the dominant background color from edges
  const bgColor = sampleEdgePixels
    ? sampleDominantEdgeColor(data, canvas.width, canvas.height)
    : { r: data[0], g: data[1], b: data[2], a: 255 };

  for (let i = 0; i < data.length; i += 4) {
    const pixel: RGBA = { r: data[i], g: data[i + 1], b: data[i + 2], a: data[i + 3] };
    const dist = colorDistance(pixel, bgColor);

    if (dist < tolerance) {
      data[i + 3] = 0; // fully transparent
    } else if (dist < tolerance + edgeSoftness * 10) {
      // soft edge feathering
      const ratio = (dist - tolerance) / (edgeSoftness * 10);
      data[i + 3] = Math.round(255 * ratio);
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvasToDataUrl(canvas);
}

function sampleDominantEdgeColor(data: Uint8ClampedArray, w: number, h: number): RGBA {
  const colors: RGBA[] = [];
  const sample = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    colors.push({ r: data[i], g: data[i + 1], b: data[i + 2], a: data[i + 3] });
  };
  // Sample top, bottom, left, right edges
  for (let x = 0; x < w; x += Math.max(1, Math.floor(w / 50))) {
    sample(x, 0);
    sample(x, h - 1);
  }
  for (let y = 0; y < h; y += Math.max(1, Math.floor(h / 50))) {
    sample(0, y);
    sample(w - 1, y);
  }
  // Average
  const avg = colors.reduce(
    (acc, c) => ({ r: acc.r + c.r, g: acc.g + c.g, b: acc.b + c.b, a: 255 }),
    { r: 0, g: 0, b: 0, a: 255 }
  );
  const n = colors.length;
  return { r: Math.round(avg.r / n), g: Math.round(avg.g / n), b: Math.round(avg.b / n), a: 255 };
}

// ─── 2. Magic Wand Selection ─────────────────────────────────────
/**
 * Flood-fill based selection from a click point. Returns a mask or can
 * remove the selected region making it transparent.
 */
export async function magicWandRemove(
  imageSrc: string,
  startX: number,
  startY: number,
  options: { tolerance?: number; contiguous?: boolean } = {}
): Promise<string> {
  const { tolerance = 25, contiguous = true } = options;
  const img = await loadImage(imageSrc);
  const { canvas, ctx } = imageToCanvas(img);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const w = canvas.width, h = canvas.height;

  const idx = (startY * w + startX) * 4;
  const target: RGBA = { r: data[idx], g: data[idx + 1], b: data[idx + 2], a: data[idx + 3] };
  const visited = new Uint8Array(w * h);

  if (contiguous) {
    // BFS flood fill
    const queue: [number, number][] = [[startX, startY]];
    visited[startY * w + startX] = 1;

    while (queue.length > 0) {
      const [cx, cy] = queue.shift()!;
      const ci = (cy * w + cx) * 4;
      const pixel: RGBA = { r: data[ci], g: data[ci + 1], b: data[ci + 2], a: data[ci + 3] };

      if (colorDistance(pixel, target) <= tolerance) {
        data[ci + 3] = 0; // make transparent
        const neighbors: [number, number][] = [[cx - 1, cy], [cx + 1, cy], [cx, cy - 1], [cx, cy + 1]];
        for (const [nx, ny] of neighbors) {
          if (nx >= 0 && nx < w && ny >= 0 && ny < h && !visited[ny * w + nx]) {
            visited[ny * w + nx] = 1;
            queue.push([nx, ny]);
          }
        }
      }
    }
  } else {
    // Global: remove all pixels matching the target color
    for (let i = 0; i < data.length; i += 4) {
      const pixel: RGBA = { r: data[i], g: data[i + 1], b: data[i + 2], a: data[i + 3] };
      if (colorDistance(pixel, target) <= tolerance) {
        data[i + 3] = 0;
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvasToDataUrl(canvas);
}

// ─── 3. Auto-Trim Transparency ──────────────────────────────────
/**
 * Detects transparent areas and crops to content bounds.
 */
export async function autoTrimTransparency(
  imageSrc: string,
  options: { padding?: number } = {}
): Promise<string> {
  const { padding = 10 } = options;
  const img = await loadImage(imageSrc);
  const { canvas, ctx } = imageToCanvas(img);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const w = canvas.width, h = canvas.height;

  let top = h, left = w, bottom = 0, right = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 10) {
        if (y < top) top = y;
        if (y > bottom) bottom = y;
        if (x < left) left = x;
        if (x > right) right = x;
      }
    }
  }

  if (bottom <= top || right <= left) return imageSrc; // nothing to trim

  const cropX = Math.max(0, left - padding);
  const cropY = Math.max(0, top - padding);
  const cropW = Math.min(w, right - left + 1 + padding * 2);
  const cropH = Math.min(h, bottom - top + 1 + padding * 2);

  const trimmed = document.createElement('canvas');
  trimmed.width = cropW;
  trimmed.height = cropH;
  trimmed.getContext('2d')!.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
  return canvasToDataUrl(trimmed);
}

// ─── 4. Drop Shadow ─────────────────────────────────────────────
/**
 * Adds a natural-looking drop shadow to a transparent-background image.
 */
export async function addDropShadow(
  imageSrc: string,
  options: { offsetX?: number; offsetY?: number; blur?: number; color?: string } = {}
): Promise<string> {
  const { offsetX = 4, offsetY = 8, blur = 15, color = 'rgba(0,0,0,0.35)' } = options;
  const img = await loadImage(imageSrc);
  const pad = blur * 2 + Math.max(Math.abs(offsetX), Math.abs(offsetY));
  const canvas = document.createElement('canvas');
  canvas.width = img.width + pad * 2;
  canvas.height = img.height + pad * 2;
  const ctx = canvas.getContext('2d')!;

  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  ctx.shadowOffsetX = offsetX;
  ctx.shadowOffsetY = offsetY;
  ctx.drawImage(img, pad, pad);

  // Draw original image on top (shadow is behind)
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  ctx.drawImage(img, pad, pad);

  return canvasToDataUrl(canvas);
}

// ─── 5. Color Palette Extraction ────────────────────────────────
/**
 * Extracts top N dominant colors from an image using K-means-like clustering.
 */
export async function extractColorPalette(
  imageSrc: string,
  options: { count?: number } = {}
): Promise<string[]> {
  const { count = 6 } = options;
  const img = await loadImage(imageSrc);
  const canvas = document.createElement('canvas');
  // Downscale for speed
  const scale = Math.min(1, 100 / Math.max(img.width, img.height));
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

  // Collect pixels (skip transparent)
  const pixels: RGBA[] = [];
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] > 128) {
      pixels.push({ r: data[i], g: data[i + 1], b: data[i + 2], a: 255 });
    }
  }

  if (pixels.length === 0) return ['#ffffff'];

  // Simple K-means clustering
  const centers: RGBA[] = [];
  for (let i = 0; i < count; i++) {
    centers.push(pixels[Math.floor(Math.random() * pixels.length)]);
  }

  for (let iter = 0; iter < 10; iter++) {
    const clusters: RGBA[][] = centers.map(() => []);
    for (const p of pixels) {
      let minDist = Infinity, minIdx = 0;
      for (let c = 0; c < centers.length; c++) {
        const d = colorDistance(p, centers[c]);
        if (d < minDist) { minDist = d; minIdx = c; }
      }
      clusters[minIdx].push(p);
    }
    for (let c = 0; c < centers.length; c++) {
      if (clusters[c].length === 0) continue;
      const avg = clusters[c].reduce(
        (acc, p) => ({ r: acc.r + p.r, g: acc.g + p.g, b: acc.b + p.b, a: 255 }),
        { r: 0, g: 0, b: 0, a: 255 }
      );
      const n = clusters[c].length;
      centers[c] = { r: Math.round(avg.r / n), g: Math.round(avg.g / n), b: Math.round(avg.b / n), a: 255 };
    }
  }

  // Sort by frequency (largest cluster first)
  const sorted = centers
    .map((c, i) => ({ color: c, count: pixels.filter(p => colorDistance(p, c) < 50).length }))
    .sort((a, b) => b.count - a.count);

  return sorted.map(({ color }) =>
    `#${color.r.toString(16).padStart(2, '0')}${color.g.toString(16).padStart(2, '0')}${color.b.toString(16).padStart(2, '0')}`
  );
}

// ─── 6. Image Compositing (Product + Background) ───────────────
/**
 * Composites a foreground (transparent bg) over a background image,
 * centering and scaling the product to fit.
 */
export async function compositeImages(
  foregroundSrc: string,
  backgroundSrc: string,
  options: { scale?: number; positionX?: number; positionY?: number; fitMode?: 'contain' | 'cover' } = {}
): Promise<string> {
  const { scale = 0.7, positionX = 0.5, positionY = 0.55, fitMode = 'contain' } = options;
  const [fg, bg] = await Promise.all([loadImage(foregroundSrc), loadImage(backgroundSrc)]);
  const canvas = document.createElement('canvas');
  canvas.width = bg.width;
  canvas.height = bg.height;
  const ctx = canvas.getContext('2d')!;

  // Draw background
  ctx.drawImage(bg, 0, 0);

  // Calculate foreground size
  const maxW = canvas.width * scale;
  const maxH = canvas.height * scale;
  let fgW: number, fgH: number;
  if (fitMode === 'contain') {
    const ratio = Math.min(maxW / fg.width, maxH / fg.height);
    fgW = fg.width * ratio;
    fgH = fg.height * ratio;
  } else {
    const ratio = Math.max(maxW / fg.width, maxH / fg.height);
    fgW = fg.width * ratio;
    fgH = fg.height * ratio;
  }

  const x = (canvas.width - fgW) * positionX;
  const y = (canvas.height - fgH) * positionY;
  ctx.drawImage(fg, x, y, fgW, fgH);

  return canvasToDataUrl(canvas);
}

// ─── 7. Brightness / Contrast / Saturation ──────────────────────
/**
 * Canvas-based color adjustments. No filters API needed.
 */
export async function adjustImage(
  imageSrc: string,
  options: { brightness?: number; contrast?: number; saturation?: number } = {}
): Promise<string> {
  const { brightness = 0, contrast = 0, saturation = 0 } = options;
  const img = await loadImage(imageSrc);
  const { canvas, ctx } = imageToCanvas(img);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  const contrastFactor = (259 * (contrast + 255)) / (255 * (259 - contrast));

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i], g = data[i + 1], b = data[i + 2];

    // Brightness
    r += brightness; g += brightness; b += brightness;

    // Contrast
    r = contrastFactor * (r - 128) + 128;
    g = contrastFactor * (g - 128) + 128;
    b = contrastFactor * (b - 128) + 128;

    // Saturation
    if (saturation !== 0) {
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      const sat = 1 + saturation / 100;
      r = gray + sat * (r - gray);
      g = gray + sat * (g - gray);
      b = gray + sat * (b - gray);
    }

    data[i] = Math.max(0, Math.min(255, Math.round(r)));
    data[i + 1] = Math.max(0, Math.min(255, Math.round(g)));
    data[i + 2] = Math.max(0, Math.min(255, Math.round(b)));
  }

  ctx.putImageData(imageData, 0, 0);
  return canvasToDataUrl(canvas);
}

// ─── 8. Smart Auto-Enhance ─────────────────────────────────────
/**
 * Auto-levels: stretches histogram to full range. Makes product photos pop.
 */
export async function autoEnhance(imageSrc: string): Promise<string> {
  const img = await loadImage(imageSrc);
  const { canvas, ctx } = imageToCanvas(img);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  let minR = 255, maxR = 0, minG = 255, maxG = 0, minB = 255, maxB = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue; // skip transparent
    minR = Math.min(minR, data[i]);     maxR = Math.max(maxR, data[i]);
    minG = Math.min(minG, data[i + 1]); maxG = Math.max(maxG, data[i + 1]);
    minB = Math.min(minB, data[i + 2]); maxB = Math.max(maxB, data[i + 2]);
  }

  const rangeR = maxR - minR || 1;
  const rangeG = maxG - minG || 1;
  const rangeB = maxB - minB || 1;

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    data[i]     = Math.round(((data[i] - minR) / rangeR) * 255);
    data[i + 1] = Math.round(((data[i + 1] - minG) / rangeG) * 255);
    data[i + 2] = Math.round(((data[i + 2] - minB) / rangeB) * 255);
  }

  ctx.putImageData(imageData, 0, 0);
  return canvasToDataUrl(canvas);
}

// ─── 9. Vignette Effect ─────────────────────────────────────────
export async function addVignette(
  imageSrc: string,
  options: { intensity?: number } = {}
): Promise<string> {
  const { intensity = 0.4 } = options;
  const img = await loadImage(imageSrc);
  const { canvas, ctx } = imageToCanvas(img);
  const cx = canvas.width / 2, cy = canvas.height / 2;
  const radius = Math.sqrt(cx * cx + cy * cy);
  const gradient = ctx.createRadialGradient(cx, cy, radius * 0.3, cx, cy, radius);
  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(1, `rgba(0,0,0,${intensity})`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  return canvasToDataUrl(canvas);
}

// ─── 10. Sharpen ─────────────────────────────────────────────────
export async function sharpenImage(
  imageSrc: string,
  options: { amount?: number } = {}
): Promise<string> {
  const { amount = 1 } = options;
  const img = await loadImage(imageSrc);
  const { canvas, ctx } = imageToCanvas(img);
  const w = canvas.width, h = canvas.height;
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;
  const copy = new Uint8ClampedArray(data);

  // Unsharp mask kernel
  const kernel = [
    0, -amount, 0,
    -amount, 1 + 4 * amount, -amount,
    0, -amount, 0
  ];

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      for (let c = 0; c < 3; c++) {
        let val = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            val += copy[((y + ky) * w + (x + kx)) * 4 + c] * kernel[(ky + 1) * 3 + (kx + 1)];
          }
        }
        data[(y * w + x) * 4 + c] = Math.max(0, Math.min(255, Math.round(val)));
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvasToDataUrl(canvas);
}

// ─── 11. Collage Layout Engine ──────────────────────────────────
export type CollageLayout = 'grid-2x2' | 'grid-3x3' | 'masonry' | 'hero-side' | 'strip' | 'pinterest';

export interface CollageTextOverlay {
  id: string;
  text: string;
  x: number; // 0-1 ratio
  y: number; // 0-1 ratio
  fontSize: number;
  fontFamily: string;
  fontWeight: 'normal' | 'bold' | 'black';
  color: string;
  align: 'right' | 'center' | 'left';
  opacity: number;
  rotation: number;
  shadow?: { color: string; blur: number; offsetX: number; offsetY: number };
  stroke?: { color: string; width: number };
  gradient?: { from: string; to: string; angle: number };
  letterSpacing?: number;
}

export type FrameStyle = 'none' | 'thin-gold' | 'double-gold' | 'luxury-dark' | 'ornate-corners' | 'shadow-float' | 'neon-glow' | 'vintage-border' | 'marble-edge';

export interface CollageWatermark {
  type: 'text' | 'image';
  text?: string;
  imageSrc?: string;
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
  opacity: number;
  scale: number; // 0.05 - 0.5
  fontFamily?: string;
  fontSize?: number;
  color?: string;
  rotation?: number;
  repeat?: boolean;
}

export interface CollageOptions {
  layout: CollageLayout;
  width: number;
  height: number;
  gap: number;
  bgColor: string;
  borderRadius: number;
  fitMode?: 'cover' | 'contain';
  frameStyle?: FrameStyle;
  textOverlays?: CollageTextOverlay[];
  bgGradient?: { from: string; to: string; angle: number };
  cellBgColors?: (string | null)[];
  watermark?: CollageWatermark;
}

const COLLAGE_FONT_MAP: Record<string, string> = {
  'elegant-serif': '"Playfair Display", "Georgia", serif',
  'modern-sans': '"Montserrat", "Helvetica Neue", sans-serif',
  'classic-serif': '"Cormorant Garamond", "Times New Roman", serif',
  'bold-display': '"Oswald", "Impact", sans-serif',
  'handwritten': '"Dancing Script", cursive',
  'luxury': '"Cinzel", "Trajan", serif',
  'hebrew-classic': '"Frank Ruhl Libre", "David", serif',
  'hebrew-modern': '"Heebo", "Arial", sans-serif',
  'hebrew-display': '"Rubik", sans-serif',
  'hebrew-elegant': '"Assistant", sans-serif',
  'mono': '"JetBrains Mono", monospace',
};

function drawFrameOnCell(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  style: FrameStyle
) {
  ctx.save();
  switch (style) {
    case 'thin-gold': {
      ctx.strokeStyle = '#c9a84c';
      ctx.lineWidth = 3;
      ctx.strokeRect(x + 4, y + 4, w - 8, h - 8);
      break;
    }
    case 'double-gold': {
      ctx.strokeStyle = '#c9a84c';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 3, y + 3, w - 6, h - 6);
      ctx.strokeRect(x + 8, y + 8, w - 16, h - 16);
      break;
    }
    case 'luxury-dark': {
      ctx.strokeStyle = '#1a1a2e';
      ctx.lineWidth = 6;
      ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);
      ctx.strokeStyle = '#c9a84c';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 8, y + 8, w - 16, h - 16);
      break;
    }
    case 'ornate-corners': {
      const cs = Math.min(w, h) * 0.12;
      ctx.strokeStyle = '#c9a84c';
      ctx.lineWidth = 2;
      // Top-left
      ctx.beginPath(); ctx.moveTo(x + 4, y + cs + 4); ctx.lineTo(x + 4, y + 4); ctx.lineTo(x + cs + 4, y + 4); ctx.stroke();
      // Top-right
      ctx.beginPath(); ctx.moveTo(x + w - cs - 4, y + 4); ctx.lineTo(x + w - 4, y + 4); ctx.lineTo(x + w - 4, y + cs + 4); ctx.stroke();
      // Bottom-right
      ctx.beginPath(); ctx.moveTo(x + w - 4, y + h - cs - 4); ctx.lineTo(x + w - 4, y + h - 4); ctx.lineTo(x + w - cs - 4, y + h - 4); ctx.stroke();
      // Bottom-left
      ctx.beginPath(); ctx.moveTo(x + cs + 4, y + h - 4); ctx.lineTo(x + 4, y + h - 4); ctx.lineTo(x + 4, y + h - cs - 4); ctx.stroke();
      break;
    }
    case 'shadow-float': {
      ctx.shadowColor = 'rgba(0,0,0,0.4)';
      ctx.shadowBlur = 20;
      ctx.shadowOffsetX = 6;
      ctx.shadowOffsetY = 6;
      ctx.fillStyle = 'rgba(0,0,0,0)';
      ctx.fillRect(x, y, w, h);
      break;
    }
    case 'neon-glow': {
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 15;
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 3, y + 3, w - 6, h - 6);
      ctx.shadowBlur = 0;
      break;
    }
    case 'vintage-border': {
      ctx.strokeStyle = '#8b7355';
      ctx.lineWidth = 4;
      ctx.setLineDash([12, 4]);
      ctx.strokeRect(x + 5, y + 5, w - 10, h - 10);
      ctx.setLineDash([]);
      break;
    }
    case 'marble-edge': {
      const grad = ctx.createLinearGradient(x, y, x + w, y + h);
      grad.addColorStop(0, '#e8e0d4');
      grad.addColorStop(0.5, '#c9a84c');
      grad.addColorStop(1, '#e8e0d4');
      ctx.strokeStyle = grad;
      ctx.lineWidth = 5;
      ctx.strokeRect(x + 3, y + 3, w - 6, h - 6);
      break;
    }
  }
  ctx.restore();
}

function drawCollageTextOverlay(
  ctx: CanvasRenderingContext2D,
  overlay: CollageTextOverlay,
  canvasW: number,
  canvasH: number
) {
  ctx.save();
  const px = overlay.x * canvasW;
  const py = overlay.y * canvasH;
  const fontSize = overlay.fontSize;
  const fontFace = COLLAGE_FONT_MAP[overlay.fontFamily] || COLLAGE_FONT_MAP['hebrew-modern'];
  const weight = overlay.fontWeight === 'black' ? '900' : overlay.fontWeight === 'bold' ? '700' : '400';

  ctx.globalAlpha = overlay.opacity;
  ctx.font = `${weight} ${fontSize}px ${fontFace}`;
  ctx.textAlign = overlay.align;
  ctx.textBaseline = 'middle';

  if (overlay.rotation) {
    ctx.translate(px, py);
    ctx.rotate((overlay.rotation * Math.PI) / 180);
    ctx.translate(-px, -py);
  }

  // Shadow
  if (overlay.shadow) {
    ctx.shadowColor = overlay.shadow.color;
    ctx.shadowBlur = overlay.shadow.blur;
    ctx.shadowOffsetX = overlay.shadow.offsetX;
    ctx.shadowOffsetY = overlay.shadow.offsetY;
  }

  // Gradient or solid fill
  if (overlay.gradient) {
    const angle = (overlay.gradient.angle * Math.PI) / 180;
    const len = fontSize * overlay.text.length * 0.3;
    const gx = px - Math.cos(angle) * len;
    const gy = py - Math.sin(angle) * len;
    const gx2 = px + Math.cos(angle) * len;
    const gy2 = py + Math.sin(angle) * len;
    const grad = ctx.createLinearGradient(gx, gy, gx2, gy2);
    grad.addColorStop(0, overlay.gradient.from);
    grad.addColorStop(1, overlay.gradient.to);
    ctx.fillStyle = grad;
  } else {
    ctx.fillStyle = overlay.color;
  }

  // Stroke
  if (overlay.stroke) {
    ctx.strokeStyle = overlay.stroke.color;
    ctx.lineWidth = overlay.stroke.width;
    ctx.lineJoin = 'round';
    ctx.strokeText(overlay.text, px, py);
  }

  ctx.fillText(overlay.text, px, py);
  ctx.restore();
}

export async function generateCollage(
  images: string[],
  options: CollageOptions
): Promise<string> {
  const { layout, width, height, gap, bgColor, borderRadius, fitMode = 'contain', frameStyle = 'none', textOverlays = [], bgGradient, cellBgColors = [] } = options;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // Background — gradient or solid
  if (bgGradient) {
    const angle = (bgGradient.angle * Math.PI) / 180;
    const cx = width / 2, cy = height / 2;
    const len = Math.max(width, height);
    const grad = ctx.createLinearGradient(
      cx - Math.cos(angle) * len / 2, cy - Math.sin(angle) * len / 2,
      cx + Math.cos(angle) * len / 2, cy + Math.sin(angle) * len / 2
    );
    grad.addColorStop(0, bgGradient.from);
    grad.addColorStop(1, bgGradient.to);
    ctx.fillStyle = grad;
  } else {
    ctx.fillStyle = bgColor;
  }
  ctx.fillRect(0, 0, width, height);

  const loadedImages = await Promise.all(images.slice(0, getMaxImages(layout)).map(loadImage));
  const cells = getCells(layout, width, height, gap, loadedImages.length);

  for (let i = 0; i < Math.min(loadedImages.length, cells.length); i++) {
    const cell = cells[i];
    const img = loadedImages[i];

    ctx.save();
    if (borderRadius > 0) {
      roundedClip(ctx, cell.x, cell.y, cell.w, cell.h, borderRadius);
    }

    if (fitMode === 'contain') {
      const cellBg = cellBgColors[i] || bgColor;
      ctx.fillStyle = cellBg;
      ctx.fillRect(cell.x, cell.y, cell.w, cell.h);
      const imgRatio = img.width / img.height;
      const cellRatio = cell.w / cell.h;
      let dw: number, dh: number;
      if (imgRatio > cellRatio) {
        dw = cell.w;
        dh = cell.w / imgRatio;
      } else {
        dh = cell.h;
        dw = cell.h * imgRatio;
      }
      const dx = cell.x + (cell.w - dw) / 2;
      const dy = cell.y + (cell.h - dh) / 2;
      ctx.drawImage(img, 0, 0, img.width, img.height, dx, dy, dw, dh);
    } else {
      const imgRatio = img.width / img.height;
      const cellRatio = cell.w / cell.h;
      let sx = 0, sy = 0, sw = img.width, sh = img.height;
      if (imgRatio > cellRatio) {
        sw = img.height * cellRatio;
        sx = (img.width - sw) / 2;
      } else {
        sh = img.width / cellRatio;
        sy = (img.height - sh) / 2;
      }
      ctx.drawImage(img, sx, sy, sw, sh, cell.x, cell.y, cell.w, cell.h);
    }
    ctx.restore();

    // Frame on each cell
    if (frameStyle && frameStyle !== 'none') {
      drawFrameOnCell(ctx, cell.x, cell.y, cell.w, cell.h, frameStyle);
    }
  }

  // Text overlays
  for (const overlay of textOverlays) {
    drawCollageTextOverlay(ctx, overlay, width, height);
  }

  return canvasToDataUrl(canvas);
}

function getMaxImages(layout: CollageLayout): number {
  switch (layout) {
    case 'grid-2x2': return 4;
    case 'grid-3x3': return 9;
    case 'masonry': return 6;
    case 'hero-side': return 3;
    case 'strip': return 5;
    case 'pinterest': return 6;
    default: return 9;
  }
}

interface Cell { x: number; y: number; w: number; h: number }

function getCells(layout: CollageLayout, W: number, H: number, gap: number, count: number): Cell[] {
  const cells: Cell[] = [];

  switch (layout) {
    case 'grid-2x2': {
      const cols = 2, rows = 2;
      const cw = (W - gap * (cols + 1)) / cols;
      const ch = (H - gap * (rows + 1)) / rows;
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++)
          cells.push({ x: gap + c * (cw + gap), y: gap + r * (ch + gap), w: cw, h: ch });
      break;
    }
    case 'grid-3x3': {
      const cols = 3, rows = 3;
      const cw = (W - gap * (cols + 1)) / cols;
      const ch = (H - gap * (rows + 1)) / rows;
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++)
          cells.push({ x: gap + c * (cw + gap), y: gap + r * (ch + gap), w: cw, h: ch });
      break;
    }
    case 'hero-side': {
      // Large hero left + two stacked right
      const heroW = W * 0.6 - gap * 1.5;
      const sideW = W * 0.4 - gap * 1.5;
      cells.push({ x: gap, y: gap, w: heroW, h: H - gap * 2 });
      const sideH = (H - gap * 3) / 2;
      cells.push({ x: heroW + gap * 2, y: gap, w: sideW, h: sideH });
      cells.push({ x: heroW + gap * 2, y: sideH + gap * 2, w: sideW, h: sideH });
      break;
    }
    case 'strip': {
      const n = Math.min(count, 5);
      const cw = (W - gap * (n + 1)) / n;
      for (let i = 0; i < n; i++)
        cells.push({ x: gap + i * (cw + gap), y: gap, w: cw, h: H - gap * 2 });
      break;
    }
    case 'masonry': {
      // Pinterest-like staggered layout
      const cols = 3;
      const colW = (W - gap * (cols + 1)) / cols;
      const colHeights = new Array(cols).fill(gap);
      for (let i = 0; i < Math.min(count, 6); i++) {
        const col = colHeights.indexOf(Math.min(...colHeights));
        const cellH = colW * (0.8 + Math.random() * 0.6); // varied heights
        cells.push({ x: gap + col * (colW + gap), y: colHeights[col], w: colW, h: cellH });
        colHeights[col] += cellH + gap;
      }
      break;
    }
    case 'pinterest': {
      const cols = 2;
      const colW = (W - gap * (cols + 1)) / cols;
      const colHeights = new Array(cols).fill(gap);
      for (let i = 0; i < Math.min(count, 6); i++) {
        const col = colHeights.indexOf(Math.min(...colHeights));
        const cellH = colW * (1.0 + Math.random() * 0.5);
        cells.push({ x: gap + col * (colW + gap), y: colHeights[col], w: colW, h: cellH });
        colHeights[col] += cellH + gap;
      }
      break;
    }
  }

  return cells;
}

function roundedClip(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.clip();
}

// ─── 12. White Background Removal ──────────────────────────────
/**
 * Specifically optimized for white/light backgrounds (e-commerce product photos).
 * Uses luminance threshold instead of color distance.
 */
export async function removeWhiteBg(
  imageSrc: string,
  options: { threshold?: number; feather?: number } = {}
): Promise<string> {
  const { threshold = 240, feather = 15 } = options;
  const img = await loadImage(imageSrc);
  const { canvas, ctx } = imageToCanvas(img);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
    const saturation = (Math.max(r, g, b) - Math.min(r, g, b)) / 255;

    if (luminance > threshold && saturation < 0.15) {
      data[i + 3] = 0;
    } else if (luminance > threshold - feather && saturation < 0.25) {
      const ratio = (threshold - luminance) / feather;
      data[i + 3] = Math.round(255 * Math.max(0, Math.min(1, ratio)));
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvasToDataUrl(canvas);
}
