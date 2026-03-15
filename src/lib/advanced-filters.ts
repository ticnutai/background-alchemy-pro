/**
 * Advanced Filter Engine — Non-AI, pure Canvas/algorithm-based
 * Tone Curves, HSL, LUT, Channel Mixer, Gradient Map,
 * Selective Color, Noise Reduction, Tilt-Shift, Blend Modes,
 * Perspective, Text Overlay, Glitch Effects
 */

// ─── Helpers ─────────────────────────────────────────────────
function clamp(v: number, min = 0, max = 255): number {
  return v < min ? min : v > max ? max : v;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function imgToCanvas(img: HTMLImageElement): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0);
  return { canvas, ctx };
}

function srcToCanvas(src: string): Promise<{ canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; w: number; h: number }> {
  return loadImage(src).then(img => {
    const { canvas, ctx } = imgToCanvas(img);
    return { canvas, ctx, w: canvas.width, h: canvas.height };
  });
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
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [hue2rgb(p, q, h + 1 / 3) * 255, hue2rgb(p, q, h) * 255, hue2rgb(p, q, h - 1 / 3) * 255];
}

// ─── 1. Tone Curves ──────────────────────────────────────────
export interface CurvePoint { x: number; y: number }

/** Build a 256-element LUT from control points using monotone cubic interpolation */
export function buildCurveLUT(points: CurvePoint[]): Uint8Array {
  const sorted = [...points].sort((a, b) => a.x - b.x);
  if (sorted.length < 2) {
    const lut = new Uint8Array(256);
    for (let i = 0; i < 256; i++) lut[i] = i;
    return lut;
  }

  // Natural cubic spline
  const n = sorted.length;
  const xs = sorted.map(p => p.x);
  const ys = sorted.map(p => p.y);

  const h = new Float64Array(n - 1);
  const alpha = new Float64Array(n - 1);
  for (let i = 0; i < n - 1; i++) h[i] = xs[i + 1] - xs[i];
  for (let i = 1; i < n - 1; i++) {
    alpha[i] = (3 / h[i]) * (ys[i + 1] - ys[i]) - (3 / h[i - 1]) * (ys[i] - ys[i - 1]);
  }

  const l = new Float64Array(n); l[0] = 1;
  const mu = new Float64Array(n);
  const z = new Float64Array(n);

  for (let i = 1; i < n - 1; i++) {
    l[i] = 2 * (xs[i + 1] - xs[i - 1]) - h[i - 1] * mu[i - 1];
    mu[i] = h[i] / l[i];
    z[i] = (alpha[i] - h[i - 1] * z[i - 1]) / l[i];
  }

  l[n - 1] = 1;
  const c = new Float64Array(n);
  const b = new Float64Array(n - 1);
  const d = new Float64Array(n - 1);

  for (let j = n - 2; j >= 0; j--) {
    c[j] = z[j] - mu[j] * c[j + 1];
    b[j] = (ys[j + 1] - ys[j]) / h[j] - h[j] * (c[j + 1] + 2 * c[j]) / 3;
    d[j] = (c[j + 1] - c[j]) / (3 * h[j]);
  }

  const lut = new Uint8Array(256);
  for (let i = 0; i < 256; i++) {
    let seg = n - 2;
    for (let j = 0; j < n - 1; j++) {
      if (i <= xs[j + 1]) { seg = j; break; }
    }
    const dx = i - xs[seg];
    const val = ys[seg] + b[seg] * dx + c[seg] * dx * dx + d[seg] * dx * dx * dx;
    lut[i] = clamp(Math.round(val));
  }
  return lut;
}

export interface ToneCurveSettings {
  rgb: CurvePoint[];
  red: CurvePoint[];
  green: CurvePoint[];
  blue: CurvePoint[];
}

export const defaultCurvePoints: CurvePoint[] = [
  { x: 0, y: 0 },
  { x: 255, y: 255 },
];

export async function applyToneCurves(imageSrc: string, curves: ToneCurveSettings): Promise<string> {
  const { canvas, ctx, w, h } = await srcToCanvas(imageSrc);
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;

  const lutRGB = buildCurveLUT(curves.rgb);
  const lutR = buildCurveLUT(curves.red);
  const lutG = buildCurveLUT(curves.green);
  const lutB = buildCurveLUT(curves.blue);

  for (let i = 0; i < data.length; i += 4) {
    data[i] = lutR[lutRGB[data[i]]];
    data[i + 1] = lutG[lutRGB[data[i + 1]]];
    data[i + 2] = lutB[lutRGB[data[i + 2]]];
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/png");
}

// ─── 2. HSL Per-Channel ──────────────────────────────────────
export interface HSLChannel {
  hue: number;        // -180 to 180
  saturation: number;  // -100 to 100
  luminance: number;   // -100 to 100
}

export interface HSLSettings {
  reds: HSLChannel;
  oranges: HSLChannel;
  yellows: HSLChannel;
  greens: HSLChannel;
  cyans: HSLChannel;
  blues: HSLChannel;
  purples: HSLChannel;
  magentas: HSLChannel;
}

export const defaultHSLChannel: HSLChannel = { hue: 0, saturation: 0, luminance: 0 };
export const defaultHSLSettings: HSLSettings = {
  reds: { ...defaultHSLChannel },
  oranges: { ...defaultHSLChannel },
  yellows: { ...defaultHSLChannel },
  greens: { ...defaultHSLChannel },
  cyans: { ...defaultHSLChannel },
  blues: { ...defaultHSLChannel },
  purples: { ...defaultHSLChannel },
  magentas: { ...defaultHSLChannel },
};

const HSL_RANGES: Record<string, [number, number]> = {
  reds: [345, 15],
  oranges: [15, 45],
  yellows: [45, 75],
  greens: [75, 165],
  cyans: [165, 195],
  blues: [195, 255],
  purples: [255, 285],
  magentas: [285, 345],
};

function getHSLChannelWeight(hueDeg: number): Record<string, number> {
  const weights: Record<string, number> = {};
  for (const [name, [start, end]] of Object.entries(HSL_RANGES)) {
    let dist: number;
    if (start > end) {
      // Wraps around (e.g. reds: 345-15)
      if (hueDeg >= start || hueDeg <= end) {
        dist = 0;
      } else {
        dist = Math.min(Math.abs(hueDeg - start), Math.abs(hueDeg - end), Math.abs(hueDeg - (start - 360)), Math.abs(hueDeg - (end + 360)));
      }
    } else {
      if (hueDeg >= start && hueDeg <= end) {
        dist = 0;
      } else {
        dist = Math.min(Math.abs(hueDeg - start), Math.abs(hueDeg - end));
      }
    }
    // Smooth falloff within 15 degrees
    weights[name] = dist === 0 ? 1 : dist < 15 ? 1 - dist / 15 : 0;
  }
  return weights;
}

export async function applyHSL(imageSrc: string, settings: HSLSettings): Promise<string> {
  const { canvas, ctx, w, h } = await srcToCanvas(imageSrc);
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const [hNorm, s, l] = rgbToHsl(data[i], data[i + 1], data[i + 2]);
    const hueDeg = hNorm * 360;

    const weights = getHSLChannelWeight(hueDeg);
    let hueShift = 0, satShift = 0, lumShift = 0;

    for (const [name, weight] of Object.entries(weights)) {
      if (weight > 0) {
        const ch = settings[name as keyof HSLSettings];
        hueShift += ch.hue * weight;
        satShift += ch.saturation * weight;
        lumShift += ch.luminance * weight;
      }
    }

    const newH = ((hNorm + hueShift / 360) % 1 + 1) % 1;
    const newS = Math.max(0, Math.min(1, s + satShift / 100));
    const newL = Math.max(0, Math.min(1, l + lumShift / 100));

    const [r, g, b] = hslToRgb(newH, newS, newL);
    data[i] = clamp(Math.round(r));
    data[i + 1] = clamp(Math.round(g));
    data[i + 2] = clamp(Math.round(b));
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/png");
}

// ─── 3. White Balance Picker ─────────────────────────────────
export async function applyWhiteBalance(imageSrc: string, sampleX: number, sampleY: number, sampleRadius = 5): Promise<string> {
  const { canvas, ctx, w, h } = await srcToCanvas(imageSrc);
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;

  // Sample the area around the click point
  let rSum = 0, gSum = 0, bSum = 0, count = 0;
  for (let dy = -sampleRadius; dy <= sampleRadius; dy++) {
    for (let dx = -sampleRadius; dx <= sampleRadius; dx++) {
      const px = sampleX + dx;
      const py = sampleY + dy;
      if (px >= 0 && px < w && py >= 0 && py < h) {
        const idx = (py * w + px) * 4;
        rSum += data[idx];
        gSum += data[idx + 1];
        bSum += data[idx + 2];
        count++;
      }
    }
  }

  if (count === 0) return imageSrc;

  const rAvg = rSum / count;
  const gAvg = gSum / count;
  const bAvg = bSum / count;
  const gray = (rAvg + gAvg + bAvg) / 3;

  // Compute gain per channel
  const rGain = gray / Math.max(rAvg, 1);
  const gGain = gray / Math.max(gAvg, 1);
  const bGain = gray / Math.max(bAvg, 1);

  for (let i = 0; i < data.length; i += 4) {
    data[i] = clamp(Math.round(data[i] * rGain));
    data[i + 1] = clamp(Math.round(data[i + 1] * gGain));
    data[i + 2] = clamp(Math.round(data[i + 2] * bGain));
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/png");
}

// ─── 4. Perspective Correction ───────────────────────────────
export interface PerspectivePoints {
  topLeft: { x: number; y: number };
  topRight: { x: number; y: number };
  bottomLeft: { x: number; y: number };
  bottomRight: { x: number; y: number };
}

export async function applyPerspective(
  imageSrc: string,
  src: PerspectivePoints,
  outputWidth?: number,
  outputHeight?: number,
): Promise<string> {
  const img = await loadImage(imageSrc);
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  const ow = outputWidth || iw;
  const oh = outputHeight || ih;

  const srcCanvas = document.createElement("canvas");
  srcCanvas.width = iw;
  srcCanvas.height = ih;
  const srcCtx = srcCanvas.getContext("2d", { willReadFrequently: true })!;
  srcCtx.drawImage(img, 0, 0);
  const srcData = srcCtx.getImageData(0, 0, iw, ih);

  const dstCanvas = document.createElement("canvas");
  dstCanvas.width = ow;
  dstCanvas.height = oh;
  const dstCtx = dstCanvas.getContext("2d")!;
  const dstData = dstCtx.createImageData(ow, oh);

  // Bilinear interpolation with perspective transform (inverse mapping)
  for (let y = 0; y < oh; y++) {
    for (let x = 0; x < ow; x++) {
      const u = x / ow;
      const v = y / oh;

      // Bilinear interpolation of source points
      const topX = src.topLeft.x + (src.topRight.x - src.topLeft.x) * u;
      const topY = src.topLeft.y + (src.topRight.y - src.topLeft.y) * u;
      const botX = src.bottomLeft.x + (src.bottomRight.x - src.bottomLeft.x) * u;
      const botY = src.bottomLeft.y + (src.bottomRight.y - src.bottomLeft.y) * u;

      const sx = topX + (botX - topX) * v;
      const sy = topY + (botY - topY) * v;

      // Bilinear sample from source
      const fx = Math.floor(sx);
      const fy = Math.floor(sy);
      const dx = sx - fx;
      const dy = sy - fy;

      if (fx >= 0 && fx < iw - 1 && fy >= 0 && fy < ih - 1) {
        const idx = (y * ow + x) * 4;
        for (let c = 0; c < 4; c++) {
          const i00 = (fy * iw + fx) * 4 + c;
          const i10 = (fy * iw + fx + 1) * 4 + c;
          const i01 = ((fy + 1) * iw + fx) * 4 + c;
          const i11 = ((fy + 1) * iw + (fx + 1)) * 4 + c;
          const val = srcData.data[i00] * (1 - dx) * (1 - dy)
            + srcData.data[i10] * dx * (1 - dy)
            + srcData.data[i01] * (1 - dx) * dy
            + srcData.data[i11] * dx * dy;
          dstData.data[idx + c] = Math.round(val);
        }
      }
    }
  }

  dstCtx.putImageData(dstData, 0, 0);
  return dstCanvas.toDataURL("image/png");
}

// ─── 5. LUT Import (.cube) ──────────────────────────────────
export interface LUT3D {
  size: number;
  data: Float32Array; // size^3 * 3
  title?: string;
}

export function parseCubeLUT(text: string): LUT3D {
  const lines = text.split("\n");
  let size = 0;
  const values: number[] = [];
  let title = "";

  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    if (line.startsWith("TITLE")) { title = line.replace(/^TITLE\s*"?/, "").replace(/"?\s*$/, ""); continue; }
    if (line.startsWith("LUT_3D_SIZE")) { size = parseInt(line.split(/\s+/)[1]); continue; }
    if (line.startsWith("DOMAIN_MIN") || line.startsWith("DOMAIN_MAX")) continue;

    const parts = line.split(/\s+/).map(Number);
    if (parts.length >= 3 && !isNaN(parts[0])) {
      values.push(parts[0], parts[1], parts[2]);
    }
  }

  if (size === 0) size = Math.round(Math.pow(values.length / 3, 1 / 3));
  return { size, data: new Float32Array(values), title };
}

export async function applyLUT(imageSrc: string, lut: LUT3D, intensity = 1): Promise<string> {
  const { canvas, ctx, w, h } = await srcToCanvas(imageSrc);
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;
  const s = lut.size;
  const s1 = s - 1;

  for (let i = 0; i < data.length; i += 4) {
    const rNorm = data[i] / 255 * s1;
    const gNorm = data[i + 1] / 255 * s1;
    const bNorm = data[i + 2] / 255 * s1;

    // Trilinear interpolation
    const r0 = Math.floor(rNorm), r1f = Math.min(r0 + 1, s1);
    const g0 = Math.floor(gNorm), g1f = Math.min(g0 + 1, s1);
    const b0 = Math.floor(bNorm), b1f = Math.min(b0 + 1, s1);

    const rd = rNorm - r0;
    const gd = gNorm - g0;
    const bd = bNorm - b0;

    const idx = (ri: number, gi: number, bi: number) => (ri + gi * s + bi * s * s) * 3;

    const interp = (channel: number) => {
      const c000 = lut.data[idx(r0, g0, b0) + channel];
      const c100 = lut.data[idx(r1f, g0, b0) + channel];
      const c010 = lut.data[idx(r0, g1f, b0) + channel];
      const c110 = lut.data[idx(r1f, g1f, b0) + channel];
      const c001 = lut.data[idx(r0, g0, b1f) + channel];
      const c101 = lut.data[idx(r1f, g0, b1f) + channel];
      const c011 = lut.data[idx(r0, g1f, b1f) + channel];
      const c111 = lut.data[idx(r1f, g1f, b1f) + channel];

      const c00 = c000 * (1 - rd) + c100 * rd;
      const c01 = c001 * (1 - rd) + c101 * rd;
      const c10 = c010 * (1 - rd) + c110 * rd;
      const c11 = c011 * (1 - rd) + c111 * rd;

      const c0 = c00 * (1 - gd) + c10 * gd;
      const c1 = c01 * (1 - gd) + c11 * gd;

      return c0 * (1 - bd) + c1 * bd;
    };

    const newR = interp(0) * 255;
    const newG = interp(1) * 255;
    const newB = interp(2) * 255;

    data[i] = clamp(Math.round(data[i] * (1 - intensity) + newR * intensity));
    data[i + 1] = clamp(Math.round(data[i + 1] * (1 - intensity) + newG * intensity));
    data[i + 2] = clamp(Math.round(data[i + 2] * (1 - intensity) + newB * intensity));
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/png");
}

// ─── 6. Channel Mixer ────────────────────────────────────────
export interface ChannelMixerSettings {
  redOut: { red: number; green: number; blue: number; constant: number };
  greenOut: { red: number; green: number; blue: number; constant: number };
  blueOut: { red: number; green: number; blue: number; constant: number };
}

export const defaultChannelMixer: ChannelMixerSettings = {
  redOut: { red: 100, green: 0, blue: 0, constant: 0 },
  greenOut: { red: 0, green: 100, blue: 0, constant: 0 },
  blueOut: { red: 0, green: 0, blue: 100, constant: 0 },
};

export async function applyChannelMixer(imageSrc: string, mix: ChannelMixerSettings): Promise<string> {
  const { canvas, ctx, w, h } = await srcToCanvas(imageSrc);
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    data[i] = clamp(Math.round(r * mix.redOut.red / 100 + g * mix.redOut.green / 100 + b * mix.redOut.blue / 100 + mix.redOut.constant * 2.55));
    data[i + 1] = clamp(Math.round(r * mix.greenOut.red / 100 + g * mix.greenOut.green / 100 + b * mix.greenOut.blue / 100 + mix.greenOut.constant * 2.55));
    data[i + 2] = clamp(Math.round(r * mix.blueOut.red / 100 + g * mix.blueOut.green / 100 + b * mix.blueOut.blue / 100 + mix.blueOut.constant * 2.55));
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/png");
}

// ─── 7. Gradient Map ─────────────────────────────────────────
export interface GradientStop { position: number; color: string } // position 0-1, color hex

export const gradientMapPresets: Record<string, GradientStop[]> = {
  "זהב-שחור": [{ position: 0, color: "#000000" }, { position: 0.5, color: "#8B6914" }, { position: 1, color: "#FFD700" }],
  "כחול-כתום": [{ position: 0, color: "#001B44" }, { position: 0.5, color: "#4A90D9" }, { position: 1, color: "#FF8C00" }],
  "וינטג׳ חם": [{ position: 0, color: "#1A0A00" }, { position: 0.5, color: "#8B4513" }, { position: 1, color: "#FFECD2" }],
  "סגול-ורוד": [{ position: 0, color: "#1A0033" }, { position: 0.5, color: "#8B008B" }, { position: 1, color: "#FFB6C1" }],
  "ציאן-אדום": [{ position: 0, color: "#004040" }, { position: 0.5, color: "#808080" }, { position: 1, color: "#FF4040" }],
  "ירוק עמוק": [{ position: 0, color: "#001A00" }, { position: 0.5, color: "#2E8B57" }, { position: 1, color: "#F0FFF0" }],
};

function hexToRgb(hex: string): [number, number, number] {
  const m = hex.replace("#", "");
  return [parseInt(m.slice(0, 2), 16), parseInt(m.slice(2, 4), 16), parseInt(m.slice(4, 6), 16)];
}

export async function applyGradientMap(imageSrc: string, stops: GradientStop[], intensity = 1): Promise<string> {
  const { canvas, ctx, w, h } = await srcToCanvas(imageSrc);
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;

  // Build 256-entry gradient LUT
  const gradLUT = new Uint8Array(256 * 3);
  const sortedStops = [...stops].sort((a, b) => a.position - b.position);

  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let lo = sortedStops[0], hi = sortedStops[sortedStops.length - 1];
    for (let s = 0; s < sortedStops.length - 1; s++) {
      if (t >= sortedStops[s].position && t <= sortedStops[s + 1].position) {
        lo = sortedStops[s];
        hi = sortedStops[s + 1];
        break;
      }
    }
    const range = hi.position - lo.position || 1;
    const localT = (t - lo.position) / range;
    const [r1, g1, b1] = hexToRgb(lo.color);
    const [r2, g2, b2] = hexToRgb(hi.color);
    gradLUT[i * 3] = Math.round(r1 + (r2 - r1) * localT);
    gradLUT[i * 3 + 1] = Math.round(g1 + (g2 - g1) * localT);
    gradLUT[i * 3 + 2] = Math.round(b1 + (b2 - b1) * localT);
  }

  for (let i = 0; i < data.length; i += 4) {
    const lum = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    const nr = gradLUT[lum * 3];
    const ng = gradLUT[lum * 3 + 1];
    const nb = gradLUT[lum * 3 + 2];
    data[i] = clamp(Math.round(data[i] * (1 - intensity) + nr * intensity));
    data[i + 1] = clamp(Math.round(data[i + 1] * (1 - intensity) + ng * intensity));
    data[i + 2] = clamp(Math.round(data[i + 2] * (1 - intensity) + nb * intensity));
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/png");
}

// ─── 8. Selective Color (CMYK-style) ─────────────────────────
export interface SelectiveColorChannel {
  cyan: number;    // -100 to 100
  magenta: number;
  yellow: number;
  black: number;
}

export interface SelectiveColorSettings {
  reds: SelectiveColorChannel;
  yellows: SelectiveColorChannel;
  greens: SelectiveColorChannel;
  cyans: SelectiveColorChannel;
  blues: SelectiveColorChannel;
  magentas: SelectiveColorChannel;
  whites: SelectiveColorChannel;
  neutrals: SelectiveColorChannel;
  blacks: SelectiveColorChannel;
}

export const defaultSelectiveColor: SelectiveColorChannel = { cyan: 0, magenta: 0, yellow: 0, black: 0 };
export const defaultSelectiveColorSettings: SelectiveColorSettings = {
  reds: { ...defaultSelectiveColor },
  yellows: { ...defaultSelectiveColor },
  greens: { ...defaultSelectiveColor },
  cyans: { ...defaultSelectiveColor },
  blues: { ...defaultSelectiveColor },
  magentas: { ...defaultSelectiveColor },
  whites: { ...defaultSelectiveColor },
  neutrals: { ...defaultSelectiveColor },
  blacks: { ...defaultSelectiveColor },
};

function rgbToCmyk(r: number, g: number, b: number): [number, number, number, number] {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const k = 1 - Math.max(rn, gn, bn);
  if (k >= 1) return [0, 0, 0, 1];
  const c = (1 - rn - k) / (1 - k);
  const m = (1 - gn - k) / (1 - k);
  const y = (1 - bn - k) / (1 - k);
  return [c, m, y, k];
}

function cmykToRgb(c: number, m: number, y: number, k: number): [number, number, number] {
  return [
    Math.round(255 * (1 - c) * (1 - k)),
    Math.round(255 * (1 - m) * (1 - k)),
    Math.round(255 * (1 - y) * (1 - k)),
  ];
}

function getSelectiveColorWeight(r: number, g: number, b: number): Record<string, number> {
  const [h, s, l] = rgbToHsl(r, g, b);
  const hueDeg = h * 360;
  const weights: Record<string, number> = {
    reds: 0, yellows: 0, greens: 0, cyans: 0, blues: 0, magentas: 0,
    whites: 0, neutrals: 0, blacks: 0,
  };

  if (s > 0.1) {
    if ((hueDeg >= 330 || hueDeg < 30)) weights.reds = s;
    if (hueDeg >= 30 && hueDeg < 90) weights.yellows = s;
    if (hueDeg >= 90 && hueDeg < 150) weights.greens = s;
    if (hueDeg >= 150 && hueDeg < 210) weights.cyans = s;
    if (hueDeg >= 210 && hueDeg < 270) weights.blues = s;
    if (hueDeg >= 270 && hueDeg < 330) weights.magentas = s;
  }

  if (l > 0.7) weights.whites = (l - 0.7) / 0.3;
  if (l < 0.3) weights.blacks = (0.3 - l) / 0.3;
  weights.neutrals = 1 - s;

  return weights;
}

export async function applySelectiveColor(imageSrc: string, settings: SelectiveColorSettings): Promise<string> {
  const { canvas, ctx, w, h } = await srcToCanvas(imageSrc);
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const weights = getSelectiveColorWeight(r, g, b);
    let [c, m, y, k] = rgbToCmyk(r, g, b);

    for (const [name, weight] of Object.entries(weights)) {
      if (weight > 0) {
        const ch = settings[name as keyof SelectiveColorSettings];
        c = Math.max(0, Math.min(1, c + ch.cyan / 100 * weight * 0.3));
        m = Math.max(0, Math.min(1, m + ch.magenta / 100 * weight * 0.3));
        y = Math.max(0, Math.min(1, y + ch.yellow / 100 * weight * 0.3));
        k = Math.max(0, Math.min(1, k + ch.black / 100 * weight * 0.3));
      }
    }

    const [nr, ng, nb] = cmykToRgb(c, m, y, k);
    data[i] = clamp(nr);
    data[i + 1] = clamp(ng);
    data[i + 2] = clamp(nb);
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/png");
}

// ─── 9. Noise Reduction (Bilateral Filter approximation) ─────
export async function applyNoiseReduction(imageSrc: string, strength = 50, detail = 50): Promise<string> {
  const { canvas, ctx, w, h } = await srcToCanvas(imageSrc);
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;
  const output = new Uint8ClampedArray(data);

  const radius = Math.max(1, Math.round(strength / 20));
  const sigmaColor = 10 + strength * 0.5;
  const sigmaSpace = radius;
  const detailPreserve = detail / 100;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      let rSum = 0, gSum = 0, bSum = 0, wSum = 0;

      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;

          const nIdx = (ny * w + nx) * 4;
          const spatialDist = Math.sqrt(dx * dx + dy * dy);
          const colorDist = Math.sqrt(
            (data[idx] - data[nIdx]) ** 2 +
            (data[idx + 1] - data[nIdx + 1]) ** 2 +
            (data[idx + 2] - data[nIdx + 2]) ** 2
          );

          const spatialW = Math.exp(-spatialDist * spatialDist / (2 * sigmaSpace * sigmaSpace));
          const colorW = Math.exp(-colorDist * colorDist / (2 * sigmaColor * sigmaColor));
          const weight = spatialW * colorW;

          rSum += data[nIdx] * weight;
          gSum += data[nIdx + 1] * weight;
          bSum += data[nIdx + 2] * weight;
          wSum += weight;
        }
      }

      if (wSum > 0) {
        const smoothR = rSum / wSum;
        const smoothG = gSum / wSum;
        const smoothB = bSum / wSum;
        output[idx] = clamp(Math.round(data[idx] * detailPreserve + smoothR * (1 - detailPreserve)));
        output[idx + 1] = clamp(Math.round(data[idx + 1] * detailPreserve + smoothG * (1 - detailPreserve)));
        output[idx + 2] = clamp(Math.round(data[idx + 2] * detailPreserve + smoothB * (1 - detailPreserve)));
      }
      output[idx + 3] = data[idx + 3];
    }
  }

  const outData = new ImageData(output, w, h);
  ctx.putImageData(outData, 0, 0);
  return canvas.toDataURL("image/png");
}

// ─── 10. Tilt-Shift Effect ───────────────────────────────────
export async function applyTiltShift(
  imageSrc: string,
  focusY = 0.5,       // 0-1, vertical position of focus band
  focusWidth = 0.2,   // 0-1, width of in-focus band
  blurAmount = 8,      // pixels
): Promise<string> {
  const { canvas, ctx, w, h } = await srcToCanvas(imageSrc);

  // Create blurred version
  const blurCanvas = document.createElement("canvas");
  blurCanvas.width = w;
  blurCanvas.height = h;
  const blurCtx = blurCanvas.getContext("2d")!;
  blurCtx.filter = `blur(${blurAmount}px)`;
  blurCtx.drawImage(canvas, 0, 0);
  blurCtx.filter = "none";

  const sharpData = ctx.getImageData(0, 0, w, h);
  const blurData = blurCtx.getImageData(0, 0, w, h);
  const sd = sharpData.data;
  const bd = blurData.data;

  const focusCenter = focusY * h;
  const focusHalf = (focusWidth * h) / 2;

  for (let y = 0; y < h; y++) {
    const dist = Math.abs(y - focusCenter);
    const t = dist < focusHalf ? 0 : Math.min(1, (dist - focusHalf) / (focusHalf * 1.5));
    // Smooth transition
    const blend = t * t * (3 - 2 * t); // smoothstep

    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      sd[idx] = Math.round(sd[idx] * (1 - blend) + bd[idx] * blend);
      sd[idx + 1] = Math.round(sd[idx + 1] * (1 - blend) + bd[idx + 1] * blend);
      sd[idx + 2] = Math.round(sd[idx + 2] * (1 - blend) + bd[idx + 2] * blend);
    }
  }

  ctx.putImageData(sharpData, 0, 0);
  return canvas.toDataURL("image/png");
}

// ─── 11. Blend Modes / Double Exposure ───────────────────────
export type BlendMode =
  | "multiply" | "screen" | "overlay" | "soft-light" | "hard-light"
  | "color-dodge" | "color-burn" | "difference" | "exclusion"
  | "luminosity" | "color";

export async function applyBlendMode(
  baseSrc: string,
  overlaySrc: string,
  mode: BlendMode,
  opacity = 1,
): Promise<string> {
  const [baseImg, overlayImg] = await Promise.all([loadImage(baseSrc), loadImage(overlaySrc)]);
  const canvas = document.createElement("canvas");
  canvas.width = baseImg.naturalWidth;
  canvas.height = baseImg.naturalHeight;
  const ctx = canvas.getContext("2d")!;

  // Draw base
  ctx.drawImage(baseImg, 0, 0);

  // Apply blend mode
  ctx.globalCompositeOperation = mode === "soft-light" ? "soft-light"
    : mode === "hard-light" ? "hard-light"
    : mode === "color-dodge" ? "color-dodge"
    : mode === "color-burn" ? "color-burn"
    : mode as GlobalCompositeOperation;
  ctx.globalAlpha = opacity;
  ctx.drawImage(overlayImg, 0, 0, canvas.width, canvas.height);
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;

  return canvas.toDataURL("image/png");
}

// ─── 12. Text Overlay ────────────────────────────────────────
export interface TextOverlayOptions {
  text: string;
  x: number;            // 0-1 relative position
  y: number;            // 0-1 relative position
  fontSize: number;     // px
  fontFamily: string;
  color: string;        // hex
  strokeColor?: string;
  strokeWidth?: number;
  rotation?: number;    // degrees
  opacity?: number;     // 0-1
  shadow?: boolean;
  gradient?: { from: string; to: string };
}

export async function applyTextOverlay(
  imageSrc: string,
  options: TextOverlayOptions,
): Promise<string> {
  const { canvas, ctx, w, h } = await srcToCanvas(imageSrc);

  ctx.save();
  const px = options.x * w;
  const py = options.y * h;

  ctx.translate(px, py);
  if (options.rotation) ctx.rotate((options.rotation * Math.PI) / 180);
  ctx.globalAlpha = options.opacity ?? 1;

  ctx.font = `${options.fontSize}px "${options.fontFamily}", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Shadow
  if (options.shadow) {
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 3;
  }

  // Stroke
  if (options.strokeColor && options.strokeWidth) {
    ctx.strokeStyle = options.strokeColor;
    ctx.lineWidth = options.strokeWidth;
    ctx.strokeText(options.text, 0, 0);
  }

  // Fill (gradient or solid)
  if (options.gradient) {
    const metrics = ctx.measureText(options.text);
    const grad = ctx.createLinearGradient(-metrics.width / 2, 0, metrics.width / 2, 0);
    grad.addColorStop(0, options.gradient.from);
    grad.addColorStop(1, options.gradient.to);
    ctx.fillStyle = grad;
  } else {
    ctx.fillStyle = options.color;
  }

  ctx.fillText(options.text, 0, 0);
  ctx.restore();

  return canvas.toDataURL("image/png");
}

// ─── 13. Glitch / Creative Effects ──────────────────────────
export type GlitchEffect = "rgb-split" | "scanlines" | "pixelate" | "halftone" | "duotone";

export async function applyGlitchEffect(
  imageSrc: string,
  effect: GlitchEffect,
  intensity = 50,
): Promise<string> {
  const { canvas, ctx, w, h } = await srcToCanvas(imageSrc);
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;

  switch (effect) {
    case "rgb-split": {
      const shift = Math.round(intensity * 0.15);
      const output = new Uint8ClampedArray(data);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const idx = (y * w + x) * 4;
          // Red channel shifted left
          const rSource = Math.max(0, x - shift);
          output[idx] = data[(y * w + rSource) * 4];
          // Green stays
          output[idx + 1] = data[idx + 1];
          // Blue shifted right
          const bSource = Math.min(w - 1, x + shift);
          output[idx + 2] = data[(y * w + bSource) * 4 + 2];
          output[idx + 3] = data[idx + 3];
        }
      }
      const out = new ImageData(output, w, h);
      ctx.putImageData(out, 0, 0);
      break;
    }

    case "scanlines": {
      const gap = Math.max(2, Math.round(8 - intensity * 0.06));
      const alpha = intensity / 200;
      for (let y = 0; y < h; y += gap) {
        for (let x = 0; x < w; x++) {
          const idx = (y * w + x) * 4;
          data[idx] = Math.round(data[idx] * (1 - alpha));
          data[idx + 1] = Math.round(data[idx + 1] * (1 - alpha));
          data[idx + 2] = Math.round(data[idx + 2] * (1 - alpha));
        }
      }
      ctx.putImageData(imageData, 0, 0);
      break;
    }

    case "pixelate": {
      const size = Math.max(2, Math.round(intensity * 0.3));
      ctx.imageSmoothingEnabled = false;
      const tempCanvas = document.createElement("canvas");
      const tw = Math.ceil(w / size), th = Math.ceil(h / size);
      tempCanvas.width = tw;
      tempCanvas.height = th;
      const tCtx = tempCanvas.getContext("2d")!;
      tCtx.drawImage(canvas, 0, 0, tw, th);
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(tempCanvas, 0, 0, tw, th, 0, 0, w, h);
      ctx.imageSmoothingEnabled = true;
      break;
    }

    case "halftone": {
      const dotSize = Math.max(3, Math.round(intensity * 0.15));
      const output = ctx.createImageData(w, h);
      const od = output.data;
      // Fill white
      for (let i = 0; i < od.length; i += 4) { od[i] = 255; od[i + 1] = 255; od[i + 2] = 255; od[i + 3] = 255; }

      for (let cy = 0; cy < h; cy += dotSize) {
        for (let cx = 0; cx < w; cx += dotSize) {
          // Average luminance in block
          let lumSum = 0, count = 0;
          let rAvg = 0, gAvg = 0, bAvg = 0;
          for (let dy = 0; dy < dotSize && cy + dy < h; dy++) {
            for (let dx = 0; dx < dotSize && cx + dx < w; dx++) {
              const idx = ((cy + dy) * w + (cx + dx)) * 4;
              lumSum += 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
              rAvg += data[idx]; gAvg += data[idx + 1]; bAvg += data[idx + 2];
              count++;
            }
          }
          const lum = lumSum / count;
          rAvg /= count; gAvg /= count; bAvg /= count;
          const radius = (1 - lum / 255) * dotSize * 0.5;

          // Draw dot
          const centerX = cx + dotSize / 2;
          const centerY = cy + dotSize / 2;
          for (let dy = -Math.ceil(radius); dy <= Math.ceil(radius); dy++) {
            for (let dx = -Math.ceil(radius); dx <= Math.ceil(radius); dx++) {
              if (dx * dx + dy * dy <= radius * radius) {
                const px = Math.round(centerX + dx);
                const py = Math.round(centerY + dy);
                if (px >= 0 && px < w && py >= 0 && py < h) {
                  const idx = (py * w + px) * 4;
                  od[idx] = clamp(Math.round(rAvg));
                  od[idx + 1] = clamp(Math.round(gAvg));
                  od[idx + 2] = clamp(Math.round(bAvg));
                }
              }
            }
          }
        }
      }
      ctx.putImageData(output, 0, 0);
      break;
    }

    case "duotone": {
      // Default duotone: dark blue + light gold
      const dark = [20, 30, 80];
      const light = [255, 200, 100];
      const blend = intensity / 100;
      for (let i = 0; i < data.length; i += 4) {
        const lum = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255;
        const mr = dark[0] + (light[0] - dark[0]) * lum;
        const mg = dark[1] + (light[1] - dark[1]) * lum;
        const mb = dark[2] + (light[2] - dark[2]) * lum;
        data[i] = clamp(Math.round(data[i] * (1 - blend) + mr * blend));
        data[i + 1] = clamp(Math.round(data[i + 1] * (1 - blend) + mg * blend));
        data[i + 2] = clamp(Math.round(data[i + 2] * (1 - blend) + mb * blend));
      }
      ctx.putImageData(imageData, 0, 0);
      break;
    }
  }

  return canvas.toDataURL("image/png");
}
