/**
 * Web Worker for heavy per-pixel filter processing.
 * Offloads canvas pixel manipulation from main thread.
 */

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
    Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, h) * 255),
    Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  ];
}

interface FilterMsg {
  pixels: Uint8ClampedArray;
  width: number;
  height: number;
  options: Record<string, number>;
}

function processPixels(data: Uint8ClampedArray, o: Record<string, number>): void {
  const len = data.length;

  // Pre-compute LUTs
  const brightnessF = (o.brightness ?? 100) / 100;
  const contrastF = (o.contrast ?? 100) / 100;
  const exposureF = Math.pow(2, (o.exposure ?? 0) / 100);
  const saturationF = (o.saturation ?? 100) / 100;
  const fadeAmt = (o.fade ?? 0) / 100;
  const bwAmt = (o.blackAndWhite ?? 0) / 100;
  const sepiaAmt = (o.sepiaTone ?? 0) / 100;
  const vibranceF = (o.vibrance ?? 0) / 100;
  const warmthF = (o.warmth ?? 0);
  const tintF = (o.tint ?? 0);
  const hueShift = (o.hue ?? 0) / 360;
  const dehazeF = (o.dehaze ?? 0) / 100;
  const highlightsF = (o.highlights ?? 0) / 100;
  const shadowsF = (o.shadows ?? 0) / 100;

  // Levels
  const lvlBlack = o.levelsBlack ?? 0;
  const lvlWhite = o.levelsWhite ?? 255;
  const lvlMid = o.levelsMidtones ?? 1.0;

  // Color balance
  const cbSR = (o.cbShadowsR ?? 0) / 100;
  const cbSG = (o.cbShadowsG ?? 0) / 100;
  const cbSB = (o.cbShadowsB ?? 0) / 100;
  const cbMR = (o.cbMidtonesR ?? 0) / 100;
  const cbMG = (o.cbMidtonesG ?? 0) / 100;
  const cbMB = (o.cbMidtonesB ?? 0) / 100;
  const cbHR = (o.cbHighlightsR ?? 0) / 100;
  const cbHG = (o.cbHighlightsG ?? 0) / 100;
  const cbHB = (o.cbHighlightsB ?? 0) / 100;

  const levelsLUT = new Uint8Array(256);
  const range = lvlWhite - lvlBlack || 1;
  for (let i = 0; i < 256; i++) {
    let v = (i - lvlBlack) / range;
    v = Math.max(0, Math.min(1, v));
    v = Math.pow(v, 1 / lvlMid);
    levelsLUT[i] = Math.round(v * 255);
  }

  for (let i = 0; i < len; i += 4) {
    let r = data[i], g = data[i + 1], b = data[i + 2];

    // Levels
    r = levelsLUT[r]; g = levelsLUT[g]; b = levelsLUT[b];

    // Exposure
    r = clamp(r * exposureF); g = clamp(g * exposureF); b = clamp(b * exposureF);

    // Brightness
    r = clamp(r * brightnessF); g = clamp(g * brightnessF); b = clamp(b * brightnessF);

    // Contrast
    r = clamp(((r / 255 - 0.5) * contrastF + 0.5) * 255);
    g = clamp(((g / 255 - 0.5) * contrastF + 0.5) * 255);
    b = clamp(((b / 255 - 0.5) * contrastF + 0.5) * 255);

    // Dehaze
    if (dehazeF > 0) {
      const minC = Math.min(r, g, b);
      const haze = minC * dehazeF;
      r = clamp(r - haze + haze * 0.1);
      g = clamp(g - haze + haze * 0.1);
      b = clamp(b - haze + haze * 0.1);
    }

    // Highlights / Shadows
    const lum = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
    if (highlightsF !== 0 && lum > 0.5) {
      const factor = 1 + highlightsF * (lum - 0.5) * 2;
      r = clamp(r * factor); g = clamp(g * factor); b = clamp(b * factor);
    }
    if (shadowsF !== 0 && lum < 0.5) {
      const factor = 1 + shadowsF * (0.5 - lum) * 2;
      r = clamp(r * factor); g = clamp(g * factor); b = clamp(b * factor);
    }

    // Color balance
    const lumNorm = lum;
    const shadowW = Math.max(0, 1 - lumNorm * 2);
    const highlightW = Math.max(0, lumNorm * 2 - 1);
    const midW = 1 - shadowW - highlightW;
    r = clamp(r + (cbSR * shadowW + cbMR * midW + cbHR * highlightW) * 50);
    g = clamp(g + (cbSG * shadowW + cbMG * midW + cbHG * highlightW) * 50);
    b = clamp(b + (cbSB * shadowW + cbMB * midW + cbHB * highlightW) * 50);

    // Warmth / Tint
    if (warmthF !== 0) {
      r = clamp(r + warmthF * 1.5);
      b = clamp(b - warmthF * 1.5);
    }
    if (tintF !== 0) {
      g = clamp(g + tintF * 1.2);
    }

    // Hue shift + Saturation + Vibrance
    // eslint-disable-next-line prefer-const
    let [h, s, l] = rgbToHsl(r, g, b);
    if (hueShift !== 0) h = (h + hueShift + 1) % 1;
    if (saturationF !== 1) s = Math.min(1, s * saturationF);
    if (vibranceF !== 0) {
      const boost = vibranceF * (1 - s);
      s = Math.min(1, s + boost * 0.5);
    }
    [r, g, b] = hslToRgb(h, s, l);

    // Black & White
    if (bwAmt > 0) {
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      r = clamp(r * (1 - bwAmt) + gray * bwAmt);
      g = clamp(g * (1 - bwAmt) + gray * bwAmt);
      b = clamp(b * (1 - bwAmt) + gray * bwAmt);
    }

    // Sepia
    if (sepiaAmt > 0) {
      const sr = Math.min(255, r * 0.393 + g * 0.769 + b * 0.189);
      const sg = Math.min(255, r * 0.349 + g * 0.686 + b * 0.168);
      const sb = Math.min(255, r * 0.272 + g * 0.534 + b * 0.131);
      r = clamp(r * (1 - sepiaAmt) + sr * sepiaAmt);
      g = clamp(g * (1 - sepiaAmt) + sg * sepiaAmt);
      b = clamp(b * (1 - sepiaAmt) + sb * sepiaAmt);
    }

    // Fade
    if (fadeAmt > 0) {
      r = clamp(r + (128 - r) * fadeAmt);
      g = clamp(g + (128 - g) * fadeAmt);
      b = clamp(b + (128 - b) * fadeAmt);
    }

    data[i] = r; data[i + 1] = g; data[i + 2] = b;
  }
}

self.onmessage = (e: MessageEvent<FilterMsg>) => {
  const { pixels, width, height, options } = e.data;
  processPixels(pixels, options);
  (self as unknown as Worker).postMessage(
    { pixels, width, height },
    [pixels.buffer] as unknown as Transferable[],
  );
};
