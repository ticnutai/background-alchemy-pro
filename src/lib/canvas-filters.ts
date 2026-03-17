/**
 * Pure client-side Canvas Filter Engine.
 * Applies pixel-level transformations without AI — runs entirely in browser.
 */

// ─── Types ───────────────────────────────────────────────────
export interface CanvasFilterOptions {
  brightness?: number;    // 0–200, default 100
  contrast?: number;      // 0–200, default 100
  saturation?: number;    // 0–300, default 100
  exposure?: number;      // -100 to 100, default 0
  highlights?: number;    // -100 to 100
  shadows?: number;       // -100 to 100
  warmth?: number;        // -50 to 50
  tint?: number;          // -50 to 50
  hue?: number;           // -180 to 180
  vibrance?: number;      // -100 to 100
  clarity?: number;       // -50 to 50
  sharpness?: number;     // 0–100
  grain?: number;         // 0–100
  vignette?: number;      // 0–100
  fade?: number;          // 0–60
  blackAndWhite?: number; // 0–100
  sepiaTone?: number;     // 0–100
  dehaze?: number;        // 0–100
  // Levels
  levelsBlack?: number;   // 0–100
  levelsWhite?: number;   // 155–255
  levelsMidtones?: number; // 0.1–4.0
  // Color Balance
  cbShadowsR?: number;   // -100 to 100
  cbShadowsG?: number;
  cbShadowsB?: number;
  cbMidtonesR?: number;
  cbMidtonesG?: number;
  cbMidtonesB?: number;
  cbHighlightsR?: number;
  cbHighlightsG?: number;
  cbHighlightsB?: number;
}

export const defaultCanvasFilters: CanvasFilterOptions = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  exposure: 0,
  highlights: 0,
  shadows: 0,
  warmth: 0,
  tint: 0,
  hue: 0,
  vibrance: 0,
  clarity: 0,
  sharpness: 0,
  grain: 0,
  vignette: 0,
  fade: 0,
  blackAndWhite: 0,
  sepiaTone: 0,
  dehaze: 0,
  levelsBlack: 0,
  levelsWhite: 255,
  levelsMidtones: 1.0,
  cbShadowsR: 0, cbShadowsG: 0, cbShadowsB: 0,
  cbMidtonesR: 0, cbMidtonesG: 0, cbMidtonesB: 0,
  cbHighlightsR: 0, cbHighlightsG: 0, cbHighlightsB: 0,
};

// ─── Helpers ─────────────────────────────────────────────────
function clamp(v: number, min = 0, max = 255): number {
  return v < min ? min : v > max ? max : v;
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) { const v = l * 255; return [v, v, v]; }
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    hue2rgb(p, q, h + 1 / 3) * 255,
    hue2rgb(p, q, h) * 255,
    hue2rgb(p, q, h - 1 / 3) * 255,
  ];
}

// ─── Core Engine ─────────────────────────────────────────────

/** Load a base64 image into an HTMLImageElement */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// ─── Web Worker Integration ─────────────────────────────────
let _filterWorker: Worker | null = null;

function getFilterWorker(): Worker | null {
  if (typeof Worker === "undefined") return null;
  if (!_filterWorker) {
    try {
      _filterWorker = new Worker(
        new URL("./filter-worker.ts", import.meta.url),
        { type: "module" },
      );
    } catch { return null; }
  }
  return _filterWorker;
}

function runPixelsInWorker(
  pixels: Uint8ClampedArray,
  w: number,
  h: number,
  options: CanvasFilterOptions,
): Promise<Uint8ClampedArray> {
  const worker = getFilterWorker();
  if (!worker) return Promise.reject(new Error("no worker"));
  return new Promise((resolve, reject) => {
    const copy = new Uint8ClampedArray(pixels);
    worker.onmessage = (e) => resolve(new Uint8ClampedArray(e.data.pixels));
    worker.onerror = reject;
    worker.postMessage(
      { pixels: copy, width: w, height: h, options },
      [copy.buffer] as unknown as Transferable[],
    );
  });
}

/**
 * Main-thread pixel processing fallback (same logic as filter-worker).
 */
function applyPixelFiltersMainThread(data: Uint8ClampedArray, options: CanvasFilterOptions) {
  const o = { ...defaultCanvasFilters, ...options };
  const brightnessLut = new Uint8Array(256);
  const contrastLut = new Uint8Array(256);
  const levelsLut = new Uint8Array(256);
  const brightFactor = (o.brightness! / 100);
  const expFactor = Math.pow(2, o.exposure! / 100);
  for (let i = 0; i < 256; i++) brightnessLut[i] = clamp(Math.round(i * brightFactor * expFactor));
  const contrastFactor = (o.contrast! - 100) / 100;
  const intercept = 128 * (1 - (1 + contrastFactor));
  for (let i = 0; i < 256; i++) contrastLut[i] = clamp(Math.round(i * (1 + contrastFactor) + intercept));
  const lBlack = o.levelsBlack!, lWhite = o.levelsWhite!, lMid = o.levelsMidtones!;
  const lRange = Math.max(lWhite - lBlack, 1);
  for (let i = 0; i < 256; i++) {
    let v = (i - lBlack) / lRange; v = Math.max(0, Math.min(1, v)); v = Math.pow(v, 1 / lMid);
    levelsLut[i] = clamp(Math.round(v * 255));
  }
  const dehazeContrast = 1 + (o.dehaze! * 0.005), dehazeSat = 1 + (o.dehaze! * 0.003);
  const fadeAmount = o.fade! / 100, satFactor = o.saturation! / 100, vibranceFactor = o.vibrance! / 100;
  const warmShift = o.warmth! * 1.5, tintShift = o.tint! * 1.2, hueShift = o.hue! / 360;
  const bwAmount = o.blackAndWhite! / 100, sepiaAmount = o.sepiaTone! / 100;
  const highlightFactor = o.highlights! / 100, shadowFactor = o.shadows! / 100;
  const cbSR = o.cbShadowsR! / 100, cbSG = o.cbShadowsG! / 100, cbSB = o.cbShadowsB! / 100;
  const cbMR = o.cbMidtonesR! / 100, cbMG = o.cbMidtonesG! / 100, cbMB = o.cbMidtonesB! / 100;
  const cbHR = o.cbHighlightsR! / 100, cbHG = o.cbHighlightsG! / 100, cbHB = o.cbHighlightsB! / 100;
  for (let i = 0; i < data.length; i += 4) {
    let r = data[i], g = data[i + 1], b = data[i + 2];
    r = brightnessLut[r]; g = brightnessLut[g]; b = brightnessLut[b];
    r = contrastLut[r]; g = contrastLut[g]; b = contrastLut[b];
    r = levelsLut[r]; g = levelsLut[g]; b = levelsLut[b];
    if (o.dehaze! > 0) {
      const avg = (r + g + b) / 3;
      r = clamp(Math.round((r - avg) * dehazeContrast + avg));
      g = clamp(Math.round((g - avg) * dehazeContrast + avg));
      b = clamp(Math.round((b - avg) * dehazeContrast + avg));
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      r = clamp(Math.round(gray + (r - gray) * dehazeSat));
      g = clamp(Math.round(gray + (g - gray) * dehazeSat));
      b = clamp(Math.round(gray + (b - gray) * dehazeSat));
    }
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    if (highlightFactor !== 0) { const w = lum * lum, s = highlightFactor * 80 * w; r = clamp(Math.round(r + s)); g = clamp(Math.round(g + s)); b = clamp(Math.round(b + s)); }
    if (shadowFactor !== 0) { const w = (1 - lum) * (1 - lum), s = shadowFactor * 80 * w; r = clamp(Math.round(r + s)); g = clamp(Math.round(g + s)); b = clamp(Math.round(b + s)); }
    const ln = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    const sw = Math.max(0, 1 - ln * 3), hw = Math.max(0, ln * 3 - 2), mw = 1 - sw - hw;
    r = clamp(Math.round(r + (cbSR * sw + cbMR * mw + cbHR * hw) * 50));
    g = clamp(Math.round(g + (cbSG * sw + cbMG * mw + cbHG * hw) * 50));
    b = clamp(Math.round(b + (cbSB * sw + cbMB * mw + cbHB * hw) * 50));
    if (warmShift !== 0) { r = clamp(Math.round(r + warmShift)); b = clamp(Math.round(b - warmShift * 0.7)); }
    if (tintShift !== 0) { g = clamp(Math.round(g + tintShift)); }
    // eslint-disable-next-line prefer-const
    let [h, s, l] = rgbToHsl(r, g, b);
    if (hueShift !== 0) h = (h + hueShift + 1) % 1;
    s = Math.max(0, Math.min(1, s * satFactor));
    if (vibranceFactor !== 0) { s = Math.max(0, Math.min(1, s + vibranceFactor * (1 - s) * 0.5)); }
    [r, g, b] = hslToRgb(h, s, l); r = Math.round(r); g = Math.round(g); b = Math.round(b);
    if (bwAmount > 0) { const gr = 0.299 * r + 0.587 * g + 0.114 * b; r = Math.round(r * (1 - bwAmount) + gr * bwAmount); g = Math.round(g * (1 - bwAmount) + gr * bwAmount); b = Math.round(b * (1 - bwAmount) + gr * bwAmount); }
    if (sepiaAmount > 0) { const sr2 = Math.min(255, r * 0.393 + g * 0.769 + b * 0.189), sg2 = Math.min(255, r * 0.349 + g * 0.686 + b * 0.168), sb2 = Math.min(255, r * 0.272 + g * 0.534 + b * 0.131); r = Math.round(r * (1 - sepiaAmount) + sr2 * sepiaAmount); g = Math.round(g * (1 - sepiaAmount) + sg2 * sepiaAmount); b = Math.round(b * (1 - sepiaAmount) + sb2 * sepiaAmount); }
    if (fadeAmount > 0) { const la = fadeAmount * 60; r = clamp(Math.round(r + la * (1 - r / 255))); g = clamp(Math.round(g + la * (1 - g / 255))); b = clamp(Math.round(b + la * (1 - b / 255))); }
    data[i] = r; data[i + 1] = g; data[i + 2] = b;
  }
}

/**
 * Apply all canvas filters to an image and return the result as base64.
 * Tries Web Worker first, falls back to main thread.
 */
export async function applyCanvasFilters(
  imageSrc: string,
  options: CanvasFilterOptions,
): Promise<string> {
  const img = await loadImage(imageSrc);
  const w = img.naturalWidth;
  const h = img.naturalHeight;

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;

  // Step 1: Draw original
  ctx.drawImage(img, 0, 0, w, h);

  // Step 2: Get pixel data
  const imageData = ctx.getImageData(0, 0, w, h);

  // Try Web Worker first, fall back to main thread
  try {
    const processed = await runPixelsInWorker(imageData.data, w, h, options);
    imageData.data.set(processed);
  } catch {
    // Main-thread fallback
    applyPixelFiltersMainThread(imageData.data, options);
  }

  // Write processed pixels
  ctx.putImageData(imageData, 0, 0);

  // Step 4: Clarity (unsharp mask on luminosity)
  if (options.clarity! !== 0) {
    applyClarity(ctx, w, h, options.clarity!);
  }

  // Step 5: Sharpness (unsharp mask)
  if (options.sharpness! > 0) {
    applyUnsharpMask(ctx, w, h, options.sharpness! / 20);
  }

  // Step 6: Grain
  if (options.grain! > 0) {
    applyGrain(ctx, w, h, options.grain!);
  }

  // Step 7: Vignette
  if (options.vignette! > 0) {
    applyVignette(ctx, w, h, options.vignette!);
  }

  return canvas.toDataURL("image/png");
}

// ─── Post-Processing Effects ─────────────────────────────────

function applyClarity(ctx: CanvasRenderingContext2D, w: number, h: number, amount: number) {
  // Clarity = midtone contrast via high-pass overlay
  const strength = Math.abs(amount) / 50;
  const sign = amount > 0 ? 1 : -1;

  // Create blurred copy
  const tmpCanvas = document.createElement("canvas");
  tmpCanvas.width = w;
  tmpCanvas.height = h;
  const tmpCtx = tmpCanvas.getContext("2d")!;
  tmpCtx.drawImage(ctx.canvas, 0, 0);
  tmpCtx.filter = "blur(8px)";
  tmpCtx.drawImage(tmpCanvas, 0, 0);

  const original = ctx.getImageData(0, 0, w, h);
  const blurred = tmpCtx.getImageData(0, 0, w, h);
  const oData = original.data;
  const bData = blurred.data;

  for (let i = 0; i < oData.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const diff = oData[i + c] - bData[i + c];
      oData[i + c] = clamp(Math.round(oData[i + c] + diff * strength * sign));
    }
  }
  ctx.putImageData(original, 0, 0);
}

function applyUnsharpMask(ctx: CanvasRenderingContext2D, w: number, h: number, amount: number) {
  const tmpCanvas = document.createElement("canvas");
  tmpCanvas.width = w;
  tmpCanvas.height = h;
  const tmpCtx = tmpCanvas.getContext("2d")!;
  tmpCtx.drawImage(ctx.canvas, 0, 0);
  tmpCtx.filter = "blur(1.5px)";
  tmpCtx.drawImage(tmpCanvas, 0, 0);

  const original = ctx.getImageData(0, 0, w, h);
  const blurred = tmpCtx.getImageData(0, 0, w, h);
  const oData = original.data;
  const bData = blurred.data;

  for (let i = 0; i < oData.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const diff = oData[i + c] - bData[i + c];
      oData[i + c] = clamp(Math.round(oData[i + c] + diff * amount));
    }
  }
  ctx.putImageData(original, 0, 0);
}

function applyGrain(ctx: CanvasRenderingContext2D, w: number, h: number, amount: number) {
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;
  const strength = amount * 0.6;

  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * strength;
    data[i] = clamp(Math.round(data[i] + noise));
    data[i + 1] = clamp(Math.round(data[i + 1] + noise));
    data[i + 2] = clamp(Math.round(data[i + 2] + noise));
  }
  ctx.putImageData(imageData, 0, 0);
}

function applyVignette(ctx: CanvasRenderingContext2D, w: number, h: number, amount: number) {
  const cx = w / 2, cy = h / 2;
  const maxDist = Math.sqrt(cx * cx + cy * cy);
  const strength = amount / 100;

  const gradient = ctx.createRadialGradient(cx, cy, maxDist * (1 - strength * 0.7), cx, cy, maxDist);
  gradient.addColorStop(0, "rgba(0,0,0,0)");
  gradient.addColorStop(1, `rgba(0,0,0,${strength * 0.7})`);

  ctx.globalCompositeOperation = "multiply";
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = "source-over";
}

// ─── Crop & Transform ────────────────────────────────────────
export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TransformOptions {
  crop?: CropRect;
  rotation?: number;    // degrees
  flipH?: boolean;
  flipV?: boolean;
}

/**
 * Apply crop, rotation, and flip to an image.
 * All operations are client-side via Canvas.
 */
export async function applyTransform(
  imageSrc: string,
  transform: TransformOptions,
): Promise<string> {
  const img = await loadImage(imageSrc);
  let sw = img.naturalWidth;
  let sh = img.naturalHeight;

  // 1. Crop
  let sx = 0, sy = 0;
  if (transform.crop) {
    sx = Math.round(transform.crop.x);
    sy = Math.round(transform.crop.y);
    sw = Math.round(transform.crop.width);
    sh = Math.round(transform.crop.height);
  }

  // 2. Determine output size after rotation
  const radians = ((transform.rotation || 0) * Math.PI) / 180;
  const cos = Math.abs(Math.cos(radians));
  const sin = Math.abs(Math.sin(radians));
  const outW = Math.round(sw * cos + sh * sin);
  const outH = Math.round(sh * cos + sw * sin);

  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d")!;

  ctx.save();
  ctx.translate(outW / 2, outH / 2);

  // 3. Rotation
  if (radians !== 0) {
    ctx.rotate(radians);
  }

  // 4. Flip
  const scaleX = transform.flipH ? -1 : 1;
  const scaleY = transform.flipV ? -1 : 1;
  if (scaleX !== 1 || scaleY !== 1) {
    ctx.scale(scaleX, scaleY);
  }

  ctx.drawImage(img, sx, sy, sw, sh, -sw / 2, -sh / 2, sw, sh);
  ctx.restore();

  return canvas.toDataURL("image/png");
}

/**
 * Quick preview: generate a small downscaled version for fast preview.
 */
export async function applyCanvasFiltersPreview(
  imageSrc: string,
  options: CanvasFilterOptions,
  maxSize = 300,
): Promise<string> {
  const img = await loadImage(imageSrc);
  const ratio = Math.min(maxSize / img.naturalWidth, maxSize / img.naturalHeight, 1);
  const w = Math.round(img.naturalWidth * ratio);
  const h = Math.round(img.naturalHeight * ratio);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, w, h);

  // Re-use the same filter logic but on smaller canvas
  const imageData = ctx.getImageData(0, 0, w, h);
  // For preview, use CSS filters for speed
  const cssFilters: string[] = [];
  const o = { ...defaultCanvasFilters, ...options };
  cssFilters.push(`brightness(${(o.brightness! / 100) * Math.pow(2, o.exposure! / 100)})`);
  cssFilters.push(`contrast(${o.contrast}%)`);
  cssFilters.push(`saturate(${o.saturation}%)`);
  if (o.blackAndWhite! > 0) cssFilters.push(`grayscale(${o.blackAndWhite}%)`);
  if (o.sepiaTone! > 0) cssFilters.push(`sepia(${o.sepiaTone}%)`);
  if (o.hue! !== 0) cssFilters.push(`hue-rotate(${o.hue}deg)`);

  ctx.putImageData(imageData, 0, 0);
  ctx.filter = cssFilters.join(" ");
  ctx.drawImage(canvas, 0, 0);
  ctx.filter = "none";

  return canvas.toDataURL("image/jpeg", 0.7);
}
