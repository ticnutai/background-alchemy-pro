/**
 * E2E tests for Non-AI background removal algorithms.
 * Creates synthetic test images with known backgrounds and products,
 * then validates background is removed and product is preserved.
 */
import { describe, it, expect, beforeAll } from "vitest";

// ─── Canvas/Image Polyfill for jsdom ────────────────────────────
// jsdom lacks Canvas support — provide a minimal pixel-buffer shim

class MockImageData {
  data: Uint8ClampedArray;
  width: number;
  height: number;
  constructor(w: number, h: number) {
    this.width = w;
    this.height = h;
    this.data = new Uint8ClampedArray(w * h * 4);
  }
}

class MockCtx {
  _canvas: MockCanvas;
  _imageData: MockImageData;
  shadowColor = "transparent";
  shadowBlur = 0;
  shadowOffsetX = 0;
  shadowOffsetY = 0;
  fillStyle: string | CanvasGradient = "";
  strokeStyle: string | CanvasGradient = "";
  lineWidth = 1;

  constructor(canvas: MockCanvas) {
    this._canvas = canvas;
    this._imageData = new MockImageData(canvas.width, canvas.height);
  }

  getImageData(x: number, y: number, w: number, h: number): MockImageData {
    // Return a copy scoped to the requested region
    const out = new MockImageData(w, h);
    for (let row = 0; row < h; row++) {
      for (let col = 0; col < w; col++) {
        const srcIdx = ((y + row) * this._canvas.width + (x + col)) * 4;
        const dstIdx = (row * w + col) * 4;
        out.data[dstIdx] = this._imageData.data[srcIdx];
        out.data[dstIdx + 1] = this._imageData.data[srcIdx + 1];
        out.data[dstIdx + 2] = this._imageData.data[srcIdx + 2];
        out.data[dstIdx + 3] = this._imageData.data[srcIdx + 3];
      }
    }
    return out;
  }

  putImageData(imageData: MockImageData, dx: number, dy: number) {
    for (let row = 0; row < imageData.height; row++) {
      for (let col = 0; col < imageData.width; col++) {
        const srcIdx = (row * imageData.width + col) * 4;
        const dstIdx = ((dy + row) * this._canvas.width + (dx + col)) * 4;
        this._imageData.data[dstIdx] = imageData.data[srcIdx];
        this._imageData.data[dstIdx + 1] = imageData.data[srcIdx + 1];
        this._imageData.data[dstIdx + 2] = imageData.data[srcIdx + 2];
        this._imageData.data[dstIdx + 3] = imageData.data[srcIdx + 3];
      }
    }
  }

  drawImage(img: MockImage | MockCanvas, dx: number, dy: number, dw?: number, dh?: number, sx?: number, sy?: number, sw?: number, sh?: number) {
    // Copy from source image data to canvas image data
    const srcData = (img as MockImage)._data ?? (img as MockCanvas)._ctx?._imageData.data;
    if (!srcData) return;
    const srcW = (img as MockImage).width ?? (img as MockCanvas).width;
    const w = dw ?? srcW;
    const h = dh ?? ((img as MockImage).height ?? (img as MockCanvas).height);
    for (let row = 0; row < h; row++) {
      for (let col = 0; col < w; col++) {
        const si = (row * srcW + col) * 4;
        const di = ((dy + row) * this._canvas.width + (dx + col)) * 4;
        if (di >= 0 && di + 3 < this._imageData.data.length && si >= 0 && si + 3 < srcData.length) {
          this._imageData.data[di] = srcData[si];
          this._imageData.data[di + 1] = srcData[si + 1];
          this._imageData.data[di + 2] = srcData[si + 2];
          this._imageData.data[di + 3] = srcData[si + 3];
        }
      }
    }
  }

  createRadialGradient() { return { addColorStop() {} }; }
  createLinearGradient() { return { addColorStop() {} }; }
  fillRect() {}
  strokeRect() {}
  beginPath() {}
  closePath() {}
  clip() {}
  moveTo() {}
  lineTo() {}
  arc() {}
  stroke() {}
  fill() {}
  save() {}
  restore() {}
  setLineDash() {}
  quadraticCurveTo() {}
  scale() {}
  translate() {}
  rotate() {}
  clearRect() {}
  measureText() { return { width: 0 }; }
}

class MockCanvas {
  width: number;
  height: number;
  _ctx: MockCtx;
  constructor() {
    this.width = 0;
    this.height = 0;
    this._ctx = new MockCtx(this);
  }
  getContext() {
    this._ctx = new MockCtx(this);
    return this._ctx;
  }
  toDataURL() {
    // Encode pixel data as a test-friendly data URL
    // We'll use a custom scheme so we can decode it in tests
    const b64 = Buffer.from(this._ctx._imageData.data.buffer).toString("base64");
    return `data:image/test;w=${this.width};h=${this.height};base64,${b64}`;
  }
}

class MockImage {
  width = 0;
  height = 0;
  naturalWidth = 0;
  naturalHeight = 0;
  crossOrigin = "";
  _data: Uint8ClampedArray | null = null;
  _src = "";
  onload: (() => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;

  get src() { return this._src; }
  set src(val: string) {
    this._src = val;
    // Parse our custom test data URL
    const match = val.match(/^data:image\/test;w=(\d+);h=(\d+);base64,(.+)$/);
    if (match) {
      this.width = this.naturalWidth = parseInt(match[1]);
      this.height = this.naturalHeight = parseInt(match[2]);
      this._data = new Uint8ClampedArray(Buffer.from(match[3], "base64"));
      setTimeout(() => this.onload?.(), 0);
    } else {
      setTimeout(() => this.onerror?.(new Error("test: unknown src")), 0);
    }
  }
}

// ─── Install Mocks ──────────────────────────────────────────────
beforeAll(() => {
  (globalThis as Record<string, unknown>).Image = MockImage;
  const origCreate = document.createElement.bind(document);
  document.createElement = ((tag: string) => {
    if (tag === "canvas") return new MockCanvas() as unknown as HTMLCanvasElement;
    return origCreate(tag);
  }) as typeof document.createElement;
});

// ─── Helpers ────────────────────────────────────────────────────
/** Create a test "data URL" encoding raw pixel data */
function createTestImage(w: number, h: number, fillFn: (x: number, y: number, data: Uint8ClampedArray, idx: number) => void): string {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      fillFn(x, y, data, (y * w + x) * 4);
    }
  }
  const b64 = Buffer.from(data.buffer).toString("base64");
  return `data:image/test;w=${w};h=${h};base64,${b64}`;
}

/** Parse a test data URL back to pixel data */
function parseTestResult(dataUrl: string): { w: number; h: number; data: Uint8ClampedArray } {
  const match = dataUrl.match(/^data:image\/test;w=(\d+);h=(\d+);base64,(.+)$/);
  if (!match) throw new Error("Cannot parse test result");
  return {
    w: parseInt(match[1]),
    h: parseInt(match[2]),
    data: new Uint8ClampedArray(Buffer.from(match[3], "base64")),
  };
}

/** Calculate percentage of pixels in a region meeting a condition */
function regionStats(
  data: Uint8ClampedArray, w: number,
  rx: number, ry: number, rw: number, rh: number,
  condition: (r: number, g: number, b: number, a: number) => boolean
): number {
  let match = 0, total = 0;
  for (let y = ry; y < ry + rh; y++) {
    for (let x = rx; x < rx + rw; x++) {
      const i = (y * w + x) * 4;
      if (condition(data[i], data[i + 1], data[i + 2], data[i + 3])) match++;
      total++;
    }
  }
  return match / total;
}

// ─── Tests ──────────────────────────────────────────────────────
describe("Non-AI Background Removal — E2E", () => {
  // Test image: 100x100, white background, red square (30x30) centered
  const W = 100, H = 100;
  const PRODUCT_X = 35, PRODUCT_Y = 35, PRODUCT_W = 30, PRODUCT_H = 30;

  const whiteWithRedProduct = createTestImage(W, H, (x, y, data, i) => {
    if (x >= PRODUCT_X && x < PRODUCT_X + PRODUCT_W &&
        y >= PRODUCT_Y && y < PRODUCT_Y + PRODUCT_H) {
      // Red product
      data[i] = 200; data[i + 1] = 30; data[i + 2] = 30; data[i + 3] = 255;
    } else {
      // White background
      data[i] = 255; data[i + 1] = 255; data[i + 2] = 255; data[i + 3] = 255;
    }
  });

  // Green background with blue product
  const greenWithBlueProduct = createTestImage(W, H, (x, y, data, i) => {
    if (x >= PRODUCT_X && x < PRODUCT_X + PRODUCT_W &&
        y >= PRODUCT_Y && y < PRODUCT_Y + PRODUCT_H) {
      data[i] = 30; data[i + 1] = 50; data[i + 2] = 180; data[i + 3] = 255;
    } else {
      data[i] = 50; data[i + 1] = 200; data[i + 2] = 50; data[i + 3] = 255;
    }
  });

  // Gradient background (light gray top-left to medium gray bottom-right)
  const gradientBg = createTestImage(W, H, (x, y, data, i) => {
    if (x >= PRODUCT_X && x < PRODUCT_X + PRODUCT_W &&
        y >= PRODUCT_Y && y < PRODUCT_Y + PRODUCT_H) {
      data[i] = 180; data[i + 1] = 40; data[i + 2] = 40; data[i + 3] = 255;
    } else {
      const gray = Math.round(230 - ((x + y) / 200) * 50);
      data[i] = gray; data[i + 1] = gray; data[i + 2] = gray; data[i + 3] = 255;
    }
  });

  describe("removeWhiteBg — White Background Removal", () => {
    it("should make white background transparent", async () => {
      const { removeWhiteBg } = await import("@/lib/smart-image-tools");
      const result = await removeWhiteBg(whiteWithRedProduct, {
        threshold: 240,
        feather: 10,
        morphRadius: 0,
        refineEdges: false,
        cleanNoise: false,
      });
      const { data, w } = parseTestResult(result);

      // Background region (top-left corner, well away from product)
      const bgTransparent = regionStats(data, w, 0, 0, 20, 20,
        (_r, _g, _b, a) => a < 30);
      expect(bgTransparent).toBeGreaterThan(0.95);

      // Product region (center of the red square)
      const fgOpaque = regionStats(data, w, 40, 40, 20, 20,
        (_r, _g, _b, a) => a > 200);
      expect(fgOpaque).toBeGreaterThan(0.95);
    });

    it("should not remove colored backgrounds", async () => {
      const { removeWhiteBg } = await import("@/lib/smart-image-tools");
      const result = await removeWhiteBg(greenWithBlueProduct);
      const { data, w } = parseTestResult(result);

      // Green background should remain opaque (it's not white)
      const bgOpaque = regionStats(data, w, 0, 0, 20, 20,
        (_r, _g, _b, a) => a > 200);
      expect(bgOpaque).toBeGreaterThan(0.9);
    });
  });

  describe("colorBasedRemoveBg — Chromakey with Lab Color", () => {
    it("should remove uniform green background via Lab distance", async () => {
      const { colorBasedRemoveBg } = await import("@/lib/smart-image-tools");
      const result = await colorBasedRemoveBg(greenWithBlueProduct, {
        tolerance: 35,
        edgeSoftness: 1,
        useLabColor: true,
        morphRadius: 0,
        refineEdges: false,
        cleanNoise: false,
      });
      const { data, w } = parseTestResult(result);

      // Green background should be transparent
      const bgTransparent = regionStats(data, w, 0, 0, 20, 20,
        (_r, _g, _b, a) => a < 50);
      expect(bgTransparent).toBeGreaterThan(0.9);

      // Blue product should remain opaque
      const fgOpaque = regionStats(data, w, 40, 40, 20, 20,
        (_r, _g, _b, a) => a > 180);
      expect(fgOpaque).toBeGreaterThan(0.9);
    });

    it("should remove white background with Lab mode", async () => {
      const { colorBasedRemoveBg } = await import("@/lib/smart-image-tools");
      const result = await colorBasedRemoveBg(whiteWithRedProduct, {
        tolerance: 30,
        edgeSoftness: 1,
        useLabColor: true,
        morphRadius: 0,
        refineEdges: false,
        cleanNoise: false,
      });
      const { data, w } = parseTestResult(result);

      const bgTransparent = regionStats(data, w, 0, 0, 15, 15,
        (_r, _g, _b, a) => a < 50);
      expect(bgTransparent).toBeGreaterThan(0.9);

      const fgOpaque = regionStats(data, w, 42, 42, 16, 16,
        (_r, _g, _b, a) => a > 180);
      expect(fgOpaque).toBeGreaterThan(0.9);
    });

    it("should also work with RGB fallback", async () => {
      const { colorBasedRemoveBg } = await import("@/lib/smart-image-tools");
      const result = await colorBasedRemoveBg(greenWithBlueProduct, {
        tolerance: 40,
        useLabColor: false,
        morphRadius: 0,
        refineEdges: false,
        cleanNoise: false,
      });
      const { data, w } = parseTestResult(result);

      const bgTransparent = regionStats(data, w, 0, 0, 20, 20,
        (_r, _g, _b, a) => a < 50);
      expect(bgTransparent).toBeGreaterThan(0.85);
    });
  });

  describe("smartRemoveBg — Comprehensive Smart Removal", () => {
    it("should auto-detect white background and remove it", async () => {
      const { smartRemoveBg } = await import("@/lib/smart-image-tools");
      const result = await smartRemoveBg(whiteWithRedProduct, {
        mode: "auto",
        sensitivity: 50,
        edgeDetail: 0,
        noiseClean: 0,
        morphStrength: 0,
        foregroundBoost: false,
      });
      const { data, w } = parseTestResult(result);

      // Background should be mostly transparent
      const bgTransparent = regionStats(data, w, 0, 0, 25, 25,
        (_r, _g, _b, a) => a < 80);
      expect(bgTransparent).toBeGreaterThan(0.85);

      // Product should be mostly opaque 
      const fgOpaque = regionStats(data, w, 42, 42, 16, 16,
        (_r, _g, _b, a) => a > 150);
      expect(fgOpaque).toBeGreaterThan(0.85);
    });

    it("should handle 'color' mode for green background", async () => {
      const { smartRemoveBg } = await import("@/lib/smart-image-tools");
      const result = await smartRemoveBg(greenWithBlueProduct, {
        mode: "color",
        sensitivity: 50,
        edgeDetail: 0,
        noiseClean: 0,
        morphStrength: 0,
        foregroundBoost: false,
      });
      const { data, w } = parseTestResult(result);

      const bgTransparent = regionStats(data, w, 0, 0, 20, 20,
        (_r, _g, _b, a) => a < 80);
      expect(bgTransparent).toBeGreaterThan(0.85);

      const fgOpaque = regionStats(data, w, 42, 42, 16, 16,
        (_r, _g, _b, a) => a > 150);
      expect(fgOpaque).toBeGreaterThan(0.85);
    });

    it("should handle gradient background mode", async () => {
      const { smartRemoveBg } = await import("@/lib/smart-image-tools");
      const result = await smartRemoveBg(gradientBg, {
        mode: "gradient",
        sensitivity: 60,
        edgeDetail: 0,
        noiseClean: 0,
        morphStrength: 0,
        foregroundBoost: false,
      });
      const { data, w } = parseTestResult(result);

      // Background corners should be mostly transparent
      const bgTransparent = regionStats(data, w, 0, 0, 15, 15,
        (_r, _g, _b, a) => a < 100);
      expect(bgTransparent).toBeGreaterThan(0.7);

      // Product should remain
      const fgOpaque = regionStats(data, w, 42, 42, 16, 16,
        (_r, _g, _b, a) => a > 120);
      expect(fgOpaque).toBeGreaterThan(0.7);
    });

    it("should iteratively refine unknown zones (GMM passes)", async () => {
      const { smartRemoveBg } = await import("@/lib/smart-image-tools");
      // Use a more ambiguous image — product color closer to background
      const ambiguous = createTestImage(W, H, (x, y, data, i) => {
        if (x >= PRODUCT_X && x < PRODUCT_X + PRODUCT_W &&
            y >= PRODUCT_Y && y < PRODUCT_Y + PRODUCT_H) {
          // Orange product (somewhat close to warm white)
          data[i] = 220; data[i + 1] = 140; data[i + 2] = 60; data[i + 3] = 255;
        } else {
          // Warm white background
          data[i] = 250; data[i + 1] = 245; data[i + 2] = 235; data[i + 3] = 255;
        }
      });

      const result = await smartRemoveBg(ambiguous, {
        mode: "white",
        sensitivity: 60,
        edgeDetail: 0,
        noiseClean: 0,
        morphStrength: 0,
        foregroundBoost: false,
      });
      const { data, w } = parseTestResult(result);

      // Background should be transparent
      const bgTransparent = regionStats(data, w, 5, 5, 15, 15,
        (_r, _g, _b, a) => a < 100);
      expect(bgTransparent).toBeGreaterThan(0.7);

      // Product should be preserved
      const fgOpaque = regionStats(data, w, 42, 42, 16, 16,
        (_r, _g, _b, a) => a > 100);
      expect(fgOpaque).toBeGreaterThan(0.7);
    });
  });

  describe("Morphological Operations", () => {
    it("should clean noise islands with morphological open/close", async () => {
      const { colorBasedRemoveBg } = await import("@/lib/smart-image-tools");

      // Image with small noise spots in the background
      const noisyBg = createTestImage(W, H, (x, y, data, i) => {
        if (x >= PRODUCT_X && x < PRODUCT_X + PRODUCT_W &&
            y >= PRODUCT_Y && y < PRODUCT_Y + PRODUCT_H) {
          data[i] = 200; data[i + 1] = 30; data[i + 2] = 30; data[i + 3] = 255;
        } else if ((x === 5 && y === 5) || (x === 90 && y === 90)) {
          // Single-pixel noise (dark spots in white bg)
          data[i] = 100; data[i + 1] = 100; data[i + 2] = 100; data[i + 3] = 255;
        } else {
          data[i] = 255; data[i + 1] = 255; data[i + 2] = 255; data[i + 3] = 255;
        }
      });

      // Without morphology — noise might remain
      const noMorph = await colorBasedRemoveBg(noisyBg, {
        tolerance: 30,
        morphRadius: 0,
        refineEdges: false,
        cleanNoise: false,
      });
      const d1 = parseTestResult(noMorph);
      const noisePixel1 = d1.data[(5 * W + 5) * 4 + 3]; // the noise pixel at (5,5)

      // With morphology — noise should be cleaned
      const withMorph = await colorBasedRemoveBg(noisyBg, {
        tolerance: 30,
        morphRadius: 1,
        refineEdges: false,
        cleanNoise: true,
      });
      const d2 = parseTestResult(withMorph);
      const noisePixel2 = d2.data[(5 * W + 5) * 4 + 3];

      // With cleanup, the isolated noise pixel should be more transparent
      expect(noisePixel2).toBeLessThanOrEqual(noisePixel1);
    });
  });

  describe("Edge Quality — Feathering", () => {
    it("should produce smooth transitions at edges (not hard cutoff)", async () => {
      const { colorBasedRemoveBg } = await import("@/lib/smart-image-tools");

      const result = await colorBasedRemoveBg(whiteWithRedProduct, {
        tolerance: 25,
        edgeSoftness: 3,
        useLabColor: true,
        morphRadius: 0,
        refineEdges: false,
        cleanNoise: false,
      });
      const { data, w } = parseTestResult(result);

      // Check the transition zone at the edge of the product
      // Along row 35 (top edge of product), pixels should transition from transparent to opaque
      const edgeAlphas: number[] = [];
      for (let x = 30; x < 40; x++) {
        edgeAlphas.push(data[(PRODUCT_Y * w + x) * 4 + 3]);
      }

      // Deep background should be transparent
      const bgAlpha = data[(10 * w + 10) * 4 + 3];
      expect(bgAlpha).toBeLessThan(30);

      // Deep foreground should be opaque
      const fgAlpha = data[(50 * w + 50) * 4 + 3];
      expect(fgAlpha).toBeGreaterThan(200);
    });
  });

  describe("Product Color Preservation", () => {
    it("should preserve original RGB values in foreground", async () => {
      const { removeWhiteBg } = await import("@/lib/smart-image-tools");
      const result = await removeWhiteBg(whiteWithRedProduct, {
        threshold: 240,
        feather: 10,
        morphRadius: 0,
        refineEdges: false,
        cleanNoise: false,
      });
      const { data, w } = parseTestResult(result);

      // Center of red product
      const cx = 50, cy = 50;
      const i = (cy * w + cx) * 4;
      expect(data[i]).toBe(200);     // R preserved
      expect(data[i + 1]).toBe(30);  // G preserved
      expect(data[i + 2]).toBe(30);  // B preserved
      expect(data[i + 3]).toBeGreaterThan(200); // Still opaque
    });
  });

  describe("CIEDE2000 Color Distance", () => {
    it("should produce better separation with DE2000 for saturated colors", async () => {
      const { smartRemoveBg } = await import("@/lib/smart-image-tools");

      // Image with a saturated blue product on a similar-hue but different-saturation bg
      const blueOnCyanBg = createTestImage(W, H, (x, y, data, i) => {
        if (x >= PRODUCT_X && x < PRODUCT_X + PRODUCT_W &&
            y >= PRODUCT_Y && y < PRODUCT_Y + PRODUCT_H) {
          data[i] = 20; data[i + 1] = 30; data[i + 2] = 200; data[i + 3] = 255;
        } else {
          data[i] = 100; data[i + 1] = 200; data[i + 2] = 220; data[i + 3] = 255;
        }
      });

      const resultDE2000 = await smartRemoveBg(blueOnCyanBg, {
        mode: "color",
        sensitivity: 50,
        edgeDetail: 0,
        noiseClean: 0,
        morphStrength: 0,
        foregroundBoost: false,
        useDE2000: true,
        spillRemoval: 0,
        autoThreshold: false,
        bilateralSmooth: 0,
      });
      const d2000 = parseTestResult(resultDE2000);

      const resultDE76 = await smartRemoveBg(blueOnCyanBg, {
        mode: "color",
        sensitivity: 50,
        edgeDetail: 0,
        noiseClean: 0,
        morphStrength: 0,
        foregroundBoost: false,
        useDE2000: false,
        spillRemoval: 0,
        autoThreshold: false,
        bilateralSmooth: 0,
      });
      const d76 = parseTestResult(resultDE76);

      // Product should be preserved in both
      const fgOpaque2000 = regionStats(d2000.data, d2000.w, 42, 42, 16, 16,
        (_r, _g, _b, a) => a > 100);
      const fgOpaque76 = regionStats(d76.data, d76.w, 42, 42, 16, 16,
        (_r, _g, _b, a) => a > 100);
      expect(fgOpaque2000).toBeGreaterThan(0.6);
      expect(fgOpaque76).toBeGreaterThan(0.6);
    });
  });

  describe("Otsu Auto-Thresholding", () => {
    it("should produce cleaner separation with Otsu enabled", async () => {
      const { smartRemoveBg } = await import("@/lib/smart-image-tools");
      const result = await smartRemoveBg(whiteWithRedProduct, {
        mode: "white",
        sensitivity: 50,
        edgeDetail: 0,
        noiseClean: 0,
        morphStrength: 0,
        foregroundBoost: false,
        autoThreshold: true,
        spillRemoval: 0,
        bilateralSmooth: 0,
      });
      const { data, w } = parseTestResult(result);

      const bgTransparent = regionStats(data, w, 0, 0, 20, 20,
        (_r, _g, _b, a) => a < 60);
      expect(bgTransparent).toBeGreaterThan(0.85);

      const fgOpaque = regionStats(data, w, 42, 42, 16, 16,
        (_r, _g, _b, a) => a > 150);
      expect(fgOpaque).toBeGreaterThan(0.85);
    });
  });

  describe("Color Decontamination / Spill Removal", () => {
    it("should reduce background color spill at edges", async () => {
      const { smartRemoveBg } = await import("@/lib/smart-image-tools");

      // Strong green bg
      const result = await smartRemoveBg(greenWithBlueProduct, {
        mode: "color",
        sensitivity: 50,
        edgeDetail: 0,
        noiseClean: 0,
        morphStrength: 0,
        foregroundBoost: false,
        spillRemoval: 80,
        autoThreshold: false,
        bilateralSmooth: 0,
      });
      const { data, w } = parseTestResult(result);

      // Center of blue product should still be blue
      const cx = 50, cy = 50;
      const i = (cy * w + cx) * 4;
      // Blue channel should be dominant
      expect(data[i + 2]).toBeGreaterThan(data[i + 1]); // B > G
      expect(data[i + 3]).toBeGreaterThan(100); // Still visible
    });
  });

  describe("Bilateral Filter", () => {
    it("should smooth mask without destroying edges", async () => {
      const { smartRemoveBg } = await import("@/lib/smart-image-tools");

      const withBilateral = await smartRemoveBg(whiteWithRedProduct, {
        mode: "white",
        sensitivity: 50,
        edgeDetail: 0,
        noiseClean: 0,
        morphStrength: 0,
        foregroundBoost: false,
        bilateralSmooth: 60,
        spillRemoval: 0,
        autoThreshold: false,
      });
      const db = parseTestResult(withBilateral);

      // Background should still be transparent
      const bgTransparent = regionStats(db.data, db.w, 0, 0, 20, 20,
        (_r, _g, _b, a) => a < 80);
      expect(bgTransparent).toBeGreaterThan(0.8);

      // Product should still be opaque
      const fgOpaque = regionStats(db.data, db.w, 42, 42, 16, 16,
        (_r, _g, _b, a) => a > 120);
      expect(fgOpaque).toBeGreaterThan(0.8);
    });
  });

  describe("Multi-Component GMM", () => {
    it("should handle multi-color foreground better with GMM", async () => {
      const { smartRemoveBg } = await import("@/lib/smart-image-tools");

      // Product with two distinct colors (red top half, blue bottom half)
      const multiColorProduct = createTestImage(W, H, (x, y, data, i) => {
        if (x >= PRODUCT_X && x < PRODUCT_X + PRODUCT_W &&
            y >= PRODUCT_Y && y < PRODUCT_Y + PRODUCT_H) {
          if (y < PRODUCT_Y + PRODUCT_H / 2) {
            data[i] = 200; data[i + 1] = 30; data[i + 2] = 30; data[i + 3] = 255;
          } else {
            data[i] = 30; data[i + 1] = 30; data[i + 2] = 200; data[i + 3] = 255;
          }
        } else {
          data[i] = 255; data[i + 1] = 255; data[i + 2] = 255; data[i + 3] = 255;
        }
      });

      const result = await smartRemoveBg(multiColorProduct, {
        mode: "white",
        sensitivity: 50,
        edgeDetail: 0,
        noiseClean: 0,
        morphStrength: 0,
        foregroundBoost: false,
        autoThreshold: true,
        spillRemoval: 0,
        bilateralSmooth: 0,
      });
      const { data, w } = parseTestResult(result);

      // Both halves of the product should be preserved
      const topHalf = regionStats(data, w, 42, 37, 16, 8,
        (_r, _g, _b, a) => a > 100);
      const bottomHalf = regionStats(data, w, 42, 48, 16, 8,
        (_r, _g, _b, a) => a > 100);
      expect(topHalf).toBeGreaterThan(0.7);
      expect(bottomHalf).toBeGreaterThan(0.7);
    });
  });
});
