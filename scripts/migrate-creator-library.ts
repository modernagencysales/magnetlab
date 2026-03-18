/**
 * migrate-creator-library.ts
 * One-time migration script: scrape 37 resources from Creator.io library,
 * convert HTML to markdown, and save as JSON for subsequent import into magnetlab.
 *
 * Usage:
 *   npx tsx scripts/migrate-creator-library.ts --phase=scrape
 *   npx tsx scripts/migrate-creator-library.ts --phase=transform  (not yet implemented)
 *   npx tsx scripts/migrate-creator-library.ts --phase=import     (not yet implemented)
 *
 * Never imports from src/ — this is a standalone migration script.
 */

import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';
import TurndownService from 'turndown';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ResourceConfig {
  id: string;
  title: string;
  emoji: string;
  featured: boolean;
  order: number;
}

interface ScrapedSection {
  heading: string;
  bodyMarkdown: string;
}

interface ScrapedResource {
  creatorId: string;
  title: string;
  emoji: string;
  readTime: string;
  isFeatured: boolean;
  sortOrder: number;
  introMarkdown: string;
  sections: ScrapedSection[];
}

// ─── Resource List ────────────────────────────────────────────────────────────

const RESOURCES: ResourceConfig[] = [
  {
    id: '695cda48a4cd5c57a94d95f7',
    title: "The 'No-Pitch' Teardown Framework",
    emoji: '🛠️',
    featured: true,
    order: 1,
  },
  {
    id: '695cd98cb3b4cbb9f9863d85',
    title: 'The $100k Case Study Breakdown',
    emoji: '📈',
    featured: true,
    order: 2,
  },
  {
    id: '695cd9f5b1cee85669d6b01e',
    title: "The Agency Founder's 'Sales-Led' Roadmap",
    emoji: '🗺️',
    featured: true,
    order: 3,
  },
  {
    id: '695cda480b1c93bdea089112',
    title: "The 'Agency Sales' Red Flag Guide",
    emoji: '🚩',
    featured: true,
    order: 4,
  },
  {
    id: '695cda34da68a299864b2094',
    title: "The 'Human' LinkedIn Automation SOP",
    emoji: '🤖',
    featured: true,
    order: 5,
  },
  {
    id: '695cda34d61559b0a8362db2',
    title: "The 'Agency Deal' Closing Checklist",
    emoji: '🏁',
    featured: true,
    order: 6,
  },
  {
    id: '695cda1d1c2f72d78f05a186',
    title: "The 'Safe to Pay' Brand Blueprint",
    emoji: '🛡️',
    featured: false,
    order: 7,
  },
  {
    id: '695cda0a5ffce4fd70776ab1',
    title: "The 'Incisive' Audit Template",
    emoji: '🔍',
    featured: false,
    order: 8,
  },
  {
    id: '695cda0a46957c861aad0f28',
    title: "The 'Zero-to-Owned' Pipeline Checklist",
    emoji: '✅',
    featured: false,
    order: 9,
  },
  {
    id: '695cda0a818c65689384d687',
    title: "The 'Smart' Agency Hiring Kit",
    emoji: '👥',
    featured: false,
    order: 10,
  },
  {
    id: '695cd9f5b1960dd4dbb9c8db',
    title: "The 'Authority' Content Calendar",
    emoji: '📅',
    featured: false,
    order: 11,
  },
  {
    id: '695cda1de1cc3bd0c39ccaa5',
    title: "The 'Referral-Free' Revenue Calculator",
    emoji: '🧮',
    featured: false,
    order: 12,
  },
  {
    id: '695cda1e4d4631d8589a2c4f',
    title: "The 'Operator's' Guide to Clay",
    emoji: '🧱',
    featured: false,
    order: 13,
  },
  {
    id: '695cda489d0dc1e97e394d4e',
    title: "The 'Founder-Led' Content Vault",
    emoji: '🔓',
    featured: false,
    order: 14,
  },
  {
    id: '695cda346169e7a5dbf94ea8',
    title: "The 'Referral to Pipeline' Transition Case Study",
    emoji: '📔',
    featured: false,
    order: 15,
  },
  {
    id: '695cda72e4f856d362cdcfa6',
    title: "The 'Complete' Sales Onboarding Kit",
    emoji: '📦',
    featured: false,
    order: 16,
  },
  {
    id: '695cda5cb6e61538649cfbb6',
    title: "The 'Operator to Owner' Time Audit",
    emoji: '⏳',
    featured: false,
    order: 17,
  },
  {
    id: '695cda5c29c1f6f9333ab90e',
    title: "The 'Irresistible' Agency Offer Framework",
    emoji: '💎',
    featured: false,
    order: 18,
  },
  {
    id: '695cda5c77b2fef5bfda311e',
    title: "The 'Agency Sales' Year-in-Review",
    emoji: '📅',
    featured: false,
    order: 19,
  },
  {
    id: '695cd9f569568151f89e614b',
    title: "The 'High-Ticket' LinkedIn Ad Blueprint",
    emoji: '🚀',
    featured: false,
    order: 20,
  },
  {
    id: '695cd9e22576ffaf36fa72c1',
    title: "The 'Inbound Momentum' Tracker",
    emoji: '📊',
    featured: false,
    order: 21,
  },
  {
    id: '695cd9e2e1a505efd60e042e',
    title: 'The 6-Figure LinkedIn Profile Audit',
    emoji: '🕵️',
    featured: false,
    order: 22,
  },
  {
    id: '695cd9e270cea8b44898294e',
    title: "The 'Stalled Deal' Hail Mary Kit",
    emoji: '⚡',
    featured: false,
    order: 23,
  },
  {
    id: '695cd9cc65a523664cf68835',
    title: "The 'Price Objection' Annihilator",
    emoji: '🛡️',
    featured: false,
    order: 24,
  },
  {
    id: '695cd9cc13408bfe42f99c8e',
    title: "The 'No-Guru' Sales Call Script",
    emoji: '🎙️',
    featured: false,
    order: 25,
  },
  {
    id: '695cd9ccf08846c7fc0fb20b',
    title: "The 'Lying on the Couch' Proposal Fix",
    emoji: '🛋️',
    featured: false,
    order: 26,
  },
  {
    id: '695cd9b83bc405769c490041',
    title: "The ROI of 'Smarter' Cold Email Kit",
    emoji: '🤖',
    featured: false,
    order: 27,
  },
  {
    id: '695cd9b8474b43bb38cf2b49',
    title: "The 'Always-On' Market Alerting Framework",
    emoji: '📢',
    featured: false,
    order: 28,
  },
  {
    id: '695cd9b846957c861aad0ef5',
    title: "The Agency Sales 'Tightrope' Audit",
    emoji: '⚖️',
    featured: false,
    order: 29,
  },
  {
    id: '695cd9a2f08846c7fc0fb1f3',
    title: "The 'One Question' DM Closing Script",
    emoji: '💬',
    featured: false,
    order: 30,
  },
  {
    id: '695cd9a2a0bb52ed1d4fd8aa',
    title: "The 'Ghost-Proof' Qualification Scorecard",
    emoji: '👻',
    featured: false,
    order: 31,
  },
  {
    id: '695cd9a2bfefe5b67f4cdc24',
    title: 'The 7-Figure Agency Sale Post-Mortem',
    emoji: '💰',
    featured: false,
    order: 32,
  },
  {
    id: '695cd98c7b6063439d430724',
    title: "The 'Always-On' Email Nurture System",
    emoji: '📧',
    featured: false,
    order: 33,
  },
  {
    id: '695cd98c0ef57bd42431dafa',
    title: "The 'No-Fluff' Agency Sales Stack",
    emoji: '🛠️',
    featured: false,
    order: 34,
  },
  {
    id: '695cd9757d45f2afd37b92ce',
    title: 'The LinkedIn Lead Magnet OS',
    emoji: '⚙️',
    featured: false,
    order: 35,
  },
  {
    id: '695cd97447a75394f23e8397',
    title: "The 'Referral Trap' Escape Blueprint",
    emoji: '⛓️',
    featured: false,
    order: 36,
  },
  {
    id: '695cd97461e951e2d359c65b',
    title: "The 20-Minute 'Incisive' Proposal Template",
    emoji: '📄',
    featured: false,
    order: 37,
  },
];

const BASE_URL = 'https://app.getcreator.io/library-resource?id=';
const OUTPUT_DIR = path.join(__dirname, 'data');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'creator-scraped.json');
const DELAY_BETWEEN_PAGES_MS = 2000;
const PAGE_LOAD_TIMEOUT_MS = 30000;

// ─── Turndown Setup ───────────────────────────────────────────────────────────

function createTurndown(): TurndownService {
  const td = new TurndownService({
    headingStyle: 'atx',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
  });

  // Preserve tables as GFM markdown
  td.addRule('table', {
    filter: 'table',
    replacement(_content, node) {
      return (node as HTMLElement).outerHTML + '\n\n';
    },
  });

  return td;
}

// ─── Scrape Phase ─────────────────────────────────────────────────────────────

async function scrapeResource(
  page: Awaited<ReturnType<Awaited<ReturnType<typeof chromium.launch>>['newPage']>>,
  resource: ResourceConfig,
  turndown: TurndownService
): Promise<ScrapedResource> {
  const url = `${BASE_URL}${resource.id}`;

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: PAGE_LOAD_TIMEOUT_MS });

  // Wait for the h1 to appear — the page is a JS-rendered SPA
  await page.waitForSelector('h1', { timeout: PAGE_LOAD_TIMEOUT_MS });
  // Extra wait for body content to hydrate
  await page.waitForTimeout(1500);

  // Extract raw HTML from the page
  const extracted = await page.evaluate(() => {
    // ── Read time ────────────────────────────────────────────────────────────
    let readTime = '';
    const allText = document.querySelectorAll('*');
    for (const el of Array.from(allText)) {
      const text = (el as HTMLElement).innerText?.trim() ?? '';
      if (/^\d+\s+min\s+read$/i.test(text)) {
        readTime = text;
        break;
      }
    }

    // ── Content container ─────────────────────────────────────────────────────
    // The page renders inside a scrollable content area. We look for a container
    // that holds substantial body content (paragraphs after the h1 title).
    //
    // Strategy: find the h1, then walk up to locate the shared ancestor that
    // also contains h3 section headings. This is more reliable than guessing
    // class names which can change across deploys.
    const h1 = document.querySelector('h1');
    if (!h1) return { readTime, introHTML: '', sections: [] };

    // Walk up from h1 to find a container that also has h3 children
    let contentRoot: Element | null = h1.parentElement;
    while (contentRoot && contentRoot !== document.body) {
      if (contentRoot.querySelectorAll('h3').length > 0) break;
      contentRoot = contentRoot.parentElement;
    }
    if (!contentRoot) contentRoot = document.body;

    // ── Collect all direct/near-direct content children ───────────────────────
    // We want to iterate the flat list of block elements inside the content root.
    // Gather all block-level descendants that are immediate siblings at the
    // shallowest level below contentRoot that contains meaningful content.
    //
    // Practical approach: collect all elements, then flatten to the ones that
    // are children of contentRoot (or the first level that has the h3 elements).
    const h3s = Array.from(contentRoot.querySelectorAll('h3'));
    if (h3s.length === 0) {
      // No sections — entire body is intro
      const bodyEl = contentRoot as HTMLElement;
      // Strip the h1 itself and everything before it
      const clone = bodyEl.cloneNode(true) as HTMLElement;
      const cloneH1 = clone.querySelector('h1');
      if (cloneH1) {
        let node: Node | null = cloneH1;
        while (node) {
          const next: Node | null = node.nextSibling;
          node.parentNode?.removeChild(node);
          node = next;
          if (node && (node as Element).tagName === 'P') break; // found first content
        }
        cloneH1.parentNode?.removeChild(cloneH1);
      }
      return { readTime, introHTML: clone.innerHTML, sections: [] };
    }

    // ── CTA sentinel ──────────────────────────────────────────────────────────
    const CTA_MARKER = 'want help installing this system';
    const ctaH3 = h3s.find((h) => h.textContent?.toLowerCase().includes(CTA_MARKER));

    // ── Intro: everything between the h1 and the first h3 ────────────────────
    // We collect siblings of h1 (or their parent chain peers) that come before
    // the first h3. We use a TreeWalker on contentRoot for reliable ordering.
    const walker = document.createTreeWalker(contentRoot, NodeFilter.SHOW_ELEMENT);
    const allElements: Element[] = [];
    let node: Node | null = walker.nextNode();
    while (node) {
      allElements.push(node as Element);
      node = walker.nextNode();
    }

    // Filter to "block" elements we care about — only pick elements whose
    // parent is NOT another block we'd already include (avoid double-capturing).
    const BLOCK_TAGS = new Set([
      'P',
      'H1',
      'H2',
      'H3',
      'H4',
      'H5',
      'H6',
      'UL',
      'OL',
      'BLOCKQUOTE',
      'TABLE',
      'PRE',
      'HR',
      'DIV',
    ]);
    const blocks = allElements.filter((el) => {
      if (!BLOCK_TAGS.has(el.tagName)) return false;
      // Only include if parent is NOT also a block tag we're iterating
      const parentTag = el.parentElement?.tagName ?? '';
      if (parentTag === 'LI' || parentTag === 'TD' || parentTag === 'TH') return false;
      // Skip the H1 itself
      if (el.tagName === 'H1') return false;
      return true;
    });

    // Find positions of first h3 and CTA h3
    const firstH3Index = blocks.findIndex((el) => el.tagName === 'H3');
    const ctaIndex = ctaH3 ? blocks.indexOf(ctaH3) : blocks.length;

    // Intro HTML: from block[0] up to (not including) first H3
    const introBlocks = blocks.slice(0, firstH3Index === -1 ? blocks.length : firstH3Index);
    const introHTML = introBlocks.map((el) => (el as HTMLElement).outerHTML).join('\n');

    // ── Sections: from each H3 to the next H3 (or CTA or end) ────────────────
    const sections: Array<{ heading: string; bodyHTML: string }> = [];
    const h3Indices = blocks
      .map((el, i) => (el.tagName === 'H3' ? i : -1))
      .filter((i) => i !== -1)
      .filter((i) => i < ctaIndex);

    for (let s = 0; s < h3Indices.length; s++) {
      const startIdx = h3Indices[s];
      const endIdx = s + 1 < h3Indices.length ? h3Indices[s + 1] : ctaIndex;
      const heading = (blocks[startIdx] as HTMLElement).textContent?.trim() ?? '';
      const bodyBlocks = blocks.slice(startIdx + 1, endIdx);
      const bodyHTML = bodyBlocks.map((el) => (el as HTMLElement).outerHTML).join('\n');
      sections.push({ heading, bodyHTML });
    }

    return { readTime, introHTML, sections };
  });

  // Convert HTML → markdown using turndown
  const introMarkdown = extracted.introHTML ? turndown.turndown(extracted.introHTML).trim() : '';
  const sections: ScrapedSection[] = extracted.sections.map((s) => ({
    heading: s.heading,
    bodyMarkdown: s.bodyHTML ? turndown.turndown(s.bodyHTML).trim() : '',
  }));

  return {
    creatorId: resource.id,
    title: resource.title,
    emoji: resource.emoji,
    readTime: extracted.readTime || '',
    isFeatured: resource.featured,
    sortOrder: resource.order,
    introMarkdown,
    sections,
  };
}

async function runScrape(): Promise<void> {
  console.log(`\nScraping ${RESOURCES.length} Creator.io resources...\n`);

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const turndown = createTurndown();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });

  const results: ScrapedResource[] = [];
  const errors: Array<{ resource: ResourceConfig; error: string }> = [];

  for (let i = 0; i < RESOURCES.length; i++) {
    const resource = RESOURCES[i];
    console.log(`Scraping [${i + 1}/${RESOURCES.length}]: ${resource.title}...`);

    const page = await context.newPage();
    try {
      const scraped = await scrapeResource(page, resource, turndown);
      results.push(scraped);
      console.log(
        `  OK — ${scraped.sections.length} sections, readTime: "${scraped.readTime || 'n/a'}"`
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`  ERROR: ${message}`);
      errors.push({ resource, error: message });
    } finally {
      await page.close();
    }

    // Respectful delay between page loads (skip after last item)
    if (i < RESOURCES.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_PAGES_MS));
    }
  }

  await context.close();
  await browser.close();

  // Write output
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2), 'utf-8');

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`Scraped: ${results.length}/${RESOURCES.length}`);
  if (errors.length > 0) {
    console.log(`Errors (${errors.length}):`);
    errors.forEach((e) => console.log(`  - [${e.resource.order}] ${e.resource.title}: ${e.error}`));
  }
  console.log(`Output: ${OUTPUT_FILE}`);
  console.log(`${'─'.repeat(60)}\n`);
}

// ─── Transform Phase (stub) ───────────────────────────────────────────────────

async function runTransform(): Promise<void> {
  console.log('Transform phase: Not implemented yet');
}

// ─── Import Phase (stub) ──────────────────────────────────────────────────────

async function runImport(): Promise<void> {
  console.log('Import phase: Not implemented yet');
}

// ─── Entry Point ──────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const phaseArg = process.argv.find((a) => a.startsWith('--phase='));
  const phase = phaseArg ? phaseArg.replace('--phase=', '') : 'scrape';

  switch (phase) {
    case 'scrape':
      await runScrape();
      break;
    case 'transform':
      await runTransform();
      break;
    case 'import':
      await runImport();
      break;
    default:
      console.error(`Unknown phase: "${phase}". Valid values: scrape | transform | import`);
      process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
