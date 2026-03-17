/**
 * Smart Image Tools — Non-AI, pure Canvas/algorithm-based image processing
 * No external AI APIs needed. Runs 100% in the browser.
 */

// ─── Color Utilities ──────────────────────────────────────────────
export interface RGBA { r: number; g: number; b: number; a: number }
export interface HSL  { h: number; s: number; l: number }
export interface Lab  { L: number; a: number; b: number }

/** Clamp a value between min and max (default 0–255) */
export function clamp(v: number, min = 0, max = 255): number {
  return v < min ? min : v > max ? max : v;
}

/** RGB → HSL (tuple: [h 0–1, s 0–1, l 0–1]) */
export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
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

/** HSL (h 0–1, s 0–1, l 0–1) → RGB [0–255, 0–255, 0–255] */
export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) { const v = Math.round(l * 255); return [v, v, v]; }
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
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

function colorDistance(c1: RGBA, c2: RGBA): number {
  return Math.sqrt(
    (c1.r - c2.r) ** 2 +
    (c1.g - c2.g) ** 2 +
    (c1.b - c2.b) ** 2
  );
}

// ─── CIE Lab Color Space (perceptual color distance) ────────────
// Based on CIE 1976 L*a*b* with D65 illuminant
function srgbToLinear(c: number): number {
  c /= 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function rgbToLab(r: number, g: number, b: number): Lab {
  // sRGB → linear RGB → XYZ (D65)
  const lr = srgbToLinear(r), lg = srgbToLinear(g), lb = srgbToLinear(b);
  let x = (lr * 0.4124564 + lg * 0.3575761 + lb * 0.1804375) / 0.95047;
  let y = (lr * 0.2126729 + lg * 0.7151522 + lb * 0.0721750);
  let z = (lr * 0.0193339 + lg * 0.1191920 + lb * 0.9503041) / 1.08883;
  const f = (t: number) => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
  x = f(x); y = f(y); z = f(z);
  return { L: 116 * y - 16, a: 500 * (x - y), b: 200 * (y - z) };
}

/** CIE76 Delta E — perceptual color distance (0 = identical, ~2.3 = JND) */
function deltaE76(c1: RGBA, c2: RGBA): number {
  const lab1 = rgbToLab(c1.r, c1.g, c1.b);
  const lab2 = rgbToLab(c2.r, c2.g, c2.b);
  return Math.sqrt(
    (lab1.L - lab2.L) ** 2 +
    (lab1.a - lab2.a) ** 2 +
    (lab1.b - lab2.b) ** 2
  );
}

/**
 * CIEDE2000 (Delta E00) — state-of-the-art perceptual color distance
 * Reference: CIE Technical Report 142-2001 / Sharma, Wu & Dalal 2005
 * Much more accurate than Delta E76, especially for saturated & blue colors.
 * Accounts for lightness, chroma, and hue weighting + blue rotation term.
 */
function deltaE2000(c1: RGBA, c2: RGBA): number {
  const lab1 = rgbToLab(c1.r, c1.g, c1.b);
  const lab2 = rgbToLab(c2.r, c2.g, c2.b);
  const L1 = lab1.L, a1 = lab1.a, b1 = lab1.b;
  const L2 = lab2.L, a2 = lab2.a, b2 = lab2.b;

  const C1 = Math.sqrt(a1 * a1 + b1 * b1);
  const C2 = Math.sqrt(a2 * a2 + b2 * b2);
  const Cab = (C1 + C2) / 2;
  const Cab7 = Cab ** 7;
  const G = 0.5 * (1 - Math.sqrt(Cab7 / (Cab7 + 6103515625))); // 25^7
  const a1p = a1 * (1 + G), a2p = a2 * (1 + G);
  const C1p = Math.sqrt(a1p * a1p + b1 * b1);
  const C2p = Math.sqrt(a2p * a2p + b2 * b2);

  const h1p = Math.atan2(b1, a1p) * 180 / Math.PI;
  const h2p = Math.atan2(b2, a2p) * 180 / Math.PI;
  const h1pn = h1p < 0 ? h1p + 360 : h1p;
  const h2pn = h2p < 0 ? h2p + 360 : h2p;

  const dLp = L2 - L1;
  const dCp = C2p - C1p;
  let dhp: number;
  if (C1p * C2p === 0) {
    dhp = 0;
  } else {
    const diff = h2pn - h1pn;
    if (Math.abs(diff) <= 180) dhp = diff;
    else if (diff > 180) dhp = diff - 360;
    else dhp = diff + 360;
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp * Math.PI / 180) / 2);

  const Lp = (L1 + L2) / 2;
  const Cp = (C1p + C2p) / 2;
  let Hp: number;
  if (C1p * C2p === 0) {
    Hp = h1pn + h2pn;
  } else if (Math.abs(h1pn - h2pn) <= 180) {
    Hp = (h1pn + h2pn) / 2;
  } else {
    Hp = (h1pn + h2pn + (h1pn + h2pn < 360 ? 360 : -360)) / 2;
  }

  const T = 1
    - 0.17 * Math.cos((Hp - 30) * Math.PI / 180)
    + 0.24 * Math.cos((2 * Hp) * Math.PI / 180)
    + 0.32 * Math.cos((3 * Hp + 6) * Math.PI / 180)
    - 0.20 * Math.cos((4 * Hp - 63) * Math.PI / 180);

  const Lp50sq = (Lp - 50) ** 2;
  const SL = 1 + 0.015 * Lp50sq / Math.sqrt(20 + Lp50sq);
  const SC = 1 + 0.045 * Cp;
  const SH = 1 + 0.015 * Cp * T;
  const Cp7 = Cp ** 7;
  const RT = -2 * Math.sqrt(Cp7 / (Cp7 + 6103515625))
    * Math.sin(60 * Math.exp(-(((Hp - 275) / 25) ** 2)) * Math.PI / 180);

  return Math.sqrt(
    (dLp / SL) ** 2 +
    (dCp / SC) ** 2 +
    (dHp / SH) ** 2 +
    RT * (dCp / SC) * (dHp / SH)
  );
}

// ─── Otsu's Automatic Thresholding ──────────────────────────────
// Finds optimal threshold to separate bimodal distribution
// Reference: Nobuyuki Otsu (1979) — "A Threshold Selection Method from Gray-Level Histograms"
function otsuThreshold(values: Float32Array<ArrayBuffer>, count: number): number {
  // Build histogram (256 bins)
  const hist = new Float32Array(256);
  for (let i = 0; i < count; i++) {
    const bin = Math.max(0, Math.min(255, Math.round(values[i])));
    hist[bin]++;
  }
  // Normalize
  for (let i = 0; i < 256; i++) hist[i] /= count;

  // Find threshold that maximizes inter-class variance
  let bestThresh = 128;
  let bestVariance = 0;
  let w0 = 0, sum0 = 0;
  let totalMean = 0;
  for (let i = 0; i < 256; i++) totalMean += i * hist[i];

  for (let t = 0; t < 256; t++) {
    w0 += hist[t];
    if (w0 === 0) continue;
    const w1 = 1 - w0;
    if (w1 === 0) break;
    sum0 += t * hist[t];
    const mu0 = sum0 / w0;
    const mu1 = (totalMean - sum0) / w1;
    const variance = w0 * w1 * (mu0 - mu1) ** 2;
    if (variance > bestVariance) {
      bestVariance = variance;
      bestThresh = t;
    }
  }
  return bestThresh;
}

// ─── Bilateral Filter for Edge-Preserving Mask Smoothing ────────
// Reference: Tomasi & Manduchi 1998 — "Bilateral Filtering for Gray and Color Images"
// Preserves sharp mask edges while smoothing internal noise
function bilateralFilterMask(
  mask: Float32Array<ArrayBuffer>,
  w: number, h: number,
  spatialSigma: number,
  rangeSigma: number
): Float32Array<ArrayBuffer> {
  const out = new Float32Array(mask.length);
  const radius = Math.ceil(2 * spatialSigma);
  const spatialDenom = -2 * spatialSigma * spatialSigma;
  const rangeDenom = -2 * rangeSigma * rangeSigma;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      const center = mask[idx];
      let sum = 0, wSum = 0;
      for (let ky = -radius; ky <= radius; ky++) {
        const sy = y + ky;
        if (sy < 0 || sy >= h) continue;
        for (let kx = -radius; kx <= radius; kx++) {
          const sx = x + kx;
          if (sx < 0 || sx >= w) continue;
          const nIdx = sy * w + sx;
          const spatialW = Math.exp((kx * kx + ky * ky) / spatialDenom);
          const rangeW = Math.exp((mask[nIdx] - center) ** 2 / rangeDenom);
          const weight = spatialW * rangeW;
          sum += mask[nIdx] * weight;
          wSum += weight;
        }
      }
      out[idx] = wSum > 0 ? sum / wSum : center;
    }
  }
  return out;
}

// ─── Color Decontamination / Spill Removal ──────────────────────
// Removes background color "spill" from semi-transparent edge pixels
// Based on premultiplied alpha compositing: C_observed = α·C_fg + (1-α)·C_bg
// Solving for C_fg: C_fg = (C_observed - (1-α)·C_bg) / α
function decontaminateColors(
  data: Uint8ClampedArray,
  w: number, h: number,
  bgColor: RGBA,
  strength: number = 1.0
): void {
  const totalPixels = w * h;
  for (let idx = 0; idx < totalPixels; idx++) {
    const i = idx * 4;
    const alpha = data[i + 3] / 255;
    // Only process semi-transparent edge pixels (not fully opaque/transparent)
    if (alpha <= 0.02 || alpha >= 0.98) continue;
    const factor = Math.min(1, strength * (1 - alpha) * 2); // stronger effect at lower alpha
    for (let ch = 0; ch < 3; ch++) {
      const observed = data[i + ch];
      const bg = ch === 0 ? bgColor.r : ch === 1 ? bgColor.g : bgColor.b;
      // Estimate true foreground color
      const decontaminated = (observed - (1 - alpha) * bg) / Math.max(0.01, alpha);
      // Blend based on strength
      data[i + ch] = Math.max(0, Math.min(255, Math.round(
        observed + factor * (decontaminated - observed)
      )));
    }
  }
}

// ─── Multi-Component GMM (Gaussian Mixture Model) ───────────────
// K=5 components per class, each with mean, covariance, weight
// Based on GrabCut (Rother, Kolmogorov & Blake, SIGGRAPH 2004)
interface GMMComponent {
  mean: [number, number, number];       // RGB mean
  cov: [number, number, number,         // 3x3 covariance matrix (symmetric, stored as 6 unique)
        number, number, number];
  weight: number;                        // mixture weight
  count: number;
}

class GaussianMixtureModel {
  components: GMMComponent[];
  k: number;

  constructor(k: number = 5) {
    this.k = k;
    this.components = [];
    for (let i = 0; i < k; i++) {
      this.components.push({
        mean: [128, 128, 128],
        cov: [100, 0, 0, 100, 0, 100], // diagonal init
        weight: 1 / k,
        count: 0,
      });
    }
  }

  /** Assign pixel to the most likely component */
  assignComponent(r: number, g: number, b: number): number {
    let bestIdx = 0, bestScore = -Infinity;
    for (let c = 0; c < this.k; c++) {
      const comp = this.components[c];
      if (comp.weight < 1e-8) continue;
      const score = Math.log(comp.weight + 1e-10) - 0.5 * this.mahalanobis(r, g, b, comp);
      if (score > bestScore) {
        bestScore = score;
        bestIdx = c;
      }
    }
    return bestIdx;
  }

  /** Mahalanobis distance using diagonal approximation for numerical stability */
  private mahalanobis(r: number, g: number, b: number, comp: GMMComponent): number {
    const dr = r - comp.mean[0], dg = g - comp.mean[1], db = b - comp.mean[2];
    // Use diagonal for stability (full covariance inversion is fragile)
    const vr = Math.max(1, comp.cov[0]);
    const vg = Math.max(1, comp.cov[3]);
    const vb = Math.max(1, comp.cov[5]);
    return (dr * dr) / vr + (dg * dg) / vg + (db * db) / vb
      + Math.log(vr) + Math.log(vg) + Math.log(vb);
  }

  /** Probability of pixel belonging to this GMM */
  probability(r: number, g: number, b: number): number {
    let totalProb = 0;
    for (let c = 0; c < this.k; c++) {
      const comp = this.components[c];
      if (comp.weight < 1e-8) continue;
      const maha = this.mahalanobis(r, g, b, comp);
      totalProb += comp.weight * Math.exp(-0.5 * maha);
    }
    return totalProb;
  }

  /** Learn GMM parameters from assigned pixels */
  learn(
    data: Uint8ClampedArray,
    assignments: Int8Array,
    labels: Float32Array<ArrayBuffer>,
    w: number, h: number,
    classLabel: 'fg' | 'bg',
    threshold: number
  ): void {
    const totalPixels = w * h;
    // Reset accumulators
    for (let c = 0; c < this.k; c++) {
      this.components[c].count = 0;
      this.components[c].mean = [0, 0, 0];
      this.components[c].cov = [0, 0, 0, 0, 0, 0];
    }

    // Accumulate statistics per component
    for (let idx = 0; idx < totalPixels; idx++) {
      const inClass = classLabel === 'fg' ? labels[idx] > threshold : labels[idx] <= threshold;
      if (!inClass) continue;
      const ci = assignments[idx];
      if (ci < 0 || ci >= this.k) continue;
      const i = idx * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const comp = this.components[ci];
      comp.mean[0] += r; comp.mean[1] += g; comp.mean[2] += b;
      comp.count++;
    }

    let totalCount = 0;
    for (let c = 0; c < this.k; c++) {
      const comp = this.components[c];
      totalCount += comp.count;
      if (comp.count > 0) {
        comp.mean[0] /= comp.count;
        comp.mean[1] /= comp.count;
        comp.mean[2] /= comp.count;
      }
    }

    // Compute covariances
    for (let idx = 0; idx < totalPixels; idx++) {
      const inClass = classLabel === 'fg' ? labels[idx] > threshold : labels[idx] <= threshold;
      if (!inClass) continue;
      const ci = assignments[idx];
      if (ci < 0 || ci >= this.k) continue;
      const i = idx * 4;
      const dr = data[i] - this.components[ci].mean[0];
      const dg = data[i + 1] - this.components[ci].mean[1];
      const db = data[i + 2] - this.components[ci].mean[2];
      const comp = this.components[ci];
      comp.cov[0] += dr * dr; comp.cov[1] += dr * dg; comp.cov[2] += dr * db;
      comp.cov[3] += dg * dg; comp.cov[4] += dg * db;
      comp.cov[5] += db * db;
    }

    for (let c = 0; c < this.k; c++) {
      const comp = this.components[c];
      if (comp.count > 1) {
        for (let j = 0; j < 6; j++) comp.cov[j] /= comp.count;
        // Regularization: ensure positive definite
        comp.cov[0] = Math.max(5, comp.cov[0]);
        comp.cov[3] = Math.max(5, comp.cov[3]);
        comp.cov[5] = Math.max(5, comp.cov[5]);
      } else {
        comp.cov = [100, 0, 0, 100, 0, 100];
      }
      comp.weight = totalCount > 0 ? comp.count / totalCount : 1 / this.k;
    }
  }
}

// ─── Morphological Operations on Alpha Mask ─────────────────────
function erodeMask(mask: Float32Array<ArrayBuffer>, w: number, h: number, radius: number): Float32Array<ArrayBuffer> {
  const out = new Float32Array(mask.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let minVal = 255;
      for (let ky = -radius; ky <= radius; ky++) {
        for (let kx = -radius; kx <= radius; kx++) {
          const sx = Math.min(w - 1, Math.max(0, x + kx));
          const sy = Math.min(h - 1, Math.max(0, y + ky));
          minVal = Math.min(minVal, mask[sy * w + sx]);
        }
      }
      out[y * w + x] = minVal;
    }
  }
  return out;
}

function dilateMask(mask: Float32Array<ArrayBuffer>, w: number, h: number, radius: number): Float32Array<ArrayBuffer> {
  const out = new Float32Array(mask.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let maxVal = 0;
      for (let ky = -radius; ky <= radius; ky++) {
        for (let kx = -radius; kx <= radius; kx++) {
          const sx = Math.min(w - 1, Math.max(0, x + kx));
          const sy = Math.min(h - 1, Math.max(0, y + ky));
          maxVal = Math.max(maxVal, mask[sy * w + sx]);
        }
      }
      out[y * w + x] = maxVal;
    }
  }
  return out;
}

/** Morphological open (erode then dilate) — removes small foreground noise */
function morphOpen(mask: Float32Array<ArrayBuffer>, w: number, h: number, radius: number): Float32Array<ArrayBuffer> {
  return dilateMask(erodeMask(mask, w, h, radius), w, h, radius);
}

/** Morphological close (dilate then erode) — fills small holes in foreground */
function morphClose(mask: Float32Array<ArrayBuffer>, w: number, h: number, radius: number): Float32Array<ArrayBuffer> {
  return erodeMask(dilateMask(mask, w, h, radius), w, h, radius);
}

// ─── Guided Filter (Edge-Aware Alpha Refinement) ────────────────
// Based on He, Sun & Tang 2010 — "Guided Image Filtering"
// Standard technique used in OpenCV, Photoshop, GIMP for mask refinement
function guidedFilter(
  guide: Float32Array<ArrayBuffer>, // grayscale guide image (the original photo)
  src: Float32Array<ArrayBuffer>,   // input mask to refine
  w: number, h: number,
  radius: number,
  eps: number
): Float32Array<ArrayBuffer> {
  const size = w * h;
  const meanI = boxFilter(guide, w, h, radius);
  const meanP = boxFilter(src, w, h, radius);
  const corrIP = boxFilter(multiply(guide, src, size), w, h, radius);
  const corrII = boxFilter(multiply(guide, guide, size), w, h, radius);

  const a = new Float32Array(size);
  const b = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    const covIP = corrIP[i] - meanI[i] * meanP[i];
    const varI = corrII[i] - meanI[i] * meanI[i];
    a[i] = covIP / (varI + eps);
    b[i] = meanP[i] - a[i] * meanI[i];
  }

  const meanA = boxFilter(a, w, h, radius);
  const meanB = boxFilter(b, w, h, radius);
  const result = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    result[i] = Math.max(0, Math.min(255, meanA[i] * guide[i] + meanB[i]));
  }
  return result;
}

function multiply(a: Float32Array<ArrayBuffer>, b: Float32Array<ArrayBuffer>, size: number): Float32Array<ArrayBuffer> {
  const out = new Float32Array(size);
  for (let i = 0; i < size; i++) out[i] = a[i] * b[i];
  return out;
}

function boxFilter(src: Float32Array<ArrayBuffer>, w: number, h: number, r: number): Float32Array<ArrayBuffer> {
  const dst = new Float32Array(src.length);
  const tmp = new Float32Array(src.length);
  // Horizontal pass (integral image approach for O(1) per pixel)
  for (let y = 0; y < h; y++) {
    let sum = 0, count = 0;
    for (let x = 0; x < Math.min(r + 1, w); x++) { sum += src[y * w + x]; count++; }
    for (let x = 0; x < w; x++) {
      if (x + r + 1 < w) { sum += src[y * w + x + r + 1]; count++; }
      if (x - r > 0) { sum -= src[y * w + x - r - 1]; count--; }
      tmp[y * w + x] = sum / count;
    }
  }
  // Vertical pass
  for (let x = 0; x < w; x++) {
    let sum = 0, count = 0;
    for (let y = 0; y < Math.min(r + 1, h); y++) { sum += tmp[y * w + x]; count++; }
    for (let y = 0; y < h; y++) {
      if (y + r + 1 < h) { sum += tmp[(y + r + 1) * w + x]; count++; }
      if (y - r > 0) { sum -= tmp[(y - r - 1) * w + x]; count--; }
      dst[y * w + x] = sum / count;
    }
  }
  return dst;
}

// ─── Connected Component Noise Cleanup ──────────────────────────
function cleanSmallRegions(mask: Float32Array<ArrayBuffer>, w: number, h: number, minArea: number): Float32Array<ArrayBuffer> {
  const out = new Float32Array(mask) as Float32Array<ArrayBuffer>;
  const visited = new Uint8Array(w * h);
  const threshold = 128;

  // Clean both transparent islands inside foreground and foreground islands in background
  for (let pass = 0; pass < 2; pass++) {
    visited.fill(0);
    const checkFn = pass === 0
      ? (v: number) => v < threshold  // find small transparent holes
      : (v: number) => v >= threshold; // find small foreground specks

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        if (visited[idx] || !checkFn(out[idx])) continue;
        // BFS to find connected component
        const component: number[] = [];
        const queue: number[] = [idx];
        visited[idx] = 1;
        while (queue.length > 0) {
          const ci = queue.pop()!;
          component.push(ci);
          const cx = ci % w, cy = (ci - cx) / w;
          const neighbors = [
            cy > 0 ? ci - w : -1,
            cy < h - 1 ? ci + w : -1,
            cx > 0 ? ci - 1 : -1,
            cx < w - 1 ? ci + 1 : -1,
          ];
          for (const ni of neighbors) {
            if (ni >= 0 && !visited[ni] && checkFn(out[ni])) {
              visited[ni] = 1;
              queue.push(ni);
            }
          }
        }
        // If component is smaller than minArea, flip it
        if (component.length < minArea) {
          const fillVal = pass === 0 ? 255 : 0; // fill holes or remove specks
          for (const ci of component) out[ci] = fillVal;
        }
      }
    }
  }
  return out;
}

// ─── Edge Color Sampling with Median Clustering ─────────────────
function sampleEdgeColorClustered(data: Uint8ClampedArray, w: number, h: number): RGBA {
  const samples: RGBA[] = [];
  const step = Math.max(1, Math.floor(Math.min(w, h) / 80));

  // Sample from all 4 edges (multiple rows deep for robustness)
  for (let depth = 0; depth < 3; depth++) {
    for (let x = 0; x < w; x += step) {
      const topI = ((depth) * w + x) * 4;
      const botI = ((h - 1 - depth) * w + x) * 4;
      samples.push({ r: data[topI], g: data[topI + 1], b: data[topI + 2], a: 255 });
      samples.push({ r: data[botI], g: data[botI + 1], b: data[botI + 2], a: 255 });
    }
    for (let y = 0; y < h; y += step) {
      const leftI = (y * w + depth) * 4;
      const rightI = (y * w + w - 1 - depth) * 4;
      samples.push({ r: data[leftI], g: data[leftI + 1], b: data[leftI + 2], a: 255 });
      samples.push({ r: data[rightI], g: data[rightI + 1], b: data[rightI + 2], a: 255 });
    }
  }

  if (samples.length === 0) return { r: 255, g: 255, b: 255, a: 255 };

  // K-means clustering (k=3) to find the dominant cluster
  const k = Math.min(3, samples.length);
  const centers: RGBA[] = [];
  for (let i = 0; i < k; i++) {
    centers.push(samples[Math.floor(i * samples.length / k)]);
  }

  for (let iter = 0; iter < 8; iter++) {
    const clusters: RGBA[][] = centers.map(() => []);
    for (const s of samples) {
      let minD = Infinity, minIdx = 0;
      for (let c = 0; c < k; c++) {
        const d = colorDistance(s, centers[c]);
        if (d < minD) { minD = d; minIdx = c; }
      }
      clusters[minIdx].push(s);
    }
    for (let c = 0; c < k; c++) {
      if (clusters[c].length === 0) continue;
      const sum = clusters[c].reduce(
        (acc, p) => ({ r: acc.r + p.r, g: acc.g + p.g, b: acc.b + p.b, a: 255 }),
        { r: 0, g: 0, b: 0, a: 255 }
      );
      const n = clusters[c].length;
      centers[c] = { r: Math.round(sum.r / n), g: Math.round(sum.g / n), b: Math.round(sum.b / n), a: 255 };
    }
  }

  // Return the center of the largest cluster
  const clusterSizes = centers.map((c, i) =>
    samples.filter(s => {
      let minD = Infinity, minIdx = 0;
      for (let j = 0; j < k; j++) {
        const d = colorDistance(s, centers[j]);
        if (d < minD) { minD = d; minIdx = j; }
      }
      return minIdx === i;
    }).length
  );
  const largestIdx = clusterSizes.indexOf(Math.max(...clusterSizes));
  return centers[largestIdx];
}

// ─── Grayscale Guide from Image Data ────────────────────────────
function toGrayscaleGuide(data: Uint8ClampedArray, w: number, h: number): Float32Array<ArrayBuffer> {
  const gray = new Float32Array(w * h);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    gray[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  return gray;
}

// ─── Image → Canvas Helper ──────────────────────────────────────
export function imageToCanvas(img: HTMLImageElement): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
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

export function canvasToDataUrl(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL('image/png');
}

// ─── 1. Color-Based Background Removal (Chromakey) ─────────────
/**
 * Advanced background removal by color similarity.
 * Uses CIE Lab perceptual color distance, clustered edge sampling,
 * morphological cleanup, guided filter edge refinement, and
 * connected component noise removal.
 */
export async function colorBasedRemoveBg(
  imageSrc: string,
  options: {
    tolerance?: number;
    edgeSoftness?: number;
    sampleEdgePixels?: boolean;
    useLabColor?: boolean;
    morphRadius?: number;
    refineEdges?: boolean;
    cleanNoise?: boolean;
  } = {}
): Promise<string> {
  const {
    tolerance = 30,
    edgeSoftness = 2,
    sampleEdgePixels = true,
    useLabColor = true,
    morphRadius = 1,
    refineEdges = true,
    cleanNoise = true,
  } = options;
  const img = await loadImage(imageSrc);
  const { canvas, ctx } = imageToCanvas(img);
  const w = canvas.width, h = canvas.height;
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;

  // Step 1: Sample dominant background color with clustering
  const bgColor = sampleEdgePixels
    ? sampleEdgeColorClustered(data, w, h)
    : { r: data[0], g: data[1], b: data[2], a: 255 };

  // Step 2: Build alpha mask using perceptual color distance
  const labTolerance = useLabColor ? tolerance * 0.55 : tolerance;
  const featherRange = edgeSoftness * 12;
  let mask = new Float32Array(w * h);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const pixel: RGBA = { r: data[i], g: data[i + 1], b: data[i + 2], a: data[i + 3] };
      const dist = useLabColor ? deltaE76(pixel, bgColor) : colorDistance(pixel, bgColor);

      if (dist < labTolerance) {
        mask[y * w + x] = 0; // background
      } else if (dist < labTolerance + featherRange) {
        // Smooth cubic feathering (more natural than linear)
        const t = (dist - labTolerance) / featherRange;
        mask[y * w + x] = 255 * (t * t * (3 - 2 * t)); // smoothstep
      } else {
        mask[y * w + x] = 255; // foreground
      }
    }
  }

  // Step 3: Morphological cleanup — close small holes, open small noise
  if (morphRadius > 0) {
    mask = morphClose(mask, w, h, morphRadius); // fill tiny holes in foreground
    mask = morphOpen(mask, w, h, morphRadius);  // remove tiny foreground specks
  }

  // Step 4: Connected component analysis — remove small isolated regions
  if (cleanNoise) {
    const minArea = Math.max(50, Math.round(w * h * 0.0005));
    mask = cleanSmallRegions(mask, w, h, minArea);
  }

  // Step 5: Guided filter — edge-aware alpha refinement
  if (refineEdges) {
    const guide = toGrayscaleGuide(data, w, h);
    const gfRadius = Math.max(4, Math.round(Math.min(w, h) * 0.008));
    mask = guidedFilter(guide, mask, w, h, gfRadius, 1000);
  }

  // Apply refined mask to alpha channel
  for (let i = 0; i < w * h; i++) {
    data[i * 4 + 3] = Math.max(0, Math.min(255, Math.round(mask[i])));
  }

  ctx.putImageData(imageData, 0, 0);
  return canvasToDataUrl(canvas);
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

function convolveRGB(
  src: Uint8ClampedArray,
  width: number,
  height: number,
  kernel: number[],
  divisor = 1,
  bias = 0,
): Uint8ClampedArray {
  const dst = new Uint8ClampedArray(src.length);
  const kSize = Math.sqrt(kernel.length);
  const half = Math.floor(kSize / 2);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      const outIdx = (y * width + x) * 4;

      for (let ky = -half; ky <= half; ky++) {
        for (let kx = -half; kx <= half; kx++) {
          const sx = Math.min(width - 1, Math.max(0, x + kx));
          const sy = Math.min(height - 1, Math.max(0, y + ky));
          const srcIdx = (sy * width + sx) * 4;
          const kv = kernel[(ky + half) * kSize + (kx + half)];
          r += src[srcIdx] * kv;
          g += src[srcIdx + 1] * kv;
          b += src[srcIdx + 2] * kv;
        }
      }

      dst[outIdx] = Math.max(0, Math.min(255, Math.round(r / divisor + bias)));
      dst[outIdx + 1] = Math.max(0, Math.min(255, Math.round(g / divisor + bias)));
      dst[outIdx + 2] = Math.max(0, Math.min(255, Math.round(b / divisor + bias)));
      dst[outIdx + 3] = src[outIdx + 3];
    }
  }

  return dst;
}

export async function sobelEdgeDetect(
  imageSrc: string,
  options: { strength?: number; invert?: boolean } = {}
): Promise<string> {
  const { strength = 1, invert = false } = options;
  const img = await loadImage(imageSrc);
  const { canvas, ctx } = imageToCanvas(img);
  const w = canvas.width;
  const h = canvas.height;
  const imageData = ctx.getImageData(0, 0, w, h);
  const src = imageData.data;
  const gray = new Float32Array(w * h);

  for (let i = 0, p = 0; i < src.length; i += 4, p++) {
    gray[p] = 0.299 * src[i] + 0.587 * src[i + 1] + 0.114 * src[i + 2];
  }

  const gxK = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
  const gyK = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
  const out = new Uint8ClampedArray(src.length);
  const edgeScale = Math.max(0.2, Math.min(3, strength));

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      let gx = 0;
      let gy = 0;
      let k = 0;
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++, k++) {
          const v = gray[(y + ky) * w + (x + kx)];
          gx += v * gxK[k];
          gy += v * gyK[k];
        }
      }
      const mag = Math.min(255, Math.sqrt(gx * gx + gy * gy) * edgeScale);
      const value = invert ? 255 - mag : mag;
      const idx = (y * w + x) * 4;
      out[idx] = value;
      out[idx + 1] = value;
      out[idx + 2] = value;
      out[idx + 3] = src[idx + 3];
    }
  }

  imageData.data.set(out);
  ctx.putImageData(imageData, 0, 0);
  return canvasToDataUrl(canvas);
}

export async function medianDenoise(
  imageSrc: string,
  options: { radius?: number } = {}
): Promise<string> {
  const { radius = 1 } = options;
  const img = await loadImage(imageSrc);
  const { canvas, ctx } = imageToCanvas(img);
  const w = canvas.width;
  const h = canvas.height;
  const imageData = ctx.getImageData(0, 0, w, h);
  const src = imageData.data;
  const dst = new Uint8ClampedArray(src.length);
  const r = Math.max(1, Math.min(3, Math.round(radius)));

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const rs: number[] = [];
      const gs: number[] = [];
      const bs: number[] = [];
      for (let ky = -r; ky <= r; ky++) {
        for (let kx = -r; kx <= r; kx++) {
          const sx = Math.min(w - 1, Math.max(0, x + kx));
          const sy = Math.min(h - 1, Math.max(0, y + ky));
          const si = (sy * w + sx) * 4;
          rs.push(src[si]);
          gs.push(src[si + 1]);
          bs.push(src[si + 2]);
        }
      }
      rs.sort((a, b) => a - b);
      gs.sort((a, b) => a - b);
      bs.sort((a, b) => a - b);
      const mid = Math.floor(rs.length / 2);
      const di = (y * w + x) * 4;
      dst[di] = rs[mid];
      dst[di + 1] = gs[mid];
      dst[di + 2] = bs[mid];
      dst[di + 3] = src[di + 3];
    }
  }

  imageData.data.set(dst);
  ctx.putImageData(imageData, 0, 0);
  return canvasToDataUrl(canvas);
}

export async function posterizeImage(
  imageSrc: string,
  options: { levels?: number } = {}
): Promise<string> {
  const { levels = 6 } = options;
  const img = await loadImage(imageSrc);
  const { canvas, ctx } = imageToCanvas(img);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const steps = Math.max(2, Math.min(32, Math.round(levels)));
  const scale = 255 / (steps - 1);

  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.round((data[i] / 255) * (steps - 1)) * scale;
    data[i + 1] = Math.round((data[i + 1] / 255) * (steps - 1)) * scale;
    data[i + 2] = Math.round((data[i + 2] / 255) * (steps - 1)) * scale;
  }

  ctx.putImageData(imageData, 0, 0);
  return canvasToDataUrl(canvas);
}

export async function embossImage(imageSrc: string): Promise<string> {
  const img = await loadImage(imageSrc);
  const { canvas, ctx } = imageToCanvas(img);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const convolved = convolveRGB(
    imageData.data,
    canvas.width,
    canvas.height,
    [-2, -1, 0, -1, 1, 1, 0, 1, 2],
    1,
    128,
  );
  imageData.data.set(convolved);
  ctx.putImageData(imageData, 0, 0);
  return canvasToDataUrl(canvas);
}

export async function addFilmGrain(
  imageSrc: string,
  options: { amount?: number } = {}
): Promise<string> {
  const { amount = 0.08 } = options;
  const img = await loadImage(imageSrc);
  const { canvas, ctx } = imageToCanvas(img);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const amp = Math.max(0.01, Math.min(0.35, amount));

  for (let i = 0; i < data.length; i += 4) {
    const n = (Math.random() - 0.5) * 255 * amp;
    data[i] = Math.max(0, Math.min(255, data[i] + n));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + n));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + n));
  }

  ctx.putImageData(imageData, 0, 0);
  return canvasToDataUrl(canvas);
}

// ─── 11. Collage Layout Engine ──────────────────────────────────

// Canvas size presets for common aspect ratios
export const CANVAS_SIZE_PRESETS = [
  { label: '1:1 ריבוע', w: 1080, h: 1080 },
  { label: '4:5 פורטרט', w: 1080, h: 1350 },
  { label: '9:16 סטורי', w: 1080, h: 1920 },
  { label: '16:9 רחב', w: 1920, h: 1080 },
  { label: 'A4 הדפסה', w: 2480, h: 3508 },
];

/** Calculate optimal canvas height based on images and layout */
export function calcOptimalCanvasHeight(
  images: { width: number; height: number }[],
  canvasWidth: number,
  cols: number,
  gap: number
): number {
  if (images.length === 0) return canvasWidth;
  const cellW = (canvasWidth - gap * (cols + 1)) / cols;
  const rows = Math.ceil(images.length / cols);
  const avgRatio = images.reduce((sum, img) => sum + img.height / img.width, 0) / images.length;
  const cellH = cellW * avgRatio;
  return Math.round(rows * cellH + gap * (rows + 1));
}

export type CollageLayout = 'grid-2x2' | 'grid-3x3' | 'grid-2x3' | 'grid-3x2' | 'grid-4x4' | 'hero-side' | 'hero-top' | 'strip' | 'strip-vertical' | 'masonry' | 'pinterest' | 'diagonal' | 'l-shape' | 'featured-grid' | 't-shape' | 'mosaic' | 'golden-ratio' | 'magazine' | 'filmstrip' | 'big-small' | 'panoramic-stack' | 'focus-center' | 'checkerboard' | 'staircase' | 'frame-in-frame' | 'split-thirds' | 'zigzag' | 'asymmetric-columns' | 'triple-hero' | 'quad-focus' | 'cross' | 'diamond' | 'spiral' | 'ring' | 'center-strip' | 'offset-grid';

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

export interface CollageFrameControls {
  hue: number;
  thickness: number;
  style: number;
}

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
  fitMode?: 'cover' | 'contain' | 'smart-pad';
  frameStyle?: FrameStyle;
  textOverlays?: CollageTextOverlay[];
  bgGradient?: { from: string; to: string; angle: number };
  cellBgColors?: (string | null)[];
  watermark?: CollageWatermark;
  textureStyle?: 'none' | 'paper' | 'linen' | 'noise' | 'grain';
  imageScale?: number;
  frameInset?: number;
  pagePadding?: number;
  frameControls?: Partial<CollageFrameControls>;
}

export const COLLAGE_FONT_MAP: Record<string, string> = {
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
  // New fonts
  'hebrew-amatic': '"Amatic SC", cursive',
  'hebrew-secular': '"Secular One", sans-serif',
  'hebrew-suez': '"Suez One", serif',
  'hebrew-varela': '"Varela Round", sans-serif',
  'hebrew-karantina': '"Karantina", system-ui',
  'hebrew-noto': '"Noto Sans Hebrew", sans-serif',
  'hebrew-fredoka': '"Fredoka", sans-serif',
  'script-satisfy': '"Satisfy", cursive',
  'script-lobster': '"Lobster", cursive',
  'script-pacifico': '"Pacifico", cursive',
  'display-bebas': '"Bebas Neue", sans-serif',
  'display-abril': '"Abril Fatface", serif',
  'display-righteous': '"Righteous", sans-serif',
};

function drawFrameOnCell(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  style: FrameStyle,
  controls?: Partial<CollageFrameControls>
) {
  const hue = Math.max(0, Math.min(360, controls?.hue ?? 44));
  const thickness = Math.max(1, Math.min(24, controls?.thickness ?? 4));
  const styleFactor = Math.max(0, Math.min(100, controls?.style ?? 55)) / 100;
  const accent = `hsla(${hue}, ${65 + Math.round(styleFactor * 20)}%, ${45 + Math.round(styleFactor * 18)}%, 1)`;
  const accentLight = `hsla(${hue}, ${60 + Math.round(styleFactor * 20)}%, ${72 + Math.round(styleFactor * 14)}%, 1)`;
  const accentSoft = `hsla(${hue}, ${45 + Math.round(styleFactor * 25)}%, ${55 + Math.round(styleFactor * 10)}%, 0.55)`;

  ctx.save();
  switch (style) {
    case 'thin-gold': {
      const inset = Math.max(2, Math.round(thickness * 0.8));
      ctx.strokeStyle = accent;
      ctx.lineWidth = Math.max(1, Math.round(thickness * 0.8));
      ctx.strokeRect(x + inset, y + inset, w - inset * 2, h - inset * 2);
      break;
    }
    case 'double-gold': {
      const outerInset = Math.max(2, Math.round(thickness * 0.6));
      const innerInset = Math.max(outerInset + 4, Math.round(thickness * (1.5 + styleFactor)));
      ctx.strokeStyle = accent;
      ctx.lineWidth = Math.max(1, Math.round(thickness * 0.55));
      ctx.strokeRect(x + outerInset, y + outerInset, w - outerInset * 2, h - outerInset * 2);
      ctx.strokeStyle = accentLight;
      ctx.lineWidth = Math.max(1, Math.round(thickness * 0.45));
      ctx.strokeRect(x + innerInset, y + innerInset, w - innerInset * 2, h - innerInset * 2);
      break;
    }
    case 'luxury-dark': {
      ctx.strokeStyle = '#1a1a2e';
      ctx.lineWidth = Math.max(2, Math.round(thickness * 1.2));
      const outerInset = Math.max(1, Math.round(thickness * 0.3));
      ctx.strokeRect(x + outerInset, y + outerInset, w - outerInset * 2, h - outerInset * 2);
      const innerInset = Math.max(outerInset + 6, Math.round(thickness * (1.8 + styleFactor)));
      ctx.strokeStyle = accent;
      ctx.lineWidth = Math.max(1, Math.round(thickness * 0.35));
      ctx.strokeRect(x + innerInset, y + innerInset, w - innerInset * 2, h - innerInset * 2);
      break;
    }
    case 'ornate-corners': {
      const cs = Math.min(w, h) * (0.07 + styleFactor * 0.1);
      const inset = Math.max(2, Math.round(thickness * 0.6));
      ctx.strokeStyle = accent;
      ctx.lineWidth = Math.max(1, Math.round(thickness * 0.45));
      // Top-left
      ctx.beginPath(); ctx.moveTo(x + inset, y + cs + inset); ctx.lineTo(x + inset, y + inset); ctx.lineTo(x + cs + inset, y + inset); ctx.stroke();
      // Top-right
      ctx.beginPath(); ctx.moveTo(x + w - cs - inset, y + inset); ctx.lineTo(x + w - inset, y + inset); ctx.lineTo(x + w - inset, y + cs + inset); ctx.stroke();
      // Bottom-right
      ctx.beginPath(); ctx.moveTo(x + w - inset, y + h - cs - inset); ctx.lineTo(x + w - inset, y + h - inset); ctx.lineTo(x + w - cs - inset, y + h - inset); ctx.stroke();
      // Bottom-left
      ctx.beginPath(); ctx.moveTo(x + cs + inset, y + h - inset); ctx.lineTo(x + inset, y + h - inset); ctx.lineTo(x + inset, y + h - cs - inset); ctx.stroke();
      break;
    }
    case 'shadow-float': {
      const blur = Math.max(10, Math.round(thickness * (2 + styleFactor)));
      ctx.shadowColor = accentSoft;
      ctx.shadowBlur = blur;
      ctx.shadowOffsetX = Math.max(2, Math.round(thickness * 0.8));
      ctx.shadowOffsetY = Math.max(2, Math.round(thickness * 0.8));
      ctx.fillStyle = 'rgba(0,0,0,0.001)';
      ctx.fillRect(x, y, w, h);
      break;
    }
    case 'neon-glow': {
      const inset = Math.max(2, Math.round(thickness * 0.6));
      ctx.shadowColor = accentLight;
      ctx.shadowBlur = Math.max(6, Math.round(thickness * (1.8 + styleFactor)));
      ctx.strokeStyle = accentLight;
      ctx.lineWidth = Math.max(1, Math.round(thickness * 0.5));
      ctx.strokeRect(x + inset, y + inset, w - inset * 2, h - inset * 2);
      ctx.shadowBlur = 0;
      break;
    }
    case 'vintage-border': {
      const inset = Math.max(2, Math.round(thickness * 0.85));
      ctx.strokeStyle = accent;
      ctx.lineWidth = Math.max(1, Math.round(thickness * 0.65));
      const dashA = Math.max(6, Math.round(8 + styleFactor * 14));
      const dashB = Math.max(3, Math.round(3 + styleFactor * 8));
      ctx.setLineDash([dashA, dashB]);
      ctx.strokeRect(x + inset, y + inset, w - inset * 2, h - inset * 2);
      ctx.setLineDash([]);
      break;
    }
    case 'marble-edge': {
      const inset = Math.max(2, Math.round(thickness * 0.55));
      const grad = ctx.createLinearGradient(x, y, x + w, y + h);
      grad.addColorStop(0, accentLight);
      grad.addColorStop(0.5, accent);
      grad.addColorStop(1, accentLight);
      ctx.strokeStyle = grad;
      ctx.lineWidth = Math.max(2, Math.round(thickness * 0.9));
      ctx.strokeRect(x + inset, y + inset, w - inset * 2, h - inset * 2);
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
  const {
    layout,
    width,
    height,
    gap,
    bgColor,
    borderRadius,
    fitMode = 'contain',
    frameStyle = 'none',
    textOverlays = [],
    bgGradient,
    cellBgColors = [],
    watermark,
    textureStyle = 'none',
    imageScale = 1,
    frameInset = 0,
    pagePadding = 0,
    frameControls,
  } = options;
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

  if (textureStyle !== 'none') {
    drawCanvasTexture(ctx, width, height, textureStyle);
  }

  const loadedImages = await Promise.all(images.slice(0, getMaxImages(layout)).map(loadImage));
  const safePadding = Math.max(0, Math.min(pagePadding, Math.min(width, height) * 0.25));
  const innerW = Math.max(10, width - safePadding * 2);
  const innerH = Math.max(10, height - safePadding * 2);
  const rawCells = getCells(layout, innerW, innerH, gap, loadedImages.length);
  const cells = rawCells.map((cell) => ({ x: cell.x + safePadding, y: cell.y + safePadding, w: cell.w, h: cell.h }));

  for (let i = 0; i < Math.min(loadedImages.length, cells.length); i++) {
    const cell = cells[i];
    const img = loadedImages[i];
    const inset = Math.max(0, Math.min(frameInset, Math.min(cell.w, cell.h) * 0.35));
    const rx = cell.x + inset;
    const ry = cell.y + inset;
    const rw = Math.max(1, cell.w - inset * 2);
    const rh = Math.max(1, cell.h - inset * 2);
    const safeScale = Math.max(0.5, Math.min(imageScale, 2));

    ctx.save();
    if (borderRadius > 0) {
      roundedClip(ctx, rx, ry, rw, rh, borderRadius);
    }

    if (fitMode === 'contain' || fitMode === 'smart-pad') {
      const cellBg = cellBgColors[i] || bgColor;
      ctx.fillStyle = cellBg;
      ctx.fillRect(rx, ry, rw, rh);
      const imgRatio = img.width / img.height;
      const cellRatio = rw / rh;
      let dw: number, dh: number;
      if (fitMode === 'smart-pad') {
        // Smart-pad: scale to 90% of cell, always pad
        const padScale = 0.9;
        if (imgRatio > cellRatio) {
          dw = rw * padScale;
          dh = dw / imgRatio;
        } else {
          dh = rh * padScale;
          dw = dh * imgRatio;
        }
      } else if (imgRatio > cellRatio) {
        dw = rw;
        dh = rw / imgRatio;
      } else {
        dh = rh;
        dw = rh * imgRatio;
      }
      dw *= safeScale;
      dh *= safeScale;
      const dx = rx + (rw - dw) / 2;
      const dy = ry + (rh - dh) / 2;
      ctx.drawImage(img, 0, 0, img.width, img.height, dx, dy, dw, dh);
    } else {
      const imgRatio = img.width / img.height;
      const cellRatio = rw / rh;
      let sx = 0, sy = 0, sw = img.width, sh = img.height;
      if (imgRatio > cellRatio) {
        sw = img.height * cellRatio;
        sx = (img.width - sw) / 2;
      } else {
        sh = img.width / cellRatio;
        sy = (img.height - sh) / 2;
      }
      const dw = rw * safeScale;
      const dh = rh * safeScale;
      const dx = rx + (rw - dw) / 2;
      const dy = ry + (rh - dh) / 2;
      ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
    }
    ctx.restore();

    // Frame on each cell
    if (frameStyle && frameStyle !== 'none') {
      drawFrameOnCell(ctx, rx, ry, rw, rh, frameStyle, frameControls);
    }
  }

  // Text overlays
  for (const overlay of textOverlays) {
    drawCollageTextOverlay(ctx, overlay, width, height);
  }

  // Watermark
  if (watermark) {
    await drawCollageWatermark(ctx, watermark, width, height);
  }

  return canvasToDataUrl(canvas);
}

function drawCanvasTexture(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  style: 'paper' | 'linen' | 'noise' | 'grain'
) {
  ctx.save();
  switch (style) {
    case 'paper': {
      for (let i = 0; i < 800; i++) {
        ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`;
        ctx.fillRect(Math.random() * width, Math.random() * height, 1, 1);
      }
      break;
    }
    case 'linen': {
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1;
      for (let y = 0; y < height; y += 6) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
      for (let x = 0; x < width; x += 8) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      break;
    }
    case 'noise': {
      for (let i = 0; i < 1500; i++) {
        const alpha = Math.random() * 0.12;
        const shade = Math.floor(150 + Math.random() * 100);
        ctx.fillStyle = `rgba(${shade},${shade},${shade},${alpha})`;
        ctx.fillRect(Math.random() * width, Math.random() * height, 1.3, 1.3);
      }
      break;
    }
    case 'grain': {
      for (let i = 0; i < 1200; i++) {
        ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.06})`;
        ctx.fillRect(Math.random() * width, Math.random() * height, 1, 1);
      }
      ctx.fillStyle = 'rgba(255,255,255,0.03)';
      ctx.fillRect(0, 0, width, height);
      break;
    }
  }
  ctx.restore();
}

async function drawCollageWatermark(
  ctx: CanvasRenderingContext2D,
  wm: CollageWatermark,
  canvasW: number,
  canvasH: number
) {
  ctx.save();
  ctx.globalAlpha = wm.opacity;

  if (wm.type === 'text' && wm.text) {
    const fontSize = wm.fontSize || Math.round(canvasW * wm.scale * 0.5);
    const fontFace = COLLAGE_FONT_MAP[wm.fontFamily || 'hebrew-modern'] || COLLAGE_FONT_MAP['hebrew-modern'];
    ctx.font = `700 ${fontSize}px ${fontFace}`;
    ctx.fillStyle = wm.color || 'rgba(255,255,255,0.5)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (wm.repeat) {
      // Tiled watermark
      const stepX = canvasW / 3;
      const stepY = canvasH / 3;
      ctx.rotate(((wm.rotation || -30) * Math.PI) / 180);
      for (let y = -canvasH * 0.5; y < canvasH * 1.5; y += stepY) {
        for (let x = -canvasW * 0.5; x < canvasW * 1.5; x += stepX) {
          ctx.fillText(wm.text, x, y);
        }
      }
    } else {
      const { px, py } = getWatermarkPosition(wm.position, canvasW, canvasH, fontSize);
      if (wm.rotation) {
        ctx.translate(px, py);
        ctx.rotate((wm.rotation * Math.PI) / 180);
        ctx.fillText(wm.text, 0, 0);
      } else {
        ctx.fillText(wm.text, px, py);
      }
    }
  } else if (wm.type === 'image' && wm.imageSrc) {
    try {
      const img = await loadImage(wm.imageSrc);
      const maxDim = canvasW * wm.scale;
      const ratio = Math.min(maxDim / img.width, maxDim / img.height);
      const iw = img.width * ratio;
      const ih = img.height * ratio;

      if (wm.repeat) {
        const stepX = iw * 2;
        const stepY = ih * 2;
        for (let y = 0; y < canvasH; y += stepY) {
          for (let x = 0; x < canvasW; x += stepX) {
            ctx.drawImage(img, x, y, iw, ih);
          }
        }
      } else {
        const { px, py } = getWatermarkPosition(wm.position, canvasW, canvasH, Math.max(iw, ih));
        ctx.drawImage(img, px - iw / 2, py - ih / 2, iw, ih);
      }
    } catch {
      // silently fail if image can't load
    }
  }

  ctx.restore();
}

function getWatermarkPosition(position: CollageWatermark['position'], w: number, h: number, size: number) {
  const margin = size * 0.5;
  switch (position) {
    case 'top-left': return { px: margin + size / 2, py: margin };
    case 'top-right': return { px: w - margin - size / 2, py: margin };
    case 'bottom-left': return { px: margin + size / 2, py: h - margin };
    case 'bottom-right': return { px: w - margin - size / 2, py: h - margin };
    case 'center': default: return { px: w / 2, py: h / 2 };
  }
}

function getMaxImages(layout: CollageLayout): number {
  switch (layout) {
    case 'grid-2x2': return 4;
    case 'grid-3x3': return 9;
    case 'grid-2x3': return 6;
    case 'grid-3x2': return 6;
    case 'grid-4x4': return 16;
    case 'masonry': return 6;
    case 'hero-side': return 3;
    case 'hero-top': return 4;
    case 'strip': return 5;
    case 'strip-vertical': return 5;
    case 'pinterest': return 6;
    case 'diagonal': return 4;
    case 'l-shape': return 5;
    case 'featured-grid': return 5;
    case 't-shape': return 4;
    case 'mosaic': return 5;
    case 'golden-ratio': return 3;
    case 'magazine': return 4;
    case 'filmstrip': return 6;
    case 'big-small': return 5;
    case 'panoramic-stack': return 3;
    case 'focus-center': return 5;
    case 'checkerboard': return 5;
    case 'staircase': return 4;
    case 'frame-in-frame': return 2;
    case 'split-thirds': return 4;
    case 'zigzag': return 5;
    case 'asymmetric-columns': return 5;
    case 'triple-hero': return 3;
    case 'quad-focus': return 4;
    case 'cross': return 5;
    case 'diamond': return 5;
    case 'spiral': return 6;
    case 'ring': return 6;
    case 'center-strip': return 5;
    case 'offset-grid': return 6;
    default: return 9;
  }
}

interface Cell { x: number; y: number; w: number; h: number }

function getCells(layout: CollageLayout, W: number, H: number, gap: number, count: number): Cell[] {
  const cells: Cell[] = [];

  const gridLayout = (cols: number, rows: number) => {
    const cw = (W - gap * (cols + 1)) / cols;
    const ch = (H - gap * (rows + 1)) / rows;
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        cells.push({ x: gap + c * (cw + gap), y: gap + r * (ch + gap), w: cw, h: ch });
  };

  switch (layout) {
    case 'grid-2x2': gridLayout(2, 2); break;
    case 'grid-3x3': gridLayout(3, 3); break;
    case 'grid-2x3': gridLayout(2, 3); break;
    case 'grid-3x2': gridLayout(3, 2); break;
    case 'grid-4x4': gridLayout(4, 4); break;

    case 'hero-side': {
      const heroW = W * 0.6 - gap * 1.5;
      const sideW = W * 0.4 - gap * 1.5;
      cells.push({ x: gap, y: gap, w: heroW, h: H - gap * 2 });
      const sideH = (H - gap * 3) / 2;
      cells.push({ x: heroW + gap * 2, y: gap, w: sideW, h: sideH });
      cells.push({ x: heroW + gap * 2, y: sideH + gap * 2, w: sideW, h: sideH });
      break;
    }
    case 'hero-top': {
      const heroH = H * 0.55 - gap;
      const bottomH = H * 0.45 - gap;
      cells.push({ x: gap, y: gap, w: W - gap * 2, h: heroH });
      const n = Math.min(count - 1, 3);
      if (n > 0) {
        const cw = (W - gap * (n + 1)) / n;
        for (let i = 0; i < n; i++)
          cells.push({ x: gap + i * (cw + gap), y: heroH + gap * 2, w: cw, h: bottomH - gap });
      }
      break;
    }
    case 'strip': {
      const n = Math.min(count, 5);
      const cw = (W - gap * (n + 1)) / n;
      for (let i = 0; i < n; i++)
        cells.push({ x: gap + i * (cw + gap), y: gap, w: cw, h: H - gap * 2 });
      break;
    }
    case 'strip-vertical': {
      const n = Math.min(count, 5);
      const ch = (H - gap * (n + 1)) / n;
      for (let i = 0; i < n; i++)
        cells.push({ x: gap, y: gap + i * (ch + gap), w: W - gap * 2, h: ch });
      break;
    }
    case 'masonry': {
      const cols = 3;
      const colW = (W - gap * (cols + 1)) / cols;
      const colHeights = new Array(cols).fill(gap);
      for (let i = 0; i < Math.min(count, 6); i++) {
        const col = colHeights.indexOf(Math.min(...colHeights));
        const cellH = colW * (0.8 + Math.random() * 0.6);
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
    case 'diagonal': {
      const n = Math.min(count, 4);
      const cellW = W * 0.55;
      const cellH = H * 0.55;
      const stepX = (W - cellW) / Math.max(n - 1, 1);
      const stepY = (H - cellH) / Math.max(n - 1, 1);
      for (let i = 0; i < n; i++)
        cells.push({ x: stepX * i, y: stepY * i, w: cellW, h: cellH });
      break;
    }
    case 'l-shape': {
      // Big top-left, 2 right, 2 bottom
      const mainW = W * 0.6 - gap;
      const mainH = H * 0.6 - gap;
      const sideW = W * 0.4 - gap;
      const botH = H * 0.4 - gap;
      cells.push({ x: gap, y: gap, w: mainW, h: mainH });
      cells.push({ x: mainW + gap * 2, y: gap, w: sideW - gap, h: mainH / 2 - gap / 2 });
      cells.push({ x: mainW + gap * 2, y: gap + mainH / 2 + gap / 2, w: sideW - gap, h: mainH / 2 - gap / 2 });
      const n = Math.min(count - 3, 2);
      const bw = (mainW - (n > 1 ? gap : 0)) / Math.max(n, 1);
      for (let i = 0; i < n; i++)
        cells.push({ x: gap + i * (bw + gap), y: mainH + gap * 2, w: bw, h: botH - gap });
      break;
    }
    case 'featured-grid': {
      // Large featured image left spanning full height, 2x2 grid right
      const featW = W * 0.5 - gap;
      cells.push({ x: gap, y: gap, w: featW, h: H - gap * 2 });
      const gridW = W * 0.5 - gap * 2;
      const cw = (gridW - gap) / 2;
      const ch = (H - gap * 3) / 2;
      const ox = featW + gap * 2;
      cells.push({ x: ox, y: gap, w: cw, h: ch });
      cells.push({ x: ox + cw + gap, y: gap, w: cw, h: ch });
      cells.push({ x: ox, y: ch + gap * 2, w: cw, h: ch });
      cells.push({ x: ox + cw + gap, y: ch + gap * 2, w: cw, h: ch });
      break;
    }

    // ─── Advanced Layouts ───
    case 't-shape': {
      // Wide top spanning full width, 3 equal columns below
      const topH = H * 0.45 - gap;
      const botH = H * 0.55 - gap;
      cells.push({ x: gap, y: gap, w: W - gap * 2, h: topH });
      const n = Math.min(count - 1, 3);
      if (n > 0) {
        const cw2 = (W - gap * (n + 1)) / n;
        for (let i = 0; i < n; i++)
          cells.push({ x: gap + i * (cw2 + gap), y: topH + gap * 2, w: cw2, h: botH - gap });
      }
      break;
    }
    case 'mosaic': {
      // Large top-left, medium right, 2 small bottom
      const bigW = W * 0.6 - gap * 1.5;
      const bigH = H * 0.6 - gap * 1.5;
      const smallW = W * 0.4 - gap * 1.5;
      const smallH = H * 0.4 - gap * 1.5;
      cells.push({ x: gap, y: gap, w: bigW, h: bigH });
      cells.push({ x: bigW + gap * 2, y: gap, w: smallW, h: bigH });
      const bottomN = Math.min(count - 2, 3);
      if (bottomN > 0) {
        const bw = (W - gap * (bottomN + 1)) / bottomN;
        for (let i = 0; i < bottomN; i++)
          cells.push({ x: gap + i * (bw + gap), y: bigH + gap * 2, w: bw, h: smallH });
      }
      break;
    }
    case 'golden-ratio': {
      // Golden ratio: left 61.8%, right 38.2% split vertically
      const phi = 0.618;
      const leftW = (W - gap * 3) * phi;
      const rightW = (W - gap * 3) * (1 - phi);
      cells.push({ x: gap, y: gap, w: leftW, h: H - gap * 2 });
      const rh = (H - gap * 3) / 2;
      cells.push({ x: leftW + gap * 2, y: gap, w: rightW, h: rh });
      cells.push({ x: leftW + gap * 2, y: rh + gap * 2, w: rightW, h: rh });
      break;
    }
    case 'magazine': {
      // Editorial: top row split 60/40, bottom row split 40/60
      const topH2 = (H - gap * 3) / 2;
      const botH2 = topH2;
      const w1 = (W - gap * 3) * 0.6;
      const w2 = (W - gap * 3) * 0.4;
      cells.push({ x: gap, y: gap, w: w1, h: topH2 });
      cells.push({ x: w1 + gap * 2, y: gap, w: w2, h: topH2 });
      cells.push({ x: gap, y: topH2 + gap * 2, w: w2, h: botH2 });
      cells.push({ x: w2 + gap * 2, y: topH2 + gap * 2, w: w1, h: botH2 });
      break;
    }
    case 'filmstrip': {
      // Cinema filmstrip: equal cells with 3:2 aspect ratio feel
      const n = Math.min(count, 6);
      const padding = H * 0.1;
      const innerH = H - padding * 2;
      const cw3 = (W - gap * (n + 1)) / n;
      for (let i = 0; i < n; i++)
        cells.push({ x: gap + i * (cw3 + gap), y: padding, w: cw3, h: innerH });
      break;
    }
    case 'big-small': {
      // One large image top (70%), row of small at bottom (30%)
      const bigH2 = H * 0.7 - gap * 1.5;
      const smallH2 = H * 0.3 - gap * 1.5;
      cells.push({ x: gap, y: gap, w: W - gap * 2, h: bigH2 });
      const n = Math.min(count - 1, 4);
      if (n > 0) {
        const cw4 = (W - gap * (n + 1)) / n;
        for (let i = 0; i < n; i++)
          cells.push({ x: gap + i * (cw4 + gap), y: bigH2 + gap * 2, w: cw4, h: smallH2 });
      }
      break;
    }

    // ─── Special Layouts ───
    case 'panoramic-stack': {
      // 3 wide panoramic rows
      const n = Math.min(count, 3);
      const ch2 = (H - gap * (n + 1)) / n;
      for (let i = 0; i < n; i++)
        cells.push({ x: gap, y: gap + i * (ch2 + gap), w: W - gap * 2, h: ch2 });
      break;
    }
    case 'focus-center': {
      // Large center image + 4 small corners
      const margin = W * 0.18;
      const centerW = W - margin * 2 - gap * 2;
      const centerH = H - margin * 2 - gap * 2;
      cells.push({ x: margin + gap, y: margin + gap, w: centerW, h: centerH });
      const cornerW = margin - gap;
      const cornerH = margin - gap;
      cells.push({ x: gap, y: gap, w: cornerW, h: cornerH });
      cells.push({ x: W - cornerW - gap, y: gap, w: cornerW, h: cornerH });
      cells.push({ x: gap, y: H - cornerH - gap, w: cornerW, h: cornerH });
      cells.push({ x: W - cornerW - gap, y: H - cornerH - gap, w: cornerW, h: cornerH });
      break;
    }
    case 'checkerboard': {
      // 3x3 checkerboard with only odd cells filled
      const cw5 = (W - gap * 4) / 3;
      const ch3 = (H - gap * 4) / 3;
      const positions = [[0,0],[1,1],[2,0],[0,2],[2,2]];
      for (let i = 0; i < Math.min(count, 5); i++) {
        const [c, r] = positions[i];
        cells.push({ x: gap + c * (cw5 + gap), y: gap + r * (ch3 + gap), w: cw5, h: ch3 });
      }
      break;
    }
    case 'staircase': {
      // Stepped descending layout
      const n = Math.min(count, 4);
      const stepW = (W - gap * 2) * 0.55;
      const stepH = (H - gap * (n + 1)) / n;
      const xStep = (W - stepW - gap * 2) / Math.max(n - 1, 1);
      for (let i = 0; i < n; i++)
        cells.push({ x: gap + xStep * i, y: gap + i * (stepH + gap), w: stepW, h: stepH });
      break;
    }
    case 'frame-in-frame': {
      // Full background + centered inset
      cells.push({ x: gap, y: gap, w: W - gap * 2, h: H - gap * 2 });
      const insetW = W * 0.5;
      const insetH = H * 0.5;
      cells.push({ x: (W - insetW) / 2, y: (H - insetH) / 2, w: insetW, h: insetH });
      break;
    }
    case 'split-thirds': {
      // Left 1/3 tall, right 2/3 split into 3 rows
      const leftW2 = (W - gap * 3) / 3;
      const rightW2 = (W - gap * 3) * 2 / 3;
      cells.push({ x: gap, y: gap, w: leftW2, h: H - gap * 2 });
      const rn = Math.min(count - 1, 3);
      if (rn > 0) {
        const rh2 = (H - gap * (rn + 1)) / rn;
        for (let i = 0; i < rn; i++)
          cells.push({ x: leftW2 + gap * 2, y: gap + i * (rh2 + gap), w: rightW2, h: rh2 });
      }
      break;
    }
    case 'zigzag': {
      const n = Math.min(count, 5);
      const cw = (W - gap * (n + 1)) / n;
      const ch = H * 0.6;
      const topY = gap;
      const bottomY = H - ch - gap;
      for (let i = 0; i < n; i++) {
        cells.push({ x: gap + i * (cw + gap), y: i % 2 === 0 ? topY : bottomY, w: cw, h: ch });
      }
      break;
    }
    case 'asymmetric-columns': {
      const totalW = W - gap * 4;
      const wA = totalW * 0.5;
      const wB = totalW * 0.2;
      const wC = totalW * 0.3;
      const hTop = (H - gap * 3) * 0.6;
      const hBottom = (H - gap * 3) * 0.4;
      cells.push({ x: gap, y: gap, w: wA, h: H - gap * 2 });
      cells.push({ x: gap + wA + gap, y: gap, w: wB, h: hTop });
      cells.push({ x: gap + wA + gap, y: gap + hTop + gap, w: wB, h: hBottom });
      cells.push({ x: gap + wA + wB + gap * 2, y: gap, w: wC, h: hBottom });
      cells.push({ x: gap + wA + wB + gap * 2, y: gap + hBottom + gap, w: wC, h: hTop });
      break;
    }
    case 'triple-hero': {
      const topH = (H - gap * 3) * 0.65;
      const botH = (H - gap * 3) * 0.35;
      const halfW = (W - gap * 3) / 2;
      cells.push({ x: gap, y: gap, w: halfW, h: topH });
      cells.push({ x: gap + halfW + gap, y: gap, w: halfW, h: topH });
      cells.push({ x: gap, y: gap + topH + gap, w: W - gap * 2, h: botH });
      break;
    }
    case 'quad-focus': {
      const centerW = (W - gap * 3) * 0.6;
      const centerH = (H - gap * 3) * 0.6;
      const sideW = ((W - gap * 3) - centerW) / 2;
      const sideH = ((H - gap * 3) - centerH) / 2;
      cells.push({ x: gap + sideW, y: gap + sideH, w: centerW, h: centerH });
      cells.push({ x: gap, y: gap, w: sideW, h: sideH });
      cells.push({ x: gap + sideW + centerW + gap, y: gap, w: sideW, h: sideH });
      cells.push({ x: gap + sideW + centerW + gap, y: gap + sideH + centerH + gap, w: sideW, h: sideH });
      break;
    }
    case 'cross': {
      const cw = (W - gap * 4) / 3;
      const ch = (H - gap * 4) / 3;
      cells.push({ x: gap + cw + gap, y: gap + ch + gap, w: cw, h: ch });
      cells.push({ x: gap + cw + gap, y: gap, w: cw, h: ch });
      cells.push({ x: gap + cw + gap, y: gap + (ch + gap) * 2, w: cw, h: ch });
      cells.push({ x: gap, y: gap + ch + gap, w: cw, h: ch });
      cells.push({ x: gap + (cw + gap) * 2, y: gap + ch + gap, w: cw, h: ch });
      break;
    }
    case 'diamond': {
      const cW = W * 0.44;
      const cH = H * 0.44;
      const cX = (W - cW) / 2;
      const cY = (H - cH) / 2;
      const sW = W * 0.24;
      const sH = H * 0.24;
      cells.push({ x: cX, y: cY, w: cW, h: cH });
      cells.push({ x: (W - sW) / 2, y: gap, w: sW, h: sH });
      cells.push({ x: W - sW - gap, y: (H - sH) / 2, w: sW, h: sH });
      cells.push({ x: (W - sW) / 2, y: H - sH - gap, w: sW, h: sH });
      cells.push({ x: gap, y: (H - sH) / 2, w: sW, h: sH });
      break;
    }
    case 'spiral': {
      const n = Math.min(count, 6);
      const rects: Cell[] = [
        { x: gap, y: gap, w: (W - gap * 3) * 0.62, h: (H - gap * 3) * 0.62 },
        { x: (W - gap * 3) * 0.62 + gap * 2, y: gap, w: (W - gap * 3) * 0.38, h: (H - gap * 3) * 0.38 },
        { x: (W - gap * 3) * 0.62 + gap * 2, y: (H - gap * 3) * 0.38 + gap * 2, w: (W - gap * 3) * 0.26, h: (H - gap * 3) * 0.24 },
        { x: (W - gap * 3) * 0.62 + gap * 2, y: (H - gap * 3) * 0.62 + gap * 2, w: (W - gap * 3) * 0.38, h: (H - gap * 3) * 0.38 },
        { x: (W - gap * 3) * 0.36 + gap, y: (H - gap * 3) * 0.62 + gap * 2, w: (W - gap * 3) * 0.26, h: (H - gap * 3) * 0.38 },
        { x: gap, y: (H - gap * 3) * 0.62 + gap * 2, w: (W - gap * 3) * 0.36, h: (H - gap * 3) * 0.24 },
      ];
      for (let i = 0; i < n; i++) cells.push(rects[i]);
      break;
    }
    case 'ring': {
      const n = Math.min(count, 6);
      const rW = (W - gap * 5) / 3;
      const rH = (H - gap * 5) / 3;
      const positions = [[1,0],[2,1],[1,2],[0,2],[0,1],[0,0]];
      for (let i = 0; i < n; i++) {
        const [cx, cy] = positions[i];
        cells.push({ x: gap + cx * (rW + gap), y: gap + cy * (rH + gap), w: rW, h: rH });
      }
      break;
    }
    case 'center-strip': {
      const stripH = (H - gap * 4) * 0.45;
      const topBottomH = ((H - gap * 4) - stripH) / 2;
      const halfW = (W - gap * 3) / 2;
      cells.push({ x: gap, y: gap + topBottomH + gap, w: W - gap * 2, h: stripH });
      cells.push({ x: gap, y: gap, w: halfW, h: topBottomH });
      cells.push({ x: gap + halfW + gap, y: gap, w: halfW, h: topBottomH });
      cells.push({ x: gap, y: gap + topBottomH + stripH + gap * 2, w: halfW, h: topBottomH });
      cells.push({ x: gap + halfW + gap, y: gap + topBottomH + stripH + gap * 2, w: halfW, h: topBottomH });
      break;
    }
    case 'offset-grid': {
      const cols = 3;
      const rows = 2;
      const cw = (W - gap * (cols + 1)) / cols;
      const ch = (H - gap * (rows + 1)) / rows;
      let idx = 0;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (idx >= Math.min(count, 6)) break;
          const yOffset = c % 2 === 0 ? 0 : ch * 0.12;
          cells.push({ x: gap + c * (cw + gap), y: gap + r * (ch + gap) + yOffset, w: cw, h: ch - yOffset });
          idx++;
        }
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
 * Advanced white/light background removal optimized for e-commerce.
 * Uses luminance + saturation analysis, morphological cleanup,
 * guided filter edge refinement, and connected component noise removal.
 */
export async function removeWhiteBg(
  imageSrc: string,
  options: {
    threshold?: number;
    feather?: number;
    morphRadius?: number;
    refineEdges?: boolean;
    cleanNoise?: boolean;
  } = {}
): Promise<string> {
  const {
    threshold = 240,
    feather = 15,
    morphRadius = 1,
    refineEdges = true,
    cleanNoise = true,
  } = options;
  const img = await loadImage(imageSrc);
  const { canvas, ctx } = imageToCanvas(img);
  const w = canvas.width, h = canvas.height;
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;

  // Step 1: Build alpha mask based on luminance + saturation
  let mask = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
      const saturation = (Math.max(r, g, b) - Math.min(r, g, b)) / 255;

      if (luminance > threshold && saturation < 0.15) {
        mask[y * w + x] = 0;
      } else if (luminance > threshold - feather && saturation < 0.25) {
        const t = (threshold - luminance) / feather;
        // Smoothstep feathering
        const s = Math.max(0, Math.min(1, t));
        mask[y * w + x] = 255 * (s * s * (3 - 2 * s));
      } else {
        mask[y * w + x] = 255;
      }
    }
  }

  // Step 2: Morphological cleanup
  if (morphRadius > 0) {
    mask = morphClose(mask, w, h, morphRadius);
    mask = morphOpen(mask, w, h, morphRadius);
  }

  // Step 3: Connected component noise cleanup
  if (cleanNoise) {
    const minArea = Math.max(50, Math.round(w * h * 0.0005));
    mask = cleanSmallRegions(mask, w, h, minArea);
  }

  // Step 4: Guided filter edge refinement
  if (refineEdges) {
    const guide = toGrayscaleGuide(data, w, h);
    const gfRadius = Math.max(4, Math.round(Math.min(w, h) * 0.008));
    mask = guidedFilter(guide, mask, w, h, gfRadius, 800);
  }

  // Apply mask
  for (let i = 0; i < w * h; i++) {
    data[i * 4 + 3] = Math.max(0, Math.min(255, Math.round(mask[i])));
  }

  ctx.putImageData(imageData, 0, 0);
  return canvasToDataUrl(canvas);
}

// ─── Image Splitting ──────────────────────────────────────────────
export type SplitMode = 'grid' | 'instagram' | 'free';

export interface SplitOptions {
  mode: SplitMode;
  cols: number;
  rows: number;
  // Instagram: number of slides (cols=slides, rows=1, aspect 4:5 or 1:1)
  instagramAspect?: '1:1' | '4:5' | '16:9';
  // Free: custom regions as percentages [x%, y%, w%, h%]
  regions?: { x: number; y: number; w: number; h: number }[];
}

export async function splitImage(imageSrc: string, options: SplitOptions): Promise<string[]> {
  const img = await loadImage(imageSrc);
  const results: string[] = [];

  if (options.mode === 'grid') {
    const cellW = Math.floor(img.width / options.cols);
    const cellH = Math.floor(img.height / options.rows);
    for (let r = 0; r < options.rows; r++) {
      for (let c = 0; c < options.cols; c++) {
        const canvas = document.createElement('canvas');
        canvas.width = cellW;
        canvas.height = cellH;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, c * cellW, r * cellH, cellW, cellH, 0, 0, cellW, cellH);
        results.push(canvasToDataUrl(canvas));
      }
    }
  } else if (options.mode === 'instagram') {
    const slides = options.cols || 3;
    const aspectMap: Record<string, number> = { '1:1': 1, '4:5': 5 / 4, '16:9': 9 / 16 };
    const aspectRatio = aspectMap[options.instagramAspect || '1:1'] || 1;
    // Each slide has width = totalWidth / slides, height by aspect
    const slideW = Math.floor(img.width / slides);
    const slideH = Math.floor(slideW * aspectRatio);
    // Center vertically
    const yOffset = Math.max(0, Math.floor((img.height - slideH) / 2));
    for (let i = 0; i < slides; i++) {
      const canvas = document.createElement('canvas');
      canvas.width = slideW;
      canvas.height = Math.min(slideH, img.height);
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, i * slideW, yOffset, slideW, Math.min(slideH, img.height), 0, 0, slideW, canvas.height);
      results.push(canvasToDataUrl(canvas));
    }
  } else if (options.mode === 'free' && options.regions) {
    for (const region of options.regions) {
      const sx = Math.floor((region.x / 100) * img.width);
      const sy = Math.floor((region.y / 100) * img.height);
      const sw = Math.floor((region.w / 100) * img.width);
      const sh = Math.floor((region.h / 100) * img.height);
      const canvas = document.createElement('canvas');
      canvas.width = sw;
      canvas.height = sh;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
      results.push(canvasToDataUrl(canvas));
    }
  }

  return results;
}

// ─── 13. Smart Background Removal (Comprehensive Non-AI) ───────
/**
 * Most advanced non-AI background removal. Combines:
 * 1. CIEDE2000 perceptual color distance (state-of-the-art)
 * 2. Multi-component GMM (K=5) for FG/BG classification (GrabCut-inspired)
 * 3. Otsu's automatic threshold for optimal mask binarization
 * 4. Morphological operations for mask cleanup
 * 5. Bilateral filter for edge-preserving mask smoothing
 * 6. Guided filter for edge-aware alpha matting
 * 7. Connected component analysis for noise removal
 * 8. Color decontamination / spill removal at semi-transparent edges
 *
 * Best results on product photos with relatively uniform backgrounds.
 */
export type SmartBgMode = 'auto' | 'white' | 'color' | 'gradient';

export async function smartRemoveBg(
  imageSrc: string,
  options: {
    mode?: SmartBgMode;
    sensitivity?: number;     // 0-100, how aggressively to remove bg
    edgeDetail?: number;      // 0-100, edge refinement quality
    noiseClean?: number;      // 0-100, small region cleanup aggressiveness
    morphStrength?: number;   // 0-3, morphological radius
    foregroundBoost?: boolean; // boost foreground contrast at edges
    useDE2000?: boolean;      // use CIEDE2000 instead of Delta E76 (slower but more accurate)
    spillRemoval?: number;    // 0-100, color decontamination strength
    autoThreshold?: boolean;  // use Otsu's automatic thresholding
    bilateralSmooth?: number; // 0-100, bilateral filter smoothing
  } = {}
): Promise<string> {
  const {
    mode = 'auto',
    sensitivity = 50,
    edgeDetail = 70,
    noiseClean = 50,
    morphStrength = 1,
    foregroundBoost = true,
    useDE2000 = true,
    spillRemoval = 60,
    autoThreshold = true,
    bilateralSmooth = 30,
  } = options;

  const img = await loadImage(imageSrc);
  const { canvas, ctx } = imageToCanvas(img);
  const w = canvas.width, h = canvas.height;
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;
  const totalPixels = w * h;

  // ── Phase 1: Analyze background type ──
  const bgColor = sampleEdgeColorClustered(data, w, h);
  const bgLuminance = 0.299 * bgColor.r + 0.587 * bgColor.g + 0.114 * bgColor.b;

  const detectedMode = mode === 'auto'
    ? (bgLuminance > 220 ? 'white'
       : analyzeGradientBackground(data, w, h) ? 'gradient'
       : 'color')
    : mode;

  // Choose color distance function
  const colorDist = useDE2000 ? deltaE2000 : deltaE76;

  // ── Phase 2: Build initial confidence mask ──
  const confidence = new Float32Array(totalPixels);
  const toleranceScale = 1 + (50 - sensitivity) / 50;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      const i = idx * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const pixel: RGBA = { r, g, b, a: 255 };

      let bgScore: number;

      if (detectedMode === 'white') {
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        const sat = (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
        const whiteThresh = 220 * toleranceScale;
        if (lum > whiteThresh && sat < 0.12 * toleranceScale) {
          bgScore = 0;
        } else if (lum > whiteThresh - 25 && sat < 0.22 * toleranceScale) {
          bgScore = ((whiteThresh - lum) / 25) * 0.5;
        } else {
          bgScore = 1;
        }
      } else if (detectedMode === 'gradient') {
        const localBg = estimateLocalBgColor(data, w, h, x, y);
        const dE = colorDist(pixel, localBg);
        const thresh = 18 * toleranceScale;
        bgScore = Math.min(1, Math.max(0, (dE - thresh * 0.5) / (thresh * 0.8)));
      } else {
        const dE = colorDist(pixel, bgColor);
        const thresh = 16 * toleranceScale;
        bgScore = Math.min(1, Math.max(0, (dE - thresh * 0.6) / (thresh * 0.6)));
      }

      confidence[idx] = bgScore * 255;
    }
  }

  // ── Phase 2.5: Otsu auto-threshold for initial mask ──
  let mask = new Float32Array(confidence);
  if (autoThreshold) {
    const otsuThresh = otsuThreshold(mask, totalPixels);
    // Remap mask using Otsu threshold for better initial separation
    for (let idx = 0; idx < totalPixels; idx++) {
      if (mask[idx] < otsuThresh * 0.6) mask[idx] = Math.min(mask[idx], 40);
      else if (mask[idx] > otsuThresh * 1.3) mask[idx] = Math.max(mask[idx], 220);
    }
  }

  // ── Phase 3: Multi-component GMM refinement ──
  const fgGMM = new GaussianMixtureModel(5);
  const bgGMM = new GaussianMixtureModel(5);
  const assignments = new Int8Array(totalPixels);

  for (let iter = 0; iter < 5; iter++) {
    const gmmThreshold = autoThreshold ? otsuThreshold(mask, totalPixels) : 128;

    // Assign pixels to GMM components
    for (let idx = 0; idx < totalPixels; idx++) {
      const i = idx * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      if (mask[idx] > gmmThreshold) {
        assignments[idx] = fgGMM.assignComponent(r, g, b) as unknown as number;
      } else {
        assignments[idx] = bgGMM.assignComponent(r, g, b) as unknown as number;
      }
    }

    // Learn GMM parameters from assignments
    fgGMM.learn(data, assignments, mask, w, h, 'fg', gmmThreshold);
    bgGMM.learn(data, assignments, mask, w, h, 'bg', gmmThreshold);

    // Reclassify unknown pixels using GMM probabilities
    for (let idx = 0; idx < totalPixels; idx++) {
      if (mask[idx] >= 40 && mask[idx] <= 215) {
        const i = idx * 4;
        const r = data[i], g = data[i + 1], b = data[i + 2];
        const fgProb = fgGMM.probability(r, g, b);
        const bgProb = bgGMM.probability(r, g, b);
        const ratio = fgProb / (fgProb + bgProb + 1e-10);
        mask[idx] = 255 * ratio;
      }
    }
  }

  // ── Phase 4: Morphological operations ──
  const mRadius = Math.max(0, Math.min(3, Math.round(morphStrength)));
  if (mRadius > 0) {
    mask = morphClose(mask, w, h, mRadius);
    mask = morphOpen(mask, w, h, mRadius);
  }

  // ── Phase 4.5: Bilateral filter for edge-preserving smooth ──
  if (bilateralSmooth > 0) {
    const spatialSigma = 1 + bilateralSmooth / 25; // 1-5
    const rangeSigma = 20 + bilateralSmooth * 0.8;  // 20-100
    mask = bilateralFilterMask(mask, w, h, spatialSigma, rangeSigma);
  }

  // ── Phase 5: Connected component noise removal ──
  if (noiseClean > 0) {
    const minArea = Math.max(20, Math.round(totalPixels * (noiseClean / 10000)));
    mask = cleanSmallRegions(mask, w, h, minArea);
  }

  // ── Phase 6: Guided filter edge refinement ──
  if (edgeDetail > 0) {
    const guide = toGrayscaleGuide(data, w, h);
    const gfRadius = Math.max(2, Math.round(Math.min(w, h) * (edgeDetail / 8000)));
    const eps = 2000 - edgeDetail * 18;
    mask = guidedFilter(guide, mask, w, h, gfRadius, Math.max(100, eps));

    if (foregroundBoost) {
      for (let idx = 0; idx < totalPixels; idx++) {
        if (mask[idx] > 20 && mask[idx] < 235) {
          const t = mask[idx] / 255;
          const boosted = 1 / (1 + Math.exp(-12 * (t - 0.5)));
          mask[idx] = 255 * boosted;
        }
      }
    }
  }

  // ── Phase 7: Apply mask ──
  for (let i = 0; i < totalPixels; i++) {
    data[i * 4 + 3] = Math.max(0, Math.min(255, Math.round(mask[i])));
  }

  // ── Phase 8: Color decontamination / spill removal ──
  if (spillRemoval > 0) {
    decontaminateColors(data, w, h, bgColor, spillRemoval / 100);
  }

  ctx.putImageData(imageData, 0, 0);
  return canvasToDataUrl(canvas);
}

/** Check if background has a gradient pattern */
function analyzeGradientBackground(data: Uint8ClampedArray, w: number, h: number): boolean {
  // Sample colors from corners and center of edges
  const corners = [
    { x: 2, y: 2 },
    { x: w - 3, y: 2 },
    { x: 2, y: h - 3 },
    { x: w - 3, y: h - 3 },
  ];
  const colors = corners.map(({ x, y }) => {
    const i = (y * w + x) * 4;
    return { r: data[i], g: data[i + 1], b: data[i + 2], a: 255 } as RGBA;
  });
  // If corners differ significantly, it's likely a gradient
  let maxDist = 0;
  for (let i = 0; i < colors.length; i++) {
    for (let j = i + 1; j < colors.length; j++) {
      maxDist = Math.max(maxDist, deltaE76(colors[i], colors[j]));
    }
  }
  return maxDist > 12 && maxDist < 60; // gradient has variation but not extreme
}

/** Estimate local bg color for gradient backgrounds via bilinear interpolation of corners */
function estimateLocalBgColor(data: Uint8ClampedArray, w: number, h: number, px: number, py: number): RGBA {
  const sample = (x: number, y: number) => {
    const cx = Math.min(w - 1, Math.max(0, x));
    const cy = Math.min(h - 1, Math.max(0, y));
    const i = (cy * w + cx) * 4;
    return { r: data[i], g: data[i + 1], b: data[i + 2], a: 255 };
  };
  // Sample from multiple edge depths
  const tl = sample(2, 2), tr = sample(w - 3, 2);
  const bl = sample(2, h - 3), br = sample(w - 3, h - 3);
  const tx = px / w, ty = py / h;
  const top = { r: tl.r + (tr.r - tl.r) * tx, g: tl.g + (tr.g - tl.g) * tx, b: tl.b + (tr.b - tl.b) * tx };
  const bot = { r: bl.r + (br.r - bl.r) * tx, g: bl.g + (br.g - bl.g) * tx, b: bl.b + (br.b - bl.b) * tx };
  return {
    r: Math.round(top.r + (bot.r - top.r) * ty),
    g: Math.round(top.g + (bot.g - top.g) * ty),
    b: Math.round(top.b + (bot.b - top.b) * ty),
    a: 255,
  };
}
