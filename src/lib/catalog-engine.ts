/**
 * Catalog Engine — Canvas-based multi-page catalog generator.
 * Renders professional product catalogs with multiple templates/layouts.
 * Supports categories, TOC, back-cover, price-list, section dividers.
 */

// ─── Types ───────────────────────────────────────────────────
export interface CatalogProduct {
  id: string;
  image: string;          // base64 or URL
  name: string;
  description?: string;
  price?: string;
  sku?: string;
  badge?: string;         // "חדש", "מבצע", etc.
  category?: string;      // Category name for grouping
  aiDescription?: string; // AI-generated description
  noBgImage?: string;     // Background-removed version
  upscaledImage?: string; // AI-upscaled version
  colors?: string[];      // Detected dominant colors
  frameStyle?: FrameStyle;         // Per-product frame override
  hideElements?: ElementToggle;    // Per-product element visibility
  customFontSize?: number;         // Override name font scale (0.5-2.0)
}

// ─── Frame Types ─────────────────────────────────────────────
export type FrameStyle =
  | "none"             // No frame
  | "thin"             // Thin simple line
  | "rounded"          // Rounded corners with border
  | "shadow-box"       // Drop shadow box
  | "double"           // Double line border
  | "modern-float"     // Floating card with large shadow
  | "curated-arch"     // Top arch / museum style
  | "curated-oval"     // Oval/elliptical clip
  | "polaroid"         // Polaroid photo style
  | "film-strip"       // Film strip border
  | "ornate-gold"      // Ornate golden decorative frame
  | "ornate-classic"   // Classic ornate with corners
  | "brush-stroke"     // Artistic brush stroke edge
  | "torn-paper"       // Torn paper effect
  | "neon-glow"        // Neon glow border
  | "gradient-border"; // Gradient colored border

export interface ElementToggle {
  showImage?: boolean;
  showName?: boolean;
  showDescription?: boolean;
  showPrice?: boolean;
  showSku?: boolean;
  showBadge?: boolean;
}

// ─── Text Overlay Types ──────────────────────────────────────
export interface CatalogTextOverlay {
  id: string;
  text: string;
  page: number;           // -1 = all pages, 0 = cover, etc.
  x: number;              // 0-1 relative position
  y: number;
  fontSize: number;       // 12-120
  fontFamily: "serif" | "sans" | "mono" | "decorative";
  fontWeight: "normal" | "bold";
  color: string;
  align: "left" | "center" | "right";
  opacity: number;        // 0-1
  rotation: number;       // degrees
  maxWidth?: number;      // 0-1 relative
  backgroundColor?: string;
  borderColor?: string;
}

export interface CatalogCategory {
  id: string;
  name: string;
  description?: string;
  color?: string;         // Category accent color
}

export interface CatalogSettings {
  title: string;
  subtitle?: string;
  logo?: string;          // base64 or URL
  brandColor: string;
  accentColor: string;
  bgColor: string;
  textColor: string;
  fontFamily: string;
  template: CatalogTemplate;
  pageSize: PageSize;
  showPrices: boolean;
  showSku: boolean;
  showDescriptions: boolean;
  showPageNumbers: boolean;
  showHeader: boolean;
  showToc: boolean;
  showBackCover: boolean;
  showPriceList: boolean;
  showCategoryDividers: boolean;
  watermark?: string;
  contactInfo?: string;
  columns: 1 | 2 | 3 | 4;
  bgPattern: BgPattern;
  coverStyle: CoverStyle;
  // Frame & overlay settings
  globalFrame: FrameStyle;
  productNameSize: number;    // 0.5-2.0 scale factor
  productDescSize: number;
  productPriceSize: number;
  textOverlays: CatalogTextOverlay[];
  globalElementToggle: ElementToggle;
}

export type CatalogTemplate =
  | "grid-clean"      // Clean grid with subtle borders
  | "grid-shadow"     // Cards with drop shadows
  | "magazine"        // Alternating large/small layout
  | "minimal"         // Ultra-minimal, lots of whitespace
  | "luxury"          // Dark theme, gold accents
  | "catalog-pro"     // Classic catalog with header/footer
  | "lookbook"        // Full-bleed images with overlay text
  | "showcase";       // Single product per page, large

export type PageSize = "A4" | "A3" | "letter" | "square" | "landscape";
export type BgPattern = "none" | "dots" | "lines" | "grid" | "diagonal" | "circles";
export type CoverStyle = "modern" | "classic" | "photo" | "split" | "bold";

export interface CatalogPage {
  pageNumber: number;
  canvas: HTMLCanvasElement;
  dataUrl: string;
  type: "cover" | "toc" | "divider" | "products" | "price-list" | "back-cover";
}

// ─── Constants ───────────────────────────────────────────────
const PAGE_SIZES: Record<PageSize, { w: number; h: number }> = {
  A4: { w: 2480, h: 3508 },       // 210mm × 297mm at 300dpi
  A3: { w: 3508, h: 4961 },
  letter: { w: 2550, h: 3300 },
  square: { w: 3000, h: 3000 },
  landscape: { w: 3508, h: 2480 },
};

const FONT_MAP: Record<string, string> = {
  serif: "Georgia, 'Times New Roman', serif",
  sans: "Segoe UI, Arial, Helvetica, sans-serif",
  mono: "Consolas, 'Courier New', monospace",
  decorative: "'Segoe Script', 'Brush Script MT', cursive",
  "Assistant": "'Assistant', sans-serif",
  "Heebo": "'Heebo', sans-serif",
  "Rubik": "'Rubik', sans-serif",
  "Frank Ruhl Libre": "'Frank Ruhl Libre', serif",
  "Secular One": "'Secular One', sans-serif",
  "Suez One": "'Suez One', serif",
  "Amatic SC": "'Amatic SC', cursive",
  "Karantina": "'Karantina', cursive",
  "Playfair Display": "'Playfair Display', serif",
  "Cormorant Garamond": "'Cormorant Garamond', serif",
  "Montserrat": "'Montserrat', sans-serif",
  "Poppins": "'Poppins', sans-serif",
};

export const FONT_OPTIONS: { id: string; label: string }[] = [
  { id: "sans", label: "Sans" },
  { id: "serif", label: "Serif" },
  { id: "mono", label: "Mono" },
  { id: "Assistant", label: "Assistant" },
  { id: "Heebo", label: "Heebo" },
  { id: "Rubik", label: "Rubik" },
  { id: "Frank Ruhl Libre", label: "Frank Ruhl" },
  { id: "Secular One", label: "Secular" },
  { id: "Suez One", label: "Suez" },
  { id: "Amatic SC", label: "Amatic" },
  { id: "Karantina", label: "Karantina" },
  { id: "Playfair Display", label: "Playfair" },
  { id: "Cormorant Garamond", label: "Cormorant" },
  { id: "Montserrat", label: "Montserrat" },
  { id: "Poppins", label: "Poppins" },
];

const _loadedFonts = new Set<string>();
export async function loadGoogleFont(family: string): Promise<void> {
  if (_loadedFonts.has(family) || ["serif", "sans", "mono", "decorative"].includes(family)) return;
  const url = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@400;700&display=swap`;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = url;
  document.head.appendChild(link);
  await document.fonts.load(`16px "${family}"`);
  _loadedFonts.add(family);
}

// ─── Helpers ─────────────────────────────────────────────────
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
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
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines = 3,
): number {
  const words = text.split(" ");
  let line = "";
  let lineCount = 0;

  for (let i = 0; i < words.length; i++) {
    const testLine = line + words[i] + " ";
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && i > 0) {
      lineCount++;
      if (lineCount > maxLines) break;
      ctx.fillText(line.trim(), x, y);
      line = words[i] + " ";
      y += lineHeight;
    } else {
      line = testLine;
    }
  }
  if (lineCount <= maxLines) {
    ctx.fillText(line.trim(), x, y);
    y += lineHeight;
  }
  return y;
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ─── Page Renderers ──────────────────────────────────────────

/** Items per page based on template and columns */
function getItemsPerPage(template: CatalogTemplate, columns: number): number {
  switch (template) {
    case "showcase": return 1;
    case "lookbook": return 2;
    case "magazine": return columns <= 2 ? 3 : 5;
    default: return columns * Math.ceil(columns * 0.75);
  }
}

async function drawHeader(
  ctx: CanvasRenderingContext2D,
  settings: CatalogSettings,
  pageW: number,
  _pageH: number,
): Promise<number> {
  if (!settings.showHeader) return 40;

  const padding = pageW * 0.04;
  const headerH = pageW * 0.08;
  const font = FONT_MAP[settings.fontFamily];

  // Header background
  ctx.fillStyle = settings.brandColor;
  ctx.fillRect(0, 0, pageW, headerH);

  // Logo
  let textX = padding;
  if (settings.logo) {
    try {
      const logoImg = await loadImage(settings.logo);
      const logoH = headerH * 0.6;
      const logoW = (logoImg.naturalWidth / logoImg.naturalHeight) * logoH;
      ctx.drawImage(logoImg, padding, (headerH - logoH) / 2, logoW, logoH);
      textX = padding + logoW + padding * 0.5;
    } catch { /* no logo */ }
  }

  // Title
  ctx.fillStyle = "#ffffff";
  ctx.font = `bold ${headerH * 0.35}px ${font}`;
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.fillText(settings.title, pageW - padding, headerH * 0.4);

  // Subtitle
  if (settings.subtitle) {
    ctx.font = `${headerH * 0.2}px ${font}`;
    ctx.fillStyle = hexToRgba("#ffffff", 0.8);
    ctx.fillText(settings.subtitle, pageW - padding, headerH * 0.72);
  }

  ctx.textAlign = "start";
  ctx.textBaseline = "alphabetic";

  return headerH + padding * 0.5;
}

function drawFooter(
  ctx: CanvasRenderingContext2D,
  settings: CatalogSettings,
  pageW: number,
  pageH: number,
  pageNum: number,
  totalPages: number,
) {
  const padding = pageW * 0.04;
  const footerH = pageW * 0.03;
  const footerY = pageH - footerH - padding * 0.5;
  const font = FONT_MAP[settings.fontFamily];

  // Separator line
  ctx.strokeStyle = hexToRgba(settings.brandColor, 0.3);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(padding, footerY);
  ctx.lineTo(pageW - padding, footerY);
  ctx.stroke();

  // Contact info
  if (settings.contactInfo) {
    ctx.fillStyle = hexToRgba(settings.textColor, 0.5);
    ctx.font = `${footerH * 0.5}px ${font}`;
    ctx.textAlign = "right";
    ctx.fillText(settings.contactInfo, pageW - padding, footerY + footerH * 0.7);
  }

  // Page number
  if (settings.showPageNumbers) {
    ctx.fillStyle = hexToRgba(settings.textColor, 0.4);
    ctx.font = `${footerH * 0.5}px ${font}`;
    ctx.textAlign = "left";
    ctx.fillText(`${pageNum} / ${totalPages}`, padding, footerY + footerH * 0.7);
  }

  ctx.textAlign = "start";
}

function drawWatermark(
  ctx: CanvasRenderingContext2D,
  text: string,
  pageW: number,
  pageH: number,
  font: string,
) {
  ctx.save();
  ctx.translate(pageW / 2, pageH / 2);
  ctx.rotate(-Math.PI / 6);
  ctx.fillStyle = "rgba(0,0,0,0.04)";
  ctx.font = `bold ${pageW * 0.08}px ${font}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

// ─── Background Patterns ─────────────────────────────────────
function drawBgPattern(
  ctx: CanvasRenderingContext2D,
  pattern: BgPattern,
  pageW: number,
  pageH: number,
  color: string,
) {
  if (pattern === "none") return;
  ctx.save();
  ctx.strokeStyle = hexToRgba(color, 0.04);
  ctx.fillStyle = hexToRgba(color, 0.04);
  ctx.lineWidth = 1;
  const step = pageW * 0.03;

  switch (pattern) {
    case "dots":
      for (let x = step; x < pageW; x += step)
        for (let y = step; y < pageH; y += step) {
          ctx.beginPath();
          ctx.arc(x, y, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      break;
    case "lines":
      for (let y = step; y < pageH; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(pageW, y);
        ctx.stroke();
      }
      break;
    case "grid":
      for (let x = step; x < pageW; x += step) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, pageH); ctx.stroke();
      }
      for (let y = step; y < pageH; y += step) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(pageW, y); ctx.stroke();
      }
      break;
    case "diagonal":
      for (let d = -pageH; d < pageW + pageH; d += step) {
        ctx.beginPath(); ctx.moveTo(d, 0); ctx.lineTo(d + pageH, pageH); ctx.stroke();
      }
      break;
    case "circles":
      for (let x = step * 2; x < pageW; x += step * 3)
        for (let y = step * 2; y < pageH; y += step * 3) {
          ctx.beginPath();
          ctx.arc(x, y, step * 0.8, 0, Math.PI * 2);
          ctx.stroke();
        }
      break;
  }
  ctx.restore();
}

// ─── Frame Renderer ──────────────────────────────────────────

function drawFrame(
  ctx: CanvasRenderingContext2D,
  frame: FrameStyle,
  x: number, y: number, w: number, h: number,
  brandColor: string, accentColor: string,
) {
  if (frame === "none") return;

  ctx.save();
  const bw = Math.max(2, w * 0.008); // base border width

  switch (frame) {
    case "thin": {
      ctx.strokeStyle = hexToRgba(brandColor, 0.5);
      ctx.lineWidth = bw;
      ctx.strokeRect(x, y, w, h);
      break;
    }
    case "rounded": {
      const r = w * 0.03;
      drawRoundedRect(ctx, x, y, w, h, r);
      ctx.strokeStyle = brandColor;
      ctx.lineWidth = bw * 1.5;
      ctx.stroke();
      break;
    }
    case "shadow-box": {
      ctx.shadowColor = "rgba(0,0,0,0.25)";
      ctx.shadowBlur = w * 0.03;
      ctx.shadowOffsetX = w * 0.008;
      ctx.shadowOffsetY = w * 0.008;
      drawRoundedRect(ctx, x, y, w, h, w * 0.015);
      ctx.strokeStyle = hexToRgba(brandColor, 0.3);
      ctx.lineWidth = bw;
      ctx.stroke();
      ctx.shadowColor = "transparent";
      break;
    }
    case "double": {
      const gap = bw * 2.5;
      ctx.strokeStyle = brandColor;
      ctx.lineWidth = bw;
      ctx.strokeRect(x, y, w, h);
      ctx.strokeRect(x + gap, y + gap, w - gap * 2, h - gap * 2);
      break;
    }
    case "modern-float": {
      ctx.shadowColor = "rgba(0,0,0,0.3)";
      ctx.shadowBlur = w * 0.05;
      ctx.shadowOffsetY = w * 0.02;
      const r = w * 0.02;
      drawRoundedRect(ctx, x + w * 0.01, y + w * 0.01, w - w * 0.02, h - w * 0.02, r);
      ctx.fillStyle = "rgba(255,255,255,0.02)";
      ctx.fill();
      ctx.strokeStyle = hexToRgba(brandColor, 0.15);
      ctx.lineWidth = bw;
      ctx.stroke();
      ctx.shadowColor = "transparent";
      break;
    }
    case "curated-arch": {
      // Top arch
      const archR = w * 0.5;
      ctx.beginPath();
      ctx.moveTo(x, y + h);
      ctx.lineTo(x, y + archR * 0.3);
      ctx.arc(x + w / 2, y + archR * 0.3, w / 2, Math.PI, 0, false);
      ctx.lineTo(x + w, y + h);
      ctx.closePath();
      ctx.strokeStyle = brandColor;
      ctx.lineWidth = bw * 2;
      ctx.stroke();
      break;
    }
    case "curated-oval": {
      const cx = x + w / 2;
      const cy = y + h / 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, w / 2 - bw, h / 2 - bw, 0, 0, Math.PI * 2);
      ctx.strokeStyle = brandColor;
      ctx.lineWidth = bw * 2;
      ctx.stroke();
      break;
    }
    case "polaroid": {
      const padSide = w * 0.04;
      const padTop = w * 0.04;
      const padBot = w * 0.15;
      ctx.fillStyle = "#ffffff";
      ctx.shadowColor = "rgba(0,0,0,0.2)";
      ctx.shadowBlur = w * 0.03;
      ctx.shadowOffsetY = w * 0.01;
      ctx.fillRect(x - padSide, y - padTop, w + padSide * 2, h + padTop + padBot);
      ctx.shadowColor = "transparent";
      ctx.strokeStyle = "rgba(0,0,0,0.08)";
      ctx.lineWidth = 1;
      ctx.strokeRect(x - padSide, y - padTop, w + padSide * 2, h + padTop + padBot);
      break;
    }
    case "film-strip": {
      ctx.strokeStyle = "#333333";
      ctx.lineWidth = bw * 2;
      ctx.strokeRect(x, y, w, h);
      // Sprocket holes
      const holeSize = w * 0.025;
      const holeGap = w * 0.06;
      ctx.fillStyle = "#333333";
      for (let hx = x + holeGap; hx < x + w - holeGap; hx += holeGap) {
        drawRoundedRect(ctx, hx - holeSize / 2, y - holeSize * 1.2, holeSize, holeSize, 2);
        ctx.fill();
        drawRoundedRect(ctx, hx - holeSize / 2, y + h + holeSize * 0.2, holeSize, holeSize, 2);
        ctx.fill();
      }
      break;
    }
    case "ornate-gold": {
      const gold = "#c9a84c";
      ctx.strokeStyle = gold;
      ctx.lineWidth = bw * 3;
      ctx.strokeRect(x, y, w, h);
      ctx.strokeStyle = hexToRgba(gold, 0.5);
      ctx.lineWidth = bw;
      ctx.strokeRect(x + bw * 5, y + bw * 5, w - bw * 10, h - bw * 10);
      // Corner ornaments
      const cs = w * 0.06;
      for (const [cx, cy] of [[x, y], [x + w, y], [x, y + h], [x + w, y + h]]) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.fillStyle = gold;
        ctx.beginPath();
        ctx.arc(0, 0, cs, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = hexToRgba(gold, 0.3);
        ctx.beginPath();
        ctx.arc(0, 0, cs * 1.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      break;
    }
    case "ornate-classic": {
      ctx.strokeStyle = brandColor;
      ctx.lineWidth = bw * 2;
      ctx.strokeRect(x, y, w, h);
      // Inner border
      const inset = w * 0.025;
      ctx.strokeStyle = hexToRgba(brandColor, 0.4);
      ctx.lineWidth = bw;
      ctx.strokeRect(x + inset, y + inset, w - inset * 2, h - inset * 2);
      // Corner L shapes
      const cLen = w * 0.08;
      ctx.strokeStyle = brandColor;
      ctx.lineWidth = bw * 1.5;
      for (const [cx, cy, dx, dy] of [
        [x, y, 1, 1], [x + w, y, -1, 1],
        [x, y + h, 1, -1], [x + w, y + h, -1, -1],
      ]) {
        ctx.beginPath();
        ctx.moveTo(cx + dx * cLen, cy);
        ctx.lineTo(cx, cy);
        ctx.lineTo(cx, cy + dy * cLen);
        ctx.stroke();
      }
      break;
    }
    case "brush-stroke": {
      ctx.strokeStyle = hexToRgba(brandColor, 0.6);
      ctx.lineWidth = bw * 4;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      const noise = w * 0.01;
      ctx.beginPath();
      ctx.moveTo(x + noise, y - noise);
      ctx.lineTo(x + w - noise, y + noise);
      ctx.lineTo(x + w + noise, y + h + noise);
      ctx.lineTo(x - noise, y + h - noise);
      ctx.closePath();
      ctx.stroke();
      break;
    }
    case "torn-paper": {
      ctx.strokeStyle = hexToRgba(brandColor, 0.2);
      ctx.lineWidth = 1;
      // Top torn edge
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let tx = x; tx <= x + w; tx += w * 0.02) {
        const jitter = (Math.random() - 0.5) * w * 0.015;
        ctx.lineTo(tx, y + jitter);
      }
      ctx.stroke();
      // Bottom torn edge
      ctx.beginPath();
      ctx.moveTo(x, y + h);
      for (let tx = x; tx <= x + w; tx += w * 0.02) {
        const jitter = (Math.random() - 0.5) * w * 0.015;
        ctx.lineTo(tx, y + h + jitter);
      }
      ctx.stroke();
      // Subtle shadow
      ctx.shadowColor = "rgba(0,0,0,0.1)";
      ctx.shadowBlur = bw * 3;
      ctx.shadowOffsetY = bw * 2;
      ctx.strokeStyle = "transparent";
      ctx.strokeRect(x, y, w, h);
      ctx.shadowColor = "transparent";
      break;
    }
    case "neon-glow": {
      for (let i = 3; i >= 0; i--) {
        ctx.shadowColor = accentColor;
        ctx.shadowBlur = bw * (i + 1) * 4;
        ctx.strokeStyle = i === 0 ? accentColor : "transparent";
        ctx.lineWidth = bw;
        drawRoundedRect(ctx, x, y, w, h, w * 0.015);
        ctx.stroke();
      }
      ctx.shadowColor = "transparent";
      break;
    }
    case "gradient-border": {
      const grad = ctx.createLinearGradient(x, y, x + w, y + h);
      grad.addColorStop(0, brandColor);
      grad.addColorStop(0.5, accentColor);
      grad.addColorStop(1, brandColor);
      ctx.strokeStyle = grad;
      ctx.lineWidth = bw * 3;
      drawRoundedRect(ctx, x, y, w, h, w * 0.015);
      ctx.stroke();
      break;
    }
  }
  ctx.restore();
}

// ─── Frame clip path (for curated frames that clip the image) ─
function applyFrameClip(
  ctx: CanvasRenderingContext2D,
  frame: FrameStyle,
  x: number, y: number, w: number, h: number,
): boolean {
  if (frame === "curated-arch") {
    const archR = w * 0.5;
    ctx.beginPath();
    ctx.moveTo(x, y + h);
    ctx.lineTo(x, y + archR * 0.3);
    ctx.arc(x + w / 2, y + archR * 0.3, w / 2, Math.PI, 0, false);
    ctx.lineTo(x + w, y + h);
    ctx.closePath();
    ctx.clip();
    return true;
  }
  if (frame === "curated-oval") {
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
    ctx.clip();
    return true;
  }
  return false;
}

// ─── Text Overlay Renderer ───────────────────────────────────
function drawTextOverlays(
  ctx: CanvasRenderingContext2D,
  overlays: CatalogTextOverlay[],
  pageIndex: number,
  pageW: number,
  pageH: number,
) {
  for (const ov of overlays) {
    if (ov.page !== -1 && ov.page !== pageIndex) continue;
    if (!ov.text.trim()) continue;

    ctx.save();
    const px = ov.x * pageW;
    const py = ov.y * pageH;
    const font = FONT_MAP[ov.fontFamily] || FONT_MAP.sans;
    const fontSize = Math.round(ov.fontSize * (pageW / 2480)); // scale relative to A4

    ctx.globalAlpha = ov.opacity;
    ctx.translate(px, py);
    if (ov.rotation) ctx.rotate((ov.rotation * Math.PI) / 180);

    ctx.font = `${ov.fontWeight} ${fontSize}px ${font}`;
    ctx.textAlign = ov.align as CanvasTextAlign;
    ctx.textBaseline = "top";

    const maxW = ov.maxWidth ? ov.maxWidth * pageW : pageW * 0.8;
    const lines: string[] = [];
    const words = ov.text.split(" ");
    let currentLine = "";
    for (const word of words) {
      const test = currentLine ? `${currentLine} ${word}` : word;
      if (ctx.measureText(test).width > maxW && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = test;
      }
    }
    if (currentLine) lines.push(currentLine);

    const lineH = fontSize * 1.3;
    const totalH = lines.length * lineH;

    // Background box
    if (ov.backgroundColor) {
      const maxLine = Math.max(...lines.map(l => ctx.measureText(l).width));
      const pad = fontSize * 0.3;
      let boxX = -pad;
      if (ov.align === "center") boxX = -maxLine / 2 - pad;
      else if (ov.align === "right") boxX = -maxLine - pad;
      ctx.fillStyle = ov.backgroundColor;
      drawRoundedRect(ctx, boxX, -pad, maxLine + pad * 2, totalH + pad * 2, pad);
      ctx.fill();
    }

    // Border
    if (ov.borderColor) {
      const maxLine = Math.max(...lines.map(l => ctx.measureText(l).width));
      const pad = fontSize * 0.3;
      let boxX = -pad;
      if (ov.align === "center") boxX = -maxLine / 2 - pad;
      else if (ov.align === "right") boxX = -maxLine - pad;
      ctx.strokeStyle = ov.borderColor;
      ctx.lineWidth = 2;
      drawRoundedRect(ctx, boxX, -pad, maxLine + pad * 2, totalH + pad * 2, pad);
      ctx.stroke();
    }

    // Text
    ctx.fillStyle = ov.color;
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], 0, i * lineH);
    }

    ctx.restore();
  }
}

// ─── TOC Page ────────────────────────────────────────────────
async function renderTocPage(
  settings: CatalogSettings,
  categories: CatalogCategory[],
  products: CatalogProduct[],
  categoryPageMap: Map<string, number>,
): Promise<HTMLCanvasElement> {
  const { w: pageW, h: pageH } = PAGE_SIZES[settings.pageSize];
  const canvas = document.createElement("canvas");
  canvas.width = pageW;
  canvas.height = pageH;
  const ctx = canvas.getContext("2d")!;
  const font = FONT_MAP[settings.fontFamily];

  // Background
  ctx.fillStyle = settings.template === "luxury" ? "#0d0d1a" : settings.bgColor;
  ctx.fillRect(0, 0, pageW, pageH);
  drawBgPattern(ctx, settings.bgPattern, pageW, pageH, settings.textColor);

  const padding = pageW * 0.08;
  const textColor = settings.template === "luxury" ? "#e5e5e5" : settings.textColor;

  // Title
  ctx.textAlign = "right";
  ctx.fillStyle = settings.brandColor;
  ctx.font = `bold ${pageW * 0.045}px ${font}`;
  ctx.fillText("תוכן עניינים", pageW - padding, pageH * 0.12);

  // Decorative line
  ctx.strokeStyle = settings.brandColor;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(padding, pageH * 0.14);
  ctx.lineTo(pageW - padding, pageH * 0.14);
  ctx.stroke();

  let y = pageH * 0.2;
  const lineH = pageH * 0.05;

  // Categories list
  if (categories.length > 0) {
    for (const cat of categories) {
      const catProducts = products.filter(p => p.category === cat.id);
      const pageNum = categoryPageMap.get(cat.id) ?? 0;

      // Category line
      ctx.textAlign = "right";
      ctx.fillStyle = cat.color || settings.brandColor;
      ctx.font = `bold ${pageW * 0.025}px ${font}`;
      ctx.fillText(cat.name, pageW - padding, y);

      // Dot leaders
      ctx.fillStyle = hexToRgba(textColor, 0.2);
      const nameW = ctx.measureText(cat.name).width;
      const pageNumStr = String(pageNum);
      ctx.font = `${pageW * 0.02}px ${font}`;
      const numW = ctx.measureText(pageNumStr).width;
      const dotsStart = padding + numW + 20;
      const dotsEnd = pageW - padding - nameW - 20;
      for (let dx = dotsStart; dx < dotsEnd; dx += 12) {
        ctx.beginPath();
        ctx.arc(dx, y - 4, 2, 0, Math.PI * 2);
        ctx.fill();
      }

      // Page number
      ctx.textAlign = "left";
      ctx.fillStyle = textColor;
      ctx.font = `bold ${pageW * 0.022}px ${font}`;
      ctx.fillText(pageNumStr, padding, y);

      // Product count
      ctx.fillStyle = hexToRgba(textColor, 0.4);
      ctx.font = `${pageW * 0.015}px ${font}`;
      ctx.textAlign = "right";
      ctx.fillText(`(${catProducts.length} מוצרים)`, pageW - padding, y + lineH * 0.4);

      if (cat.description) {
        ctx.fillStyle = hexToRgba(textColor, 0.5);
        ctx.font = `${pageW * 0.014}px ${font}`;
        ctx.fillText(cat.description, pageW - padding, y + lineH * 0.7);
      }

      y += lineH * 1.2;
    }
  } else {
    // No categories — simple product listing
    ctx.textAlign = "right";
    ctx.fillStyle = textColor;
    ctx.font = `${pageW * 0.022}px ${font}`;
    ctx.fillText(`${products.length} מוצרים בקטלוג`, pageW - padding, y);
  }

  ctx.textAlign = "start";
  return canvas;
}

// ─── Category Divider Page ───────────────────────────────────
async function renderDividerPage(
  settings: CatalogSettings,
  category: CatalogCategory,
  products: CatalogProduct[],
): Promise<HTMLCanvasElement> {
  const { w: pageW, h: pageH } = PAGE_SIZES[settings.pageSize];
  const canvas = document.createElement("canvas");
  canvas.width = pageW;
  canvas.height = pageH;
  const ctx = canvas.getContext("2d")!;
  const font = FONT_MAP[settings.fontFamily];
  const catColor = category.color || settings.brandColor;

  // Background — full brand color gradient
  const grad = ctx.createLinearGradient(0, 0, 0, pageH);
  grad.addColorStop(0, catColor);
  grad.addColorStop(1, hexToRgba(catColor, 0.7));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, pageW, pageH);

  // Pattern overlay
  drawBgPattern(ctx, settings.bgPattern, pageW, pageH, "#ffffff");

  // Category name — large centered
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffffff";
  ctx.font = `bold ${pageW * 0.08}px ${font}`;
  ctx.fillText(category.name, pageW / 2, pageH * 0.4);

  // Description
  if (category.description) {
    ctx.font = `${pageW * 0.025}px ${font}`;
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    wrapText(ctx, category.description, pageW * 0.15, pageH * 0.5, pageW * 0.7, pageW * 0.035, 3);
  }

  // Product count
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.font = `${pageW * 0.02}px ${font}`;
  ctx.fillText(`${products.length} מוצרים`, pageW / 2, pageH * 0.65);

  // Mini thumbnails strip (up to 5)
  const thumbCount = Math.min(products.length, 5);
  if (thumbCount > 0) {
    const thumbSize = pageW * 0.1;
    const gap = 20;
    const totalW = thumbCount * thumbSize + (thumbCount - 1) * gap;
    const startX = (pageW - totalW) / 2;
    const startY = pageH * 0.72;

    for (let i = 0; i < thumbCount; i++) {
      const tx = startX + i * (thumbSize + gap);
      try {
        const img = await loadImage(products[i].image);
        ctx.save();
        drawRoundedRect(ctx, tx, startY, thumbSize, thumbSize, 12);
        ctx.clip();
        const scale = Math.max(thumbSize / img.naturalWidth, thumbSize / img.naturalHeight);
        const dw = img.naturalWidth * scale;
        const dh = img.naturalHeight * scale;
        ctx.drawImage(img, tx + (thumbSize - dw) / 2, startY + (thumbSize - dh) / 2, dw, dh);
        ctx.restore();
      } catch { /* skip */ }
    }
  }

  // Decorative line
  ctx.strokeStyle = "rgba(255,255,255,0.3)";
  ctx.lineWidth = 3;
  const lineW = pageW * 0.3;
  ctx.beginPath();
  ctx.moveTo((pageW - lineW) / 2, pageH * 0.46);
  ctx.lineTo((pageW + lineW) / 2, pageH * 0.46);
  ctx.stroke();

  ctx.textAlign = "start";
  ctx.textBaseline = "alphabetic";
  return canvas;
}

// ─── Price List Page ─────────────────────────────────────────
async function renderPriceListPage(
  settings: CatalogSettings,
  products: CatalogProduct[],
  pageIndex: number,
  totalPricePages: number,
): Promise<HTMLCanvasElement> {
  const { w: pageW, h: pageH } = PAGE_SIZES[settings.pageSize];
  const canvas = document.createElement("canvas");
  canvas.width = pageW;
  canvas.height = pageH;
  const ctx = canvas.getContext("2d")!;
  const font = FONT_MAP[settings.fontFamily];

  const isLux = settings.template === "luxury";
  ctx.fillStyle = isLux ? "#0d0d1a" : settings.bgColor;
  ctx.fillRect(0, 0, pageW, pageH);
  drawBgPattern(ctx, settings.bgPattern, pageW, pageH, settings.textColor);

  const padding = pageW * 0.06;
  const textColor = isLux ? "#e5e5e5" : settings.textColor;

  // Title on first page
  if (pageIndex === 0) {
    ctx.textAlign = "right";
    ctx.fillStyle = settings.brandColor;
    ctx.font = `bold ${pageW * 0.04}px ${font}`;
    ctx.fillText("מחירון", pageW - padding, pageH * 0.08);
    ctx.strokeStyle = settings.brandColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(padding, pageH * 0.095);
    ctx.lineTo(pageW - padding, pageH * 0.095);
    ctx.stroke();
  }

  // Table header
  const tableTop = pageIndex === 0 ? pageH * 0.13 : pageH * 0.06;
  const rowH = pageH * 0.038;
  const cols = {
    price: padding,
    sku: padding + pageW * 0.18,
    name: pageW - padding,
  };

  // Header row
  ctx.fillStyle = settings.brandColor;
  ctx.fillRect(padding, tableTop, pageW - padding * 2, rowH);
  ctx.fillStyle = "#ffffff";
  ctx.font = `bold ${rowH * 0.5}px ${font}`;
  ctx.textAlign = "right";
  ctx.fillText("שם מוצר", cols.name - 10, tableTop + rowH * 0.65);
  ctx.textAlign = "left";
  ctx.fillText("מחיר", cols.price + 10, tableTop + rowH * 0.65);
  if (settings.showSku) {
    ctx.fillText("מק״ט", cols.sku, tableTop + rowH * 0.65);
  }

  // Product rows
  let y = tableTop + rowH;
  for (let i = 0; i < products.length; i++) {
    const prod = products[i];
    const isEven = i % 2 === 0;

    // Alternating row color
    if (isEven) {
      ctx.fillStyle = hexToRgba(settings.brandColor, 0.05);
      ctx.fillRect(padding, y, pageW - padding * 2, rowH);
    }

    // Separator
    ctx.strokeStyle = hexToRgba(textColor, 0.08);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding, y + rowH);
    ctx.lineTo(pageW - padding, y + rowH);
    ctx.stroke();

    ctx.font = `${rowH * 0.45}px ${font}`;
    ctx.fillStyle = textColor;

    // Name
    ctx.textAlign = "right";
    ctx.fillText(prod.name, cols.name - 10, y + rowH * 0.65);

    // Price
    ctx.textAlign = "left";
    ctx.fillStyle = settings.brandColor;
    ctx.font = `bold ${rowH * 0.45}px ${font}`;
    ctx.fillText(prod.price || "—", cols.price + 10, y + rowH * 0.65);

    // SKU
    if (settings.showSku) {
      ctx.fillStyle = hexToRgba(textColor, 0.5);
      ctx.font = `${rowH * 0.38}px ${font}`;
      ctx.fillText(prod.sku || "", cols.sku, y + rowH * 0.65);
    }

    y += rowH;
  }

  ctx.textAlign = "start";
  return canvas;
}

// ─── Back Cover Page ─────────────────────────────────────────
async function renderBackCover(
  settings: CatalogSettings,
): Promise<HTMLCanvasElement> {
  const { w: pageW, h: pageH } = PAGE_SIZES[settings.pageSize];
  const canvas = document.createElement("canvas");
  canvas.width = pageW;
  canvas.height = pageH;
  const ctx = canvas.getContext("2d")!;
  const font = FONT_MAP[settings.fontFamily];

  const isLux = settings.template === "luxury";

  // Background
  if (isLux) {
    ctx.fillStyle = "#0d0d1a";
    ctx.fillRect(0, 0, pageW, pageH);
    ctx.strokeStyle = settings.accentColor;
    ctx.lineWidth = 6;
    ctx.strokeRect(60, 60, pageW - 120, pageH - 120);
  } else {
    ctx.fillStyle = settings.brandColor;
    ctx.fillRect(0, 0, pageW, pageH);
  }

  drawBgPattern(ctx, settings.bgPattern, pageW, pageH, "#ffffff");

  // Logo
  if (settings.logo) {
    try {
      const logoImg = await loadImage(settings.logo);
      const logoH = pageH * 0.12;
      const logoW = (logoImg.naturalWidth / logoImg.naturalHeight) * logoH;
      ctx.drawImage(logoImg, (pageW - logoW) / 2, pageH * 0.3, logoW, logoH);
    } catch { /* skip */ }
  }

  ctx.textAlign = "center";

  // Title
  ctx.fillStyle = isLux ? settings.accentColor : "#ffffff";
  ctx.font = `bold ${pageW * 0.05}px ${font}`;
  ctx.fillText(settings.title, pageW / 2, pageH * 0.52);

  // Subtitle
  if (settings.subtitle) {
    ctx.fillStyle = isLux ? hexToRgba("#ffffff", 0.6) : "rgba(255,255,255,0.7)";
    ctx.font = `${pageW * 0.022}px ${font}`;
    ctx.fillText(settings.subtitle, pageW / 2, pageH * 0.57);
  }

  // Contact info
  if (settings.contactInfo) {
    ctx.fillStyle = isLux ? hexToRgba("#ffffff", 0.5) : "rgba(255,255,255,0.6)";
    ctx.font = `${pageW * 0.018}px ${font}`;
    const lines = settings.contactInfo.split("·").map(s => s.trim());
    let cy = pageH * 0.66;
    for (const line of lines) {
      ctx.fillText(line, pageW / 2, cy);
      cy += pageW * 0.03;
    }
  }

  // "Thank you" footer
  ctx.fillStyle = isLux ? hexToRgba(settings.accentColor, 0.4) : "rgba(255,255,255,0.3)";
  ctx.font = `${pageW * 0.015}px ${font}`;
  ctx.fillText("תודה שבחרתם בנו", pageW / 2, pageH * 0.9);

  ctx.textAlign = "start";
  return canvas;
}

// ─── Product Card Renderers ──────────────────────────────────

async function drawProductCard(
  ctx: CanvasRenderingContext2D,
  product: CatalogProduct,
  x: number, y: number, w: number, h: number,
  settings: CatalogSettings,
  template: CatalogTemplate,
) {
  const font = FONT_MAP[settings.fontFamily];
  const padding = w * 0.05;
  const imageArea = h * 0.65;

  // Resolve element visibility (per-product overrides global)
  const elVis = {
    showImage: product.hideElements?.showImage ?? settings.globalElementToggle?.showImage ?? true,
    showName: product.hideElements?.showName ?? settings.globalElementToggle?.showName ?? true,
    showDescription: product.hideElements?.showDescription ?? settings.globalElementToggle?.showDescription ?? true,
    showPrice: product.hideElements?.showPrice ?? settings.globalElementToggle?.showPrice ?? true,
    showSku: product.hideElements?.showSku ?? settings.globalElementToggle?.showSku ?? true,
    showBadge: product.hideElements?.showBadge ?? settings.globalElementToggle?.showBadge ?? true,
  };

  // Resolve frame style (per-product overrides global)
  const frame: FrameStyle = product.frameStyle || settings.globalFrame || "none";

  // Font size multipliers
  const nameScale = (product.customFontSize ?? settings.productNameSize) || 1;
  const descScale = settings.productDescSize || 1;
  const priceScale = settings.productPriceSize || 1;

  // Card background
  if (template === "grid-shadow") {
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.15)";
    ctx.shadowBlur = 20;
    ctx.shadowOffsetX = 4;
    ctx.shadowOffsetY = 4;
    drawRoundedRect(ctx, x, y, w, h, 12);
    ctx.fillStyle = settings.bgColor === "#1a1a2e" ? "#222240" : "#ffffff";
    ctx.fill();
    ctx.restore();
  } else if (template === "luxury") {
    drawRoundedRect(ctx, x, y, w, h, 8);
    ctx.fillStyle = "#1c1c30";
    ctx.fill();
    ctx.strokeStyle = hexToRgba(settings.accentColor, 0.3);
    ctx.lineWidth = 2;
    ctx.stroke();
  } else if (template === "grid-clean") {
    ctx.strokeStyle = hexToRgba(settings.textColor, 0.1);
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);
  } else if (template === "minimal") {
    // No card border, just spacing
  }

  // Product image
  if (elVis.showImage) {
    try {
      const img = await loadImage(product.image);
      const imgX = x + padding;
      const imgY = y + padding;
      const imgW = w - padding * 2;
      const imgH = imageArea - padding * 2;

      const scale = Math.min(imgW / img.naturalWidth, imgH / img.naturalHeight);
      const drawW = img.naturalWidth * scale;
      const drawH = img.naturalHeight * scale;
      const drawX = imgX + (imgW - drawW) / 2;
      const drawY = imgY + (imgH - drawH) / 2;

      ctx.save();
      // Apply clip for curated frames — use actual image bounds
      const clipped = applyFrameClip(ctx, frame, drawX, drawY, drawW, drawH);
      if (!clipped && (template === "grid-shadow" || template === "luxury")) {
        drawRoundedRect(ctx, drawX, drawY, drawW, drawH, 8);
        ctx.clip();
      }
      ctx.drawImage(img, drawX, drawY, drawW, drawH);
      ctx.restore();

      // Draw decorative frame around actual image bounds
      if (frame !== "none") {
        drawFrame(ctx, frame, drawX, drawY, drawW, drawH, settings.brandColor, settings.accentColor);
      }
    } catch {
      ctx.fillStyle = hexToRgba(settings.brandColor, 0.1);
      ctx.fillRect(x + padding, y + padding, w - padding * 2, imageArea - padding * 2);
      ctx.fillStyle = hexToRgba(settings.textColor, 0.3);
      ctx.font = `${w * 0.06}px ${font}`;
      ctx.textAlign = "center";
      ctx.fillText("תמונה לא זמינה", x + w / 2, y + imageArea / 2);
      ctx.textAlign = "start";
    }
  }

  // Badge
  if (elVis.showBadge && product.badge) {
    const badgeH = h * 0.04;
    const badgePad = badgeH * 0.6;
    ctx.font = `bold ${badgeH}px ${font}`;
    const badgeW = ctx.measureText(product.badge).width + badgePad * 2;
    const badgeX = x + w - padding - badgeW;
    const badgeY = y + padding;
    drawRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH + badgePad, badgeH * 0.3);
    ctx.fillStyle = settings.accentColor;
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.fillText(product.badge, badgeX + badgeW / 2, badgeY + badgeH * 0.9);
    ctx.textAlign = "start";
  }

  // Text area
  const textX = x + padding;
  const textMaxW = w - padding * 2;
  let textY = y + imageArea + padding * 0.5;

  // Product name
  if (elVis.showName) {
    ctx.fillStyle = template === "luxury" ? "#ffffff" : settings.textColor;
    ctx.font = `bold ${h * 0.035 * nameScale}px ${font}`;
    textY = wrapText(ctx, product.name, textX, textY, textMaxW, h * 0.04 * nameScale, 2);
  }

  // Description
  if (elVis.showDescription && settings.showDescriptions && product.description) {
    ctx.fillStyle = template === "luxury"
      ? hexToRgba("#ffffff", 0.6)
      : hexToRgba(settings.textColor, 0.6);
    ctx.font = `${h * 0.025 * descScale}px ${font}`;
    textY = wrapText(ctx, product.description, textX, textY + h * 0.01, textMaxW, h * 0.03 * descScale, 2);
  }

  // Price + SKU row
  const bottomY = y + h - padding;
  if (elVis.showPrice && settings.showPrices && product.price) {
    ctx.fillStyle = settings.brandColor;
    ctx.font = `bold ${h * 0.035 * priceScale}px ${font}`;
    ctx.textAlign = "right";
    ctx.fillText(product.price, x + w - padding, bottomY);
    ctx.textAlign = "start";
  }
  if (elVis.showSku && settings.showSku && product.sku) {
    ctx.fillStyle = hexToRgba(settings.textColor, 0.35);
    ctx.font = `${h * 0.02}px ${font}`;
    ctx.fillText(`מק״ט: ${product.sku}`, textX, bottomY);
  }
}

async function drawShowcaseProduct(
  ctx: CanvasRenderingContext2D,
  product: CatalogProduct,
  startY: number,
  pageW: number,
  pageH: number,
  settings: CatalogSettings,
) {
  const font = FONT_MAP[settings.fontFamily];
  const padding = pageW * 0.06;
  const availH = pageH - startY - pageW * 0.1;
  const imageH = availH * 0.7;

  const elVis = {
    showImage: product.hideElements?.showImage ?? settings.globalElementToggle?.showImage ?? true,
    showName: product.hideElements?.showName ?? settings.globalElementToggle?.showName ?? true,
    showDescription: product.hideElements?.showDescription ?? settings.globalElementToggle?.showDescription ?? true,
    showPrice: product.hideElements?.showPrice ?? settings.globalElementToggle?.showPrice ?? true,
    showSku: product.hideElements?.showSku ?? settings.globalElementToggle?.showSku ?? true,
  };
  const frame: FrameStyle = product.frameStyle || settings.globalFrame || "none";
  const nameScale = (product.customFontSize ?? settings.productNameSize) || 1;
  const priceScale = settings.productPriceSize || 1;
  const descScale = settings.productDescSize || 1;

  // Large product image
  if (elVis.showImage) {
    try {
      const img = await loadImage(product.image);
      const imgW = pageW - padding * 2;
      const scale = Math.min(imgW / img.naturalWidth, imageH / img.naturalHeight);
      const drawW = img.naturalWidth * scale;
      const drawH = img.naturalHeight * scale;
      const drawX = (pageW - drawW) / 2;
      const drawY = startY + (imageH - drawH) / 2;

      ctx.save();
      const clipped = applyFrameClip(ctx, frame, drawX, drawY, drawW, drawH);
      if (!clipped) {
        ctx.shadowColor = "rgba(0,0,0,0.2)";
        ctx.shadowBlur = 40;
        ctx.shadowOffsetY = 10;
      }
      ctx.drawImage(img, drawX, drawY, drawW, drawH);
      ctx.restore();

      if (frame !== "none") {
        drawFrame(ctx, frame, drawX, drawY, drawW, drawH, settings.brandColor, settings.accentColor);
      }
    } catch { /* skip */ }
  }

  // Product info
  const infoY = startY + imageH + padding;
  ctx.textAlign = "center";

  if (elVis.showName) {
    ctx.fillStyle = settings.textColor;
    ctx.font = `bold ${pageW * 0.04 * nameScale}px ${font}`;
    ctx.fillText(product.name, pageW / 2, infoY);
  }

  if (elVis.showDescription && settings.showDescriptions && product.description) {
    ctx.font = `${pageW * 0.02 * descScale}px ${font}`;
    ctx.fillStyle = hexToRgba(settings.textColor, 0.6);
    wrapText(ctx, product.description, pageW * 0.15, infoY + pageW * 0.05, pageW * 0.7, pageW * 0.028 * descScale, 3);
  }

  if (elVis.showPrice && settings.showPrices && product.price) {
    ctx.font = `bold ${pageW * 0.05 * priceScale}px ${font}`;
    ctx.fillStyle = settings.brandColor;
    ctx.fillText(product.price, pageW / 2, infoY + pageW * 0.13);
  }

  if (elVis.showSku && settings.showSku && product.sku) {
    ctx.font = `${pageW * 0.015}px ${font}`;
    ctx.fillStyle = hexToRgba(settings.textColor, 0.35);
    ctx.fillText(`מק״ט: ${product.sku}`, pageW / 2, infoY + pageW * 0.17);
  }

  ctx.textAlign = "start";
}

async function drawLookbookProduct(
  ctx: CanvasRenderingContext2D,
  product: CatalogProduct,
  x: number, y: number, w: number, h: number,
  settings: CatalogSettings,
) {
  const font = FONT_MAP[settings.fontFamily];
  const elVis = {
    showImage: product.hideElements?.showImage ?? settings.globalElementToggle?.showImage ?? true,
    showName: product.hideElements?.showName ?? settings.globalElementToggle?.showName ?? true,
    showPrice: product.hideElements?.showPrice ?? settings.globalElementToggle?.showPrice ?? true,
  };
  const frame: FrameStyle = product.frameStyle || settings.globalFrame || "none";
  const nameScale = (product.customFontSize ?? settings.productNameSize) || 1;
  const priceScale = settings.productPriceSize || 1;

  // Full-bleed image
  if (elVis.showImage) {
    try {
      const img = await loadImage(product.image);
      const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
      const drawW = img.naturalWidth * scale;
      const drawH = img.naturalHeight * scale;
      const drawX = x + (w - drawW) / 2;
      const drawY = y + (h - drawH) / 2;
      ctx.save();
      const clipped = applyFrameClip(ctx, frame, x, y, w, h);
      if (!clipped) {
        ctx.beginPath();
        ctx.rect(x, y, w, h);
        ctx.clip();
      }
      ctx.drawImage(img, drawX, drawY, drawW, drawH);
      ctx.restore();

      if (frame !== "none") {
        drawFrame(ctx, frame, x, y, w, h, settings.brandColor, settings.accentColor);
      }
    } catch { /* skip */ }
  }

  // Gradient overlay at bottom
  const gradH = h * 0.4;
  const grad = ctx.createLinearGradient(x, y + h - gradH, x, y + h);
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(1, "rgba(0,0,0,0.7)");
  ctx.fillStyle = grad;
  ctx.fillRect(x, y + h - gradH, w, gradH);

  // Text on overlay
  const padding = w * 0.06;
  if (elVis.showName) {
    ctx.fillStyle = "#ffffff";
    ctx.font = `bold ${w * 0.045 * nameScale}px ${font}`;
    ctx.textAlign = "right";
    ctx.fillText(product.name, x + w - padding, y + h - padding * 2.5);
  }

  if (elVis.showPrice && settings.showPrices && product.price) {
    ctx.font = `bold ${w * 0.055 * priceScale}px ${font}`;
    ctx.fillStyle = settings.accentColor;
    ctx.textAlign = "right";
    ctx.fillText(product.price, x + w - padding, y + h - padding);
  }
  ctx.textAlign = "start";
}

// ─── Render Cover Page ───────────────────────────────────────
async function renderCoverPage(
  settings: CatalogSettings,
  products: CatalogProduct[],
  totalPages: number,
): Promise<HTMLCanvasElement> {
  const { w: pageW, h: pageH } = PAGE_SIZES[settings.pageSize];
  const canvas = document.createElement("canvas");
  canvas.width = pageW;
  canvas.height = pageH;
  const ctx = canvas.getContext("2d")!;
  const font = FONT_MAP[settings.fontFamily];

  // Background
  if (settings.template === "luxury") {
    ctx.fillStyle = "#0d0d1a";
    ctx.fillRect(0, 0, pageW, pageH);
    // Gold border
    ctx.strokeStyle = settings.accentColor;
    ctx.lineWidth = 8;
    ctx.strokeRect(60, 60, pageW - 120, pageH - 120);
    ctx.strokeStyle = hexToRgba(settings.accentColor, 0.3);
    ctx.lineWidth = 2;
    ctx.strokeRect(80, 80, pageW - 160, pageH - 160);
  } else {
    ctx.fillStyle = settings.bgColor;
    ctx.fillRect(0, 0, pageW, pageH);
    // Brand stripe
    ctx.fillStyle = settings.brandColor;
    ctx.fillRect(0, 0, pageW, pageH * 0.45);
  }

  // Logo
  if (settings.logo) {
    try {
      const logoImg = await loadImage(settings.logo);
      const logoH = pageH * 0.08;
      const logoW = (logoImg.naturalWidth / logoImg.naturalHeight) * logoH;
      ctx.drawImage(logoImg, (pageW - logoW) / 2, pageH * 0.12, logoW, logoH);
    } catch { /* skip */ }
  }

  // Title
  ctx.textAlign = "center";
  const titleColor = settings.template === "luxury" ? settings.accentColor : "#ffffff";
  ctx.fillStyle = titleColor;
  ctx.font = `bold ${pageW * 0.06}px ${font}`;
  ctx.fillText(settings.title, pageW / 2, pageH * 0.3);

  // Subtitle
  if (settings.subtitle) {
    ctx.fillStyle = hexToRgba(titleColor, 0.7);
    ctx.font = `${pageW * 0.025}px ${font}`;
    ctx.fillText(settings.subtitle, pageW / 2, pageH * 0.36);
  }

  // Product thumbnails grid on cover (up to 6)
  const thumbCount = Math.min(products.length, 6);
  if (thumbCount > 0) {
    const thumbCols = Math.min(thumbCount, 3);
    const thumbRows = Math.ceil(thumbCount / thumbCols);
    const thumbAreaW = pageW * 0.7;
    const thumbAreaH = pageH * 0.35;
    const thumbW = (thumbAreaW - (thumbCols - 1) * 20) / thumbCols;
    const thumbH = (thumbAreaH - (thumbRows - 1) * 20) / thumbRows;
    const thumbStartX = (pageW - thumbAreaW) / 2;
    const thumbStartY = pageH * 0.48;

    for (let i = 0; i < thumbCount; i++) {
      const col = i % thumbCols;
      const row = Math.floor(i / thumbCols);
      const tx = thumbStartX + col * (thumbW + 20);
      const ty = thumbStartY + row * (thumbH + 20);

      try {
        const img = await loadImage(products[i].image);
        ctx.save();
        drawRoundedRect(ctx, tx, ty, thumbW, thumbH, 12);
        ctx.clip();
        const scale = Math.max(thumbW / img.naturalWidth, thumbH / img.naturalHeight);
        const dw = img.naturalWidth * scale;
        const dh = img.naturalHeight * scale;
        ctx.drawImage(img, tx + (thumbW - dw) / 2, ty + (thumbH - dh) / 2, dw, dh);
        ctx.restore();
      } catch { /* skip */ }
    }
  }

  // Product count + page count
  ctx.fillStyle = hexToRgba(settings.textColor, 0.4);
  ctx.font = `${pageW * 0.018}px ${font}`;
  ctx.fillText(`${products.length} מוצרים · ${totalPages} עמודים`, pageW / 2, pageH * 0.92);

  // Contact info
  if (settings.contactInfo) {
    ctx.fillStyle = hexToRgba(settings.textColor, 0.5);
    ctx.font = `${pageW * 0.015}px ${font}`;
    ctx.fillText(settings.contactInfo, pageW / 2, pageH * 0.95);
  }

  ctx.textAlign = "start";
  return canvas;
}

// ─── Main Render Function ────────────────────────────────────
export async function generateCatalog(
  products: CatalogProduct[],
  settings: CatalogSettings,
  onProgress?: (page: number, total: number) => void,
  categories?: CatalogCategory[],
): Promise<CatalogPage[]> {
  const { w: pageW, h: pageH } = PAGE_SIZES[settings.pageSize];
  const itemsPerPage = getItemsPerPage(settings.template, settings.columns);
  const cats = categories && categories.length > 0 ? categories : [];
  const useCategories = cats.length > 0 && settings.showCategoryDividers;

  // Build ordered product groups
  type ProductGroup = { category?: CatalogCategory; products: CatalogProduct[] };
  const groups: ProductGroup[] = [];
  if (useCategories) {
    for (const cat of cats) {
      const catProds = products.filter(p => p.category === cat.id);
      if (catProds.length > 0) groups.push({ category: cat, products: catProds });
    }
    // Uncategorized
    const uncategorized = products.filter(p => !p.category || !cats.find(c => c.id === p.category));
    if (uncategorized.length > 0) groups.push({ products: uncategorized });
  } else {
    groups.push({ products });
  }

  // Calculate total pages
  let totalPages = 1; // cover
  const categoryPageMap = new Map<string, number>();
  if (settings.showToc && cats.length > 0) totalPages++; // TOC
  for (const group of groups) {
    if (group.category && useCategories) {
      categoryPageMap.set(group.category.id, totalPages + 1);
      totalPages++; // divider
    }
    totalPages += Math.ceil(group.products.length / itemsPerPage);
  }
  // Price list pages
  const priceListItemsPerPage = 22;
  const priceListProducts = products.filter(p => p.price);
  const priceListPages = settings.showPriceList && priceListProducts.length > 0
    ? Math.ceil(priceListProducts.length / priceListItemsPerPage) : 0;
  totalPages += priceListPages;
  if (settings.showBackCover) totalPages++;

  const pages: CatalogPage[] = [];
  let pageCounter = 0;

  const pushPage = (canvas: HTMLCanvasElement, type: CatalogPage["type"]) => {
    pages.push({
      pageNumber: pageCounter,
      canvas,
      dataUrl: canvas.toDataURL("image/png"),
      type,
    });
    pageCounter++;
  };

  // ── Cover ──────────────────────────────────────────────
  onProgress?.(0, totalPages);
  const coverCanvas = await renderCoverPage(settings, products, totalPages);
  pushPage(coverCanvas, "cover");

  // ── TOC ────────────────────────────────────────────────
  if (settings.showToc && cats.length > 0) {
    onProgress?.(pageCounter, totalPages);
    const tocCanvas = await renderTocPage(settings, cats, products, categoryPageMap);
    pushPage(tocCanvas, "toc");
  }

  // ── Product pages (by group) ───────────────────────────
  for (const group of groups) {
    // Category divider
    if (group.category && useCategories) {
      onProgress?.(pageCounter, totalPages);
      const divCanvas = await renderDividerPage(settings, group.category, group.products);
      pushPage(divCanvas, "divider");
    }

    const groupProducts = group.products;
    const groupPages = Math.ceil(groupProducts.length / itemsPerPage);

    for (let p = 0; p < groupPages; p++) {
      onProgress?.(pageCounter, totalPages);
      const pageProducts = groupProducts.slice(p * itemsPerPage, (p + 1) * itemsPerPage);
      const canvas = document.createElement("canvas");
      canvas.width = pageW;
      canvas.height = pageH;
      const ctx = canvas.getContext("2d")!;

      // Background
      ctx.fillStyle = settings.template === "luxury" ? "#0d0d1a" : settings.bgColor;
      ctx.fillRect(0, 0, pageW, pageH);

      // Background pattern
      drawBgPattern(ctx, settings.bgPattern, pageW, pageH, settings.textColor);

      // Header
      const contentTop = await drawHeader(ctx, settings, pageW, pageH);

      // Watermark
      if (settings.watermark) {
        drawWatermark(ctx, settings.watermark, pageW, pageH, FONT_MAP[settings.fontFamily]);
      }

      // Footer
      drawFooter(ctx, settings, pageW, pageH, pageCounter + 1, totalPages);

      const padding = pageW * 0.04;
      const contentBottom = pageH - pageW * 0.06;
      const contentH = contentBottom - contentTop;
      const contentW = pageW - padding * 2;

      // Render products based on template
      if (settings.template === "showcase") {
        if (pageProducts[0]) {
          await drawShowcaseProduct(ctx, pageProducts[0], contentTop, pageW, pageH, settings);
        }
      } else if (settings.template === "lookbook") {
        const halfH = contentH / 2;
        for (let i = 0; i < Math.min(pageProducts.length, 2); i++) {
          await drawLookbookProduct(
            ctx, pageProducts[i],
            padding, contentTop + i * halfH, contentW, halfH - 10,
            settings,
          );
        }
      } else {
        // Grid-based layouts
        const cols = settings.columns;
        const rows = Math.ceil(pageProducts.length / cols);
        const gap = pageW * 0.02;
        const cardW = (contentW - (cols - 1) * gap) / cols;
        const cardH = (contentH - (rows - 1) * gap) / rows;

        for (let i = 0; i < pageProducts.length; i++) {
          const col = i % cols;
          const row = Math.floor(i / cols);
          const cardX = padding + col * (cardW + gap);
          const cardY = contentTop + row * (cardH + gap);
          await drawProductCard(
            ctx, pageProducts[i],
            cardX, cardY, cardW, cardH,
            settings, settings.template,
          );
        }
      }

      // Luxury border
      if (settings.template === "luxury") {
        ctx.strokeStyle = hexToRgba(settings.accentColor, 0.2);
        ctx.lineWidth = 2;
        ctx.strokeRect(padding, padding, pageW - padding * 2, pageH - padding * 2);
      }

      // Text overlays for this page
      if (settings.textOverlays?.length) {
        drawTextOverlays(ctx, settings.textOverlays, pageCounter, pageW, pageH);
      }

      pushPage(canvas, "products");
    }
  }

  // ── Price List ─────────────────────────────────────────
  if (priceListPages > 0) {
    for (let pl = 0; pl < priceListPages; pl++) {
      onProgress?.(pageCounter, totalPages);
      const plProducts = priceListProducts.slice(pl * priceListItemsPerPage, (pl + 1) * priceListItemsPerPage);
      const plCanvas = await renderPriceListPage(settings, plProducts, pl, priceListPages);
      pushPage(plCanvas, "price-list");
    }
  }

  // ── Back Cover ─────────────────────────────────────────
  if (settings.showBackCover) {
    onProgress?.(pageCounter, totalPages);
    const backCanvas = await renderBackCover(settings);
    pushPage(backCanvas, "back-cover");
  }

  return pages;
}

// ─── PDF Export ──────────────────────────────────────────────
export async function catalogToPDF(pages: CatalogPage[]): Promise<Blob> {
  // Multi-page PDF from canvas pages
  const enc = new TextEncoder();
  const allParts: Uint8Array[] = [];
  const offsets: number[] = [];
  let byteOffset = 0;

  const header = enc.encode("%PDF-1.4\n");
  allParts.push(header);
  byteOffset += header.length;

  const objCount = 2 + pages.length * 3; // catalog + pages-tree + (page + stream + image) per page
  let objIndex = 1;

  // Object 1: Catalog
  offsets.push(byteOffset);
  const catalogObj = enc.encode(`${objIndex} 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`);
  allParts.push(catalogObj);
  byteOffset += catalogObj.length;
  objIndex++;

  // Object 2: Pages tree (filled after we know page objects)
  const pageObjIds: number[] = [];
  offsets.push(byteOffset);
  // Placeholder — we'll build it properly
  const pagesPlaceholder = `2 0 obj\n<< /Type /Pages /Kids [${pages.map((_, i) => `${3 + i * 3} 0 R`).join(" ")}] /Count ${pages.length} >>\nendobj\n`;
  const pagesObj = enc.encode(pagesPlaceholder);
  allParts.push(pagesObj);
  byteOffset += pagesObj.length;
  objIndex++;

  // Per page: Page obj, Content stream obj, Image XObject
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const w = page.canvas.width;
    const h = page.canvas.height;

    // Convert to JPEG for smaller PDF
    const jpegDataUrl = page.canvas.toDataURL("image/jpeg", 0.85);
    const jpegBase64 = jpegDataUrl.split(",")[1];
    const jpegBinary = atob(jpegBase64);
    const jpegBytes = new Uint8Array(jpegBinary.length);
    for (let j = 0; j < jpegBinary.length; j++) jpegBytes[j] = jpegBinary.charCodeAt(j);

    // Scale to PDF points (A4 = 595×842 pt)
    const pdfScale = Math.min(595 / w, 842 / h);
    const pw = Math.round(w * pdfScale);
    const ph = Math.round(h * pdfScale);

    const pageObjId = objIndex;
    const streamObjId = objIndex + 1;
    const imageObjId = objIndex + 2;

    // Page object
    offsets.push(byteOffset);
    const pageObj = enc.encode(
      `${pageObjId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw} ${ph}] /Contents ${streamObjId} 0 R /Resources << /XObject << /Img${i} ${imageObjId} 0 R >> >> >>\nendobj\n`
    );
    allParts.push(pageObj);
    byteOffset += pageObj.length;

    // Content stream
    const stream = `q ${pw} 0 0 ${ph} 0 0 cm /Img${i} Do Q`;
    offsets.push(byteOffset);
    const streamObj = enc.encode(
      `${streamObjId} 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\n`
    );
    allParts.push(streamObj);
    byteOffset += streamObj.length;

    // Image XObject
    offsets.push(byteOffset);
    const imgHeader = enc.encode(
      `${imageObjId} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`
    );
    const imgFooter = enc.encode(`\nendstream\nendobj\n`);
    allParts.push(imgHeader);
    byteOffset += imgHeader.length;
    allParts.push(jpegBytes);
    byteOffset += jpegBytes.length;
    allParts.push(imgFooter);
    byteOffset += imgFooter.length;

    objIndex += 3;
  }

  // Cross-reference table
  const xrefStart = byteOffset;
  const totalObjs = objIndex;
  let xref = `xref\n0 ${totalObjs}\n0000000000 65535 f \n`;
  for (const off of offsets) {
    xref += `${String(off).padStart(10, "0")} 00000 n \n`;
  }
  const trailer = `trailer\n<< /Size ${totalObjs} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  const xrefData = enc.encode(xref + trailer);
  allParts.push(xrefData);

  // Merge all parts
  const totalLen = allParts.reduce((s, p) => s + p.length, 0);
  const result = new Uint8Array(totalLen);
  let pos = 0;
  for (const part of allParts) {
    result.set(part, pos);
    pos += part.length;
  }

  return new Blob([result], { type: "application/pdf" });
}

// ─── Default Settings ────────────────────────────────────────
export const defaultCatalogSettings: CatalogSettings = {
  title: "קטלוג מוצרים",
  subtitle: "",
  brandColor: "#6366f1",
  accentColor: "#f59e0b",
  bgColor: "#ffffff",
  textColor: "#1a1a2e",
  fontFamily: "sans",
  template: "grid-shadow",
  pageSize: "A4",
  showPrices: true,
  showSku: true,
  showDescriptions: true,
  showPageNumbers: true,
  showHeader: true,
  showToc: false,
  showBackCover: true,
  showPriceList: false,
  showCategoryDividers: true,
  columns: 2,
  bgPattern: "none",
  coverStyle: "modern",
  globalFrame: "none",
  productNameSize: 1,
  productDescSize: 1,
  productPriceSize: 1,
  textOverlays: [],
  globalElementToggle: {
    showImage: true,
    showName: true,
    showDescription: true,
    showPrice: true,
    showSku: true,
    showBadge: true,
  },
};

export const TEMPLATE_OPTIONS: { id: CatalogTemplate; label: string; icon: string; desc: string }[] = [
  { id: "grid-clean", label: "גריד נקי", icon: "📐", desc: "רשת נקייה עם מסגרות עדינות" },
  { id: "grid-shadow", label: "גריד צללים", icon: "🎴", desc: "כרטיסים עם צללים מעוצבים" },
  { id: "magazine", label: "מגזין", icon: "📰", desc: "פריסה מגזינית מקצועית" },
  { id: "minimal", label: "מינימלי", icon: "◻️", desc: "עיצוב נקי עם הרבה רווח" },
  { id: "luxury", label: "יוקרה", icon: "👑", desc: "רקע כהה עם מבטאי זהב" },
  { id: "catalog-pro", label: "קטלוג Pro", icon: "📋", desc: "קטלוג קלאסי מקצועי" },
  { id: "lookbook", label: "לוקבוק", icon: "📸", desc: "תמונות מלאות עם טקסט שקוף" },
  { id: "showcase", label: "תצוגה", icon: "🖼️", desc: "מוצר אחד גדול בעמוד" },
];

export const BG_PATTERN_OPTIONS: { id: BgPattern; label: string }[] = [
  { id: "none", label: "ללא" },
  { id: "dots", label: "נקודות" },
  { id: "lines", label: "קווים" },
  { id: "grid", label: "רשת" },
  { id: "diagonal", label: "אלכסון" },
  { id: "circles", label: "עיגולים" },
];

export const FRAME_STYLE_OPTIONS: { id: FrameStyle; label: string; icon: string }[] = [
  { id: "none", label: "ללא מסגרת", icon: "◻️" },
  { id: "thin", label: "דקה", icon: "▫️" },
  { id: "rounded", label: "מעוגלת", icon: "⬜" },
  { id: "shadow-box", label: "צל תלת-ממד", icon: "🔲" },
  { id: "double", label: "כפולה", icon: "⏹️" },
  { id: "modern-float", label: "מודרנית צפה", icon: "💠" },
  { id: "curated-arch", label: "קשת קיורטית", icon: "🏛️" },
  { id: "curated-oval", label: "אובלית קיורטית", icon: "🪞" },
  { id: "polaroid", label: "פולרויד", icon: "📷" },
  { id: "film-strip", label: "סרט צילום", icon: "🎞️" },
  { id: "ornate-gold", label: "מוזהבת מפוארת", icon: "🖼️" },
  { id: "ornate-classic", label: "קלאסית מפוארת", icon: "🎨" },
  { id: "brush-stroke", label: "משיכת מכחול", icon: "🖌️" },
  { id: "torn-paper", label: "נייר קרוע", icon: "📜" },
  { id: "neon-glow", label: "נאון זוהר", icon: "💡" },
  { id: "gradient-border", label: "גרדיאנט", icon: "🌈" },
];

export { getItemsPerPage };
