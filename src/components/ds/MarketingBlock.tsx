/** MarketingBlock — Marketing block renderer. Variant prop maps to internal blockType.
 * Uses DS CSS vars for theming. Never imports Next.js server modules. */
'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { ScrollReveal } from '@/components/funnel/animations/ScrollReveal';

// ─── Types ─────────────────────────────────────────────────────────

type ContentBlockType =
  | 'testimonial'
  | 'case_study'
  | 'feature'
  | 'benefit'
  | 'faq'
  | 'pricing'
  | 'cta';

interface ContentBlock {
  blockType: ContentBlockType;
  title?: string;
  content?: string;
  imageUrl?: string;
  ctaText?: string;
  ctaUrl?: string;
}

interface MarketingBlockProps {
  block: ContentBlock | null | undefined;
  variant?: string;
  primaryColor?: string;
  className?: string;
}

interface FAQItem {
  question: string;
  answer: string;
}

interface ContentWithItems {
  title?: string;
  body?: string;
  items?: FAQItem[];
}

// ─── Variant → blockType mapping ───────────────────────────────────

const VARIANT_TO_BLOCK_TYPE: Record<string, ContentBlockType> = {
  'feature-card': 'feature',
  benefit: 'benefit',
  'faq-accordion': 'faq',
  'cta-banner': 'cta',
};

// ─── Helpers ───────────────────────────────────────────────────────

function parsePlainTextFAQ(content: string): FAQItem[] | null {
  const blocks = content.split(/\n\n+/).filter((b) => b.trim());
  const items: FAQItem[] = [];

  for (const block of blocks) {
    const match = block.match(/^\*\*(.+?)\*\*\s*\n([\s\S]+)$/);
    if (match) {
      items.push({ question: match[1].trim(), answer: match[2].trim() });
    }
  }

  return items.length > 0 ? items : null;
}

function parseContent(content: string | undefined): string | ContentWithItems {
  if (!content) return '';

  try {
    const parsed = JSON.parse(content);
    if (typeof parsed === 'object' && parsed !== null) {
      return parsed as ContentWithItems;
    }
    return String(parsed);
  } catch {
    return content;
  }
}

function renderInlineFormatting(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let keyIndex = 0;

  while (remaining.length > 0) {
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    const italicMatch = remaining.match(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/);

    let matchToUse: RegExpMatchArray | null = null;
    let isBold = false;

    if (boldMatch && italicMatch) {
      if (boldMatch.index! <= italicMatch.index!) {
        matchToUse = boldMatch;
        isBold = true;
      } else {
        matchToUse = italicMatch;
      }
    } else if (boldMatch) {
      matchToUse = boldMatch;
      isBold = true;
    } else if (italicMatch) {
      matchToUse = italicMatch;
    }

    if (matchToUse && matchToUse.index !== undefined) {
      if (matchToUse.index > 0) {
        parts.push(remaining.slice(0, matchToUse.index));
      }

      if (isBold) {
        parts.push(
          <strong key={keyIndex++} className="font-semibold" style={{ color: 'var(--ds-text)' }}>
            {matchToUse[1]}
          </strong>
        );
      } else {
        parts.push(
          <em key={keyIndex++} className="italic">
            {matchToUse[1]}
          </em>
        );
      }

      remaining = remaining.slice(matchToUse.index + matchToUse[0].length);
    } else {
      parts.push(remaining);
      remaining = '';
    }
  }

  return parts.length === 1 ? parts[0] : parts;
}

function renderSimpleMarkdown(text: string): React.ReactNode[] {
  if (!text) return [];

  const paragraphs = text.split(/\n\n+/);

  return paragraphs.map((paragraph, pIndex) => {
    const trimmed = paragraph.trim();
    if (!trimmed) return null;

    const lines = trimmed.split('\n');
    const isBulletList = lines.every(
      (line) => line.trim().startsWith('- ') || line.trim().startsWith('* ') || line.trim() === ''
    );

    if (
      isBulletList &&
      lines.some((line) => line.trim().startsWith('-') || line.trim().startsWith('*'))
    ) {
      const listItems = lines
        .filter((line) => line.trim().startsWith('-') || line.trim().startsWith('*'))
        .map((line) => line.trim().replace(/^[-*]\s+/, ''));

      return (
        <ul
          key={pIndex}
          className="list-disc list-inside space-y-2 mb-4"
          style={{ color: 'var(--ds-muted)' }}
        >
          {listItems.map((item, lIndex) => (
            <li key={lIndex}>{renderInlineFormatting(item)}</li>
          ))}
        </ul>
      );
    }

    return (
      <p key={pIndex} className="mb-4 last:mb-0">
        {renderInlineFormatting(trimmed)}
      </p>
    );
  });
}

// ─── Sub-components ────────────────────────────────────────────────

const FAQAccordion: React.FC<{ items: FAQItem[] }> = ({ items }) => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div
          key={index}
          className="rounded-lg overflow-hidden"
          style={{ border: `1px solid var(--ds-border)` }}
        >
          <button
            type="button"
            onClick={() => setOpenIndex(openIndex === index ? null : index)}
            className="w-full flex items-center justify-between p-4 text-left transition-colors"
            style={{ backgroundColor: openIndex === index ? 'var(--ds-card)' : 'transparent' }}
            aria-expanded={openIndex === index}
          >
            <span className="font-medium" style={{ color: 'var(--ds-text)' }}>
              {item.question}
            </span>
            {openIndex === index ? (
              <ChevronUp className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--ds-muted)' }} />
            ) : (
              <ChevronDown className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--ds-muted)' }} />
            )}
          </button>
          {openIndex === index && (
            <div
              className="p-4"
              style={{ backgroundColor: 'var(--ds-card)', borderTop: `1px solid var(--ds-border)` }}
            >
              <div className="leading-relaxed" style={{ color: 'var(--ds-muted)' }}>
                {renderSimpleMarkdown(item.answer)}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

const InlineCTA: React.FC<{ text: string; url: string }> = ({ text, url }) => {
  const isExternal = url.startsWith('http://') || url.startsWith('https://');

  return (
    <a
      href={url}
      target={isExternal ? '_blank' : undefined}
      rel={isExternal ? 'noopener noreferrer' : undefined}
      className="inline-flex items-center gap-2 px-6 py-3 text-white font-medium rounded-lg transition-colors mt-4"
      style={{ backgroundColor: 'var(--ds-primary)' }}
    >
      {text}
      {isExternal && <ExternalLink className="w-4 h-4" />}
    </a>
  );
};

// ─── Component ─────────────────────────────────────────────────────

const MarketingBlock: React.FC<MarketingBlockProps> = ({
  block,
  variant,
  // primaryColor accepted for consistency but not used directly
  className = '',
}) => {
  if (!block) return null;

  // When variant is provided and not 'default', map to internal blockType
  const effectiveBlock: ContentBlock =
    variant && variant !== 'default' && VARIANT_TO_BLOCK_TYPE[variant]
      ? { ...block, blockType: VARIANT_TO_BLOCK_TYPE[variant] }
      : block;

  const parsedContent = parseContent(effectiveBlock.content);
  const isObjectContent = typeof parsedContent === 'object';

  const contentTitle = isObjectContent ? (parsedContent as ContentWithItems).title : undefined;
  const contentBody = isObjectContent
    ? (parsedContent as ContentWithItems).body
    : (parsedContent as string);
  const contentItems = isObjectContent ? (parsedContent as ContentWithItems).items : undefined;

  const faqItems =
    effectiveBlock.blockType === 'faq' && contentItems && Array.isArray(contentItems)
      ? contentItems
      : effectiveBlock.blockType === 'faq' && typeof contentBody === 'string'
        ? parsePlainTextFAQ(contentBody)
        : null;
  const isFAQ = faqItems && faqItems.length > 0;

  const hasTitle = effectiveBlock.title || contentTitle;
  const hasBody = contentBody && contentBody.trim() !== '';
  const hasCTA = effectiveBlock.ctaText && effectiveBlock.ctaUrl;

  if (!hasTitle && !hasBody && !isFAQ && !hasCTA) return null;

  return (
    <ScrollReveal>
      <div
        className={`rounded-xl shadow-sm p-6 ${className}`.trim()}
        style={{
          backgroundColor: 'var(--ds-card)',
          border: `1px solid var(--ds-border)`,
        }}
      >
        {hasTitle && (
          <h3 className="text-xl font-semibold mb-4" style={{ color: 'var(--ds-text)' }}>
            {effectiveBlock.title || contentTitle}
          </h3>
        )}

        {hasBody && !isFAQ && (
          <div className="leading-relaxed" style={{ color: 'var(--ds-muted)' }}>
            {renderSimpleMarkdown(contentBody)}
          </div>
        )}

        {isFAQ && <FAQAccordion items={faqItems as FAQItem[]} />}

        {hasCTA && (
          <div className="mt-6">
            <InlineCTA text={effectiveBlock.ctaText!} url={effectiveBlock.ctaUrl!} />
          </div>
        )}
      </div>
    </ScrollReveal>
  );
};

export default MarketingBlock;
