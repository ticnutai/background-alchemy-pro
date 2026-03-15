/**
 * Web Worker for heavy per-pixel canvas filter processing.
 * Receives raw pixel data + filter options, returns processed pixels.
 */

interface FilterMsg {
  pixels: Uint8ClampedArray;
  width: number;
  height: number;
  options: Record<string, number>;
}

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

function processPixels(data: Uint8ClampedArray, o: Record<string, number>) {
  const brightnessLut = new Uint8Array(256);
  const contrastLut = new Uint8Array(256);
  const levelsLut = new Uint8Array(256);

  const brightFactor = (o.brightness / 100);
  const expFactor = Math.pow(2, o.exposure / 100);
  for (let i = 0; i < 256; i++) {
    brightnessLut[i] = clamp(Math.round(i * brightFactor * expFactor));
  }

  const contrastFactor = (o.contrast - 100) / 100;
  const intercept = 128 * (1 - (1 + contrastFactor));
  for (let i = 0; i < 256; i++) {
    contrastLut[i] = clamp(Math.round(i * (1 + contrastFactor) + intercept));
  }

  const lBlack = o.levelsBlack;
  const lWhite = o.levelsWhite;
  const lMid = o.levelsMidtones;
  const lRange = Math.max(lWhite - lBlack, 1);
  for (let i = 0; i < 256; i++) {
    let v = (i - lBlack) / lRange;
    v = Math.max(0, Math.min(1, v));
    v = Math.pow(v, 1 / lMid);
    levelsLut[i] = clamp(Math.round(v * 255));
  }

  const dehazeContrast = 1 + (o.dehaze * 0.005);
  const dehazeSat = 1 + (o.dehaze * 0.003);
  const fadeAmount = o.fade / 100;
  const satFactor = o.saturation / 100;
  const vibranceFactor = o.vibrance / 100;
  const warmShift = o.warmth * 1.5;
  const tintShift = o.tint * 1.2;
  const hueShift = o.hue / 360;
  const bwAmount = o.blackAndWhite / 100;
  const sepiaAmount = o.sepiaTone / 100;
  const highlightFactor = o.highlights / 100;
  const shadowFactor = o.shadows / 100;
  const cbSR = o.cbShadowsR / 100, cbSG = o.cbShadowsG / 100, cbSB = o.cbShadowsB / 100;
  const cbMR = o.cbMidtonesR / 100, cbMG = o.cbMidtonesG / 100, cbMB = o.cbMidtonesB / 100;
  const cbHR = o.cbHighlightsR / 100, cbHG = o.cbHighlightsG / 100, cbHB = o.cbHighlightsB / 100;

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i], g = data[i + 1], b = data[i + 2];

    r = brightnessLut[r]; g = brightnessLut[g]; b = brightnessLut[b];
    r = contrastLut[r]; g = contrastLut[g]; b = contrastLut[b];
    r = levelsLut[r]; g = levelsLut[g]; b = levelsLut[b];

    if (o.dehaze > 0) {
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
    if (highlightFactor !== 0) {
      const hlWeight = lum * lum;
      const hlShift = highlightFactor * 80 * hlWeight;
      r = clamp(Math.round(r + hlShift));
      g = clamp(Math.round(g + hlShift));
      b = clamp(Math.round(b + hlShift));
    }
    if (shadowFactor !== 0) {
      const shWeight = (1 - lum) * (1 - lum);
      const shShift = shadowFactor * 80 * shWeight;
      r = clamp(Math.round(r + shShift));
      g = clamp(Math.round(g + shShift));
      b = clamp(Math.round(b + shShift));
    }

    const lumNorm = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    const shadowWeight = Math.max(0, 1 - lumNorm * 3);
    const highlightWeight = Math.max(0, lumNorm * 3 - 2);
    const midWeight = 1 - shadowWeight - highlightWeight;
    r = clamp(Math.round(r + (cbSR * shadowWeight + cbMR * midWeight + cbHR * highlightWeight) * 50));
    g = clamp(Math.round(g + (cbSG * shadowWeight + cbMG * midWeight + cbHG * highlightWeight) * 50));
    b = clamp(Math.round(b + (cbSB * shadowWeight + cbMB * midWeight + cbHB * highlightWeight) * 50));

    if (warmShift !== 0) {
      r = clamp(Math.round(r + warmShift));
      b = clamp(Math.round(b - warmShift * 0.7));
    }

    if (tintShift !== 0) {
      g = clamp(Math.round(g + tintShift));
    }

    let [h, s, l] = rgbToHsl(r, g, b);

    if (hueShift !== 0) {
      h = (h + hueShift + 1) % 1;
    }

    s = Math.max(0, Math.min(1, s * satFactor));

    if (vibranceFactor !== 0) {
      const vibranceBoost = vibranceFactor * (1 - s);
      s = Math.max(0, Math.min(1, s + vibranceBoost * 0.5));
    }

    [r, g, b] = hslToRgb(h, s, l);
    r = Math.round(r); g = Math.round(g); b = Math.round(b);

    if (bwAmount > 0) {
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      r = Math.round(r * (1 - bwAmount) + gray * bwAmount);
      g = Math.round(g * (1 - bwAmount) + gray * bwAmount);
      b = Math.round(b * (1 - bwAmount) + gray * bwAmount);
    }

    if (sepiaAmount > 0) {
      const sr = Math.min(255, r * 0.393 + g * 0.769 + b * 0.189);
      const sg = Math.min(255, r * 0.349 + g * 0.686 + b * 0.168);
      const sb = Math.min(255, r * 0.272 + g * 0.534 + b * 0.131);
      r = Math.round(r * (1 - sepiaAmount) + sr * sepiaAmount);
      g = Math.round(g * (1 - sepiaAmount) + sg * sepiaAmount);
      b = Math.round(b * (1 - sepiaAmount) + sb * sepiaAmount);
    }

    if (fadeAmount > 0) {
      const liftAmount = fadeAmount * 60;
      r = clamp(Math.round(r + (liftAmount * (1 - r / 255))));
      g = clamp(Math.round(g + (liftAmount * (1 - g / 255))));
      b = clamp(Math.round(b + (liftAmount * (1 - b / 255))));
    }

    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
  }
}

self.onmessage = (e: MessageEvent<FilterMsg>) => {
  const { pixels, width, height, options } = e.data;
  processPixels(pixels, options);
  self.postMessage({ pixels, width, height }, [pixels.buffer] as never);
};
