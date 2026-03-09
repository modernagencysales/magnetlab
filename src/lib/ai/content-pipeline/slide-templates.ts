/**
 * Carousel Slide HTML Templates
 *
 * Renders branded HTML for 5 slide types (title, quote, stat, list, cta)
 * designed for ScreenshotOne to capture as 1080x1350 images.
 */

import type { CarouselSlide } from '@/lib/types/content-pipeline';

// ---------------------------------------------------------------------------
// Public constants
// ---------------------------------------------------------------------------

export const SLIDE_DIMENSIONS = { width: 1080, height: 1350 } as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SlidesBrandKit {
  default_primary_color?: string | null;
  font_family?: string | null;
  logo_url?: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FALLBACK_COLOR = '#8b5cf6';
const FALLBACK_FONT = 'Inter';

/** Returns a readable text color for the given hex background. */
function getContrastColor(hex: string): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  // Perceived luminance (ITU-R BT.709)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#1a1a1a' : '#ffffff';
}

/** Escape HTML entities to prevent XSS. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Resolve brand values with fallbacks. */
function resolveBrand(brand: SlidesBrandKit) {
  const primaryColor = brand.default_primary_color || FALLBACK_COLOR;
  const fontFamily = brand.font_family || FALLBACK_FONT;
  const textColor = getContrastColor(primaryColor);
  return { primaryColor, fontFamily, textColor };
}

/** Google Fonts import statement. */
function fontImport(fontFamily: string): string {
  return `@import url('https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontFamily)}&display=swap');`;
}

/** Base CSS reset + brand styles shared by all slides. */
function baseStyles(brand: SlidesBrandKit): string {
  const { primaryColor, fontFamily, textColor } = resolveBrand(brand);
  return `
    ${fontImport(fontFamily)}
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: ${SLIDE_DIMENSIONS.width}px;
      height: ${SLIDE_DIMENSIONS.height}px;
      font-family: '${fontFamily}', sans-serif;
      background: ${primaryColor};
      color: ${textColor};
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
  `;
}

/** Logo image tag or empty string. */
function logoHtml(brand: SlidesBrandKit): string {
  if (!brand.logo_url) return '';
  return `<img src="${escapeHtml(brand.logo_url)}" alt="Logo" style="height:48px;width:auto;object-fit:contain;" />`;
}

// ---------------------------------------------------------------------------
// Slide renderers
// ---------------------------------------------------------------------------

function titleSlide(slide: CarouselSlide, brand: SlidesBrandKit): string {
  const { textColor } = resolveBrand(brand);
  const logo = logoHtml(brand);
  return `
    <style>
      ${baseStyles(brand)}
      .title-container {
        flex: 1;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        padding: 80px 72px;
        text-align: center;
      }
      .title-heading {
        font-size: 64px;
        font-weight: 800;
        line-height: 1.15;
        margin-bottom: 32px;
        color: ${textColor};
      }
      .title-body {
        font-size: 28px;
        font-weight: 400;
        opacity: 0.8;
        color: ${textColor};
      }
      .title-logo {
        position: absolute;
        top: 48px;
        left: 72px;
      }
    </style>
    ${logo ? `<div class="title-logo">${logo}</div>` : ''}
    <div class="title-container">
      <div class="title-heading">${escapeHtml(slide.heading)}</div>
      ${slide.body ? `<div class="title-body">${escapeHtml(slide.body)}</div>` : ''}
    </div>
  `;
}

function quoteSlide(slide: CarouselSlide, brand: SlidesBrandKit): string {
  const { textColor } = resolveBrand(brand);
  const logo = logoHtml(brand);
  return `
    <style>
      ${baseStyles(brand)}
      .quote-container {
        flex: 1;
        display: flex;
        flex-direction: column;
        justify-content: center;
        padding: 80px 72px;
      }
      .quote-mark {
        font-size: 120px;
        line-height: 1;
        opacity: 0.3;
        color: ${textColor};
        margin-bottom: 16px;
      }
      .quote-text {
        font-size: 44px;
        font-weight: 600;
        line-height: 1.35;
        font-style: italic;
        color: ${textColor};
      }
      .quote-logo {
        position: absolute;
        bottom: 48px;
        right: 72px;
      }
    </style>
    <div class="quote-container">
      <div class="quote-mark">\u201C</div>
      <div class="quote-text">${escapeHtml(slide.body)}</div>
    </div>
    ${logo ? `<div class="quote-logo">${logo}</div>` : ''}
  `;
}

function statSlide(slide: CarouselSlide, brand: SlidesBrandKit): string {
  const { textColor } = resolveBrand(brand);
  const logo = logoHtml(brand);
  return `
    <style>
      ${baseStyles(brand)}
      .stat-container {
        flex: 1;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        padding: 80px 72px;
        text-align: center;
      }
      .stat-number {
        font-size: 140px;
        font-weight: 900;
        line-height: 1;
        margin-bottom: 32px;
        color: ${textColor};
      }
      .stat-label {
        font-size: 36px;
        font-weight: 400;
        opacity: 0.85;
        color: ${textColor};
        max-width: 700px;
      }
      .stat-logo {
        position: absolute;
        bottom: 48px;
        right: 72px;
      }
    </style>
    <div class="stat-container">
      <div class="stat-number">${escapeHtml(slide.heading)}</div>
      <div class="stat-label">${escapeHtml(slide.body)}</div>
    </div>
    ${logo ? `<div class="stat-logo">${logo}</div>` : ''}
  `;
}

function listSlide(slide: CarouselSlide, brand: SlidesBrandKit): string {
  const { textColor } = resolveBrand(brand);
  const logo = logoHtml(brand);

  // Split body by newlines, strip leading numbering or bullet prefixes
  const items = slide.body
    .split('\n')
    .map((line) => line.replace(/^\s*(?:\d+[.)]\s*|-\s*)/, '').trim())
    .filter(Boolean);

  const itemsHtml = items
    .map(
      (item, i) => `
      <div class="list-item">
        <div class="list-bullet" style="background:${textColor}20;color:${textColor};">${i + 1}</div>
        <div class="list-text">${escapeHtml(item)}</div>
      </div>`
    )
    .join('');

  return `
    <style>
      ${baseStyles(brand)}
      .list-container {
        flex: 1;
        display: flex;
        flex-direction: column;
        padding: 80px 72px;
      }
      .list-heading {
        font-size: 52px;
        font-weight: 800;
        margin-bottom: 48px;
        color: ${textColor};
      }
      .list-items {
        display: flex;
        flex-direction: column;
        gap: 28px;
      }
      .list-item {
        display: flex;
        align-items: flex-start;
        gap: 20px;
      }
      .list-bullet {
        flex-shrink: 0;
        width: 44px;
        height: 44px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 700;
        font-size: 22px;
      }
      .list-text {
        font-size: 32px;
        line-height: 1.4;
        padding-top: 4px;
        color: ${textColor};
      }
      .list-logo {
        position: absolute;
        bottom: 48px;
        right: 72px;
      }
    </style>
    <div class="list-container">
      <div class="list-heading">${escapeHtml(slide.heading)}</div>
      <div class="list-items">${itemsHtml}</div>
    </div>
    ${logo ? `<div class="list-logo">${logo}</div>` : ''}
  `;
}

function ctaSlide(slide: CarouselSlide, brand: SlidesBrandKit): string {
  const { textColor } = resolveBrand(brand);
  const logo = logoHtml(brand);
  return `
    <style>
      ${baseStyles(brand)}
      .cta-container {
        flex: 1;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        padding: 80px 72px;
        text-align: center;
      }
      .cta-heading {
        font-size: 60px;
        font-weight: 800;
        line-height: 1.15;
        margin-bottom: 28px;
        color: ${textColor};
      }
      .cta-body {
        font-size: 32px;
        font-weight: 400;
        opacity: 0.85;
        color: ${textColor};
        max-width: 700px;
      }
      .cta-logo {
        position: absolute;
        bottom: 48px;
        left: 50%;
        transform: translateX(-50%);
      }
    </style>
    <div class="cta-container">
      <div class="cta-heading">${escapeHtml(slide.heading)}</div>
      ${slide.body ? `<div class="cta-body">${escapeHtml(slide.body)}</div>` : ''}
    </div>
    ${logo ? `<div class="cta-logo">${logo}</div>` : ''}
  `;
}

// ---------------------------------------------------------------------------
// Renderer map
// ---------------------------------------------------------------------------

const renderers: Record<CarouselSlide['type'], (slide: CarouselSlide, brand: SlidesBrandKit) => string> = {
  title: titleSlide,
  quote: quoteSlide,
  stat: statSlide,
  list: listSlide,
  cta: ctaSlide,
};

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Build a complete HTML document for a single carousel slide.
 * Designed to be rendered at 1080x1350 by ScreenshotOne.
 */
export function buildSlideHtml(slide: CarouselSlide, brand: SlidesBrandKit): string {
  const render = renderers[slide.type] ?? renderers.title;
  const inner = render(slide, brand);
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${inner}</body></html>`;
}
