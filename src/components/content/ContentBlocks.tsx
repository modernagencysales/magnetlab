'use client';

import { useState, useEffect } from 'react';
import { Info, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { CalloutStyle, PolishedBlock } from '@/lib/types/lead-magnet';

interface ThemeColors {
  text: string;
  body: string;
  muted: string;
  border: string;
  card: string;
}

// Parse **bold** markdown in text
function renderRichText(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} style={{ fontWeight: 600 }}>
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}

// ---- Callout ----

const calloutConfig: Record<CalloutStyle, {
  icon: typeof Info;
  darkBg: string;
  lightBg: string;
  borderColor: string;
  darkText: string;
  lightText: string;
}> = {
  info: {
    icon: Info,
    darkBg: 'rgba(59,130,246,0.1)',
    lightBg: 'rgba(59,130,246,0.08)',
    borderColor: '#3b82f6',
    darkText: '#93c5fd',
    lightText: '#1e40af',
  },
  warning: {
    icon: AlertTriangle,
    darkBg: 'rgba(245,158,11,0.1)',
    lightBg: 'rgba(245,158,11,0.08)',
    borderColor: '#f59e0b',
    darkText: '#fcd34d',
    lightText: '#92400e',
  },
  success: {
    icon: CheckCircle2,
    darkBg: 'rgba(34,197,94,0.1)',
    lightBg: 'rgba(34,197,94,0.08)',
    borderColor: '#22c55e',
    darkText: '#86efac',
    lightText: '#166534',
  },
};

export function Callout({
  content,
  style = 'info',
  isDark,
}: {
  content: string;
  style?: CalloutStyle;
  isDark: boolean;
}) {
  const config = calloutConfig[style];
  const Icon = config.icon;

  return (
    <div
      style={{
        background: isDark ? config.darkBg : config.lightBg,
        borderLeft: `3px solid ${config.borderColor}`,
        borderRadius: '0.5rem',
        padding: '1rem 1.25rem',
        display: 'flex',
        gap: '0.75rem',
        alignItems: 'flex-start',
        margin: '1.5rem 0',
      }}
    >
      <Icon
        size={20}
        style={{
          color: config.borderColor,
          flexShrink: 0,
          marginTop: '0.125rem',
        }}
      />
      <p
        style={{
          fontSize: '1rem',
          lineHeight: '1.75rem',
          color: isDark ? config.darkText : config.lightText,
          margin: 0,
        }}
      >
        {renderRichText(content)}
      </p>
    </div>
  );
}

// ---- RichParagraph ----

export function RichParagraph({
  content,
  colors,
}: {
  content: string;
  colors: ThemeColors;
}) {
  return (
    <p
      style={{
        fontSize: '1.125rem',
        fontWeight: 400,
        letterSpacing: '-0.01em',
        lineHeight: '1.875rem',
        color: colors.body,
        margin: '1.25rem 0',
      }}
    >
      {renderRichText(content)}
    </p>
  );
}

// ---- BulletList ----

export function BulletList({
  content,
  colors,
}: {
  content: string;
  colors: ThemeColors;
}) {
  const items = content
    .split('\n')
    .map((line) => line.replace(/^[-•]\s*/, '').trim())
    .filter(Boolean);

  return (
    <ul
      style={{
        margin: '1.25rem 0',
        paddingLeft: '1.5rem',
        listStyleType: 'disc',
      }}
    >
      {items.map((item, i) => (
        <li
          key={i}
          style={{
            fontSize: '1.125rem',
            lineHeight: '1.875rem',
            color: colors.body,
            marginBottom: '0.5rem',
            paddingLeft: '0.25rem',
          }}
        >
          {renderRichText(item)}
        </li>
      ))}
    </ul>
  );
}

// ---- BlockQuote ----

export function BlockQuote({
  content,
  colors,
  primaryColor,
}: {
  content: string;
  colors: ThemeColors;
  primaryColor: string;
}) {
  return (
    <blockquote
      style={{
        borderLeft: `3px solid ${primaryColor}`,
        paddingLeft: '1.25rem',
        margin: '1.5rem 0',
        fontStyle: 'italic',
      }}
    >
      <p
        style={{
          fontSize: '1.125rem',
          lineHeight: '1.875rem',
          color: colors.muted,
          margin: 0,
        }}
      >
        {renderRichText(content)}
      </p>
    </blockquote>
  );
}

// ---- SectionDivider ----

export function SectionDivider({ colors }: { colors: ThemeColors }) {
  return (
    <hr
      style={{
        border: 'none',
        borderTop: `1px solid ${colors.border}`,
        margin: '2rem 0',
      }}
    />
  );
}

// ---- CodeBlock ----

export function CodeBlock({ block, isDark }: { block: PolishedBlock; isDark: boolean }) {
  const [html, setHtml] = useState<string>('');

  useEffect(() => {
    async function highlight() {
      try {
        const { codeToHtml } = await import('shiki');
        const result = await codeToHtml(block.content, {
          lang: block.language || 'text',
          theme: isDark ? 'github-dark' : 'github-light',
        });
        setHtml(result);
      } catch {
        // Fallback for unknown languages
        setHtml('');
      }
    }
    highlight();
  }, [block.content, block.language, isDark]);

  if (!html) {
    return (
      <pre className="rounded-lg border p-4 text-sm overflow-x-auto" style={{
        backgroundColor: isDark ? '#1a1a2e' : '#f5f5f5',
        color: 'var(--ds-text-body)',
      }}>
        <code>{block.content}</code>
      </pre>
    );
  }

  return (
    <div className="rounded-lg border overflow-hidden text-sm [&_pre]:p-4 [&_pre]:m-0 [&_pre]:overflow-x-auto">
      {block.language && (
        <div className="px-4 py-1.5 text-xs font-mono border-b" style={{
          backgroundColor: isDark ? '#1a1a2e' : '#f0f0f0',
          color: 'var(--ds-text-muted)',
        }}>
          {block.language}
        </div>
      )}
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

// ---- TableBlock ----

export function TableBlock({ block, isDark }: { block: PolishedBlock; isDark: boolean }) {
  if (!block.headers || !block.rows) return null;

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead>
          <tr style={{ backgroundColor: isDark ? '#1a1a2e' : '#f5f5f5' }}>
            {block.headers.map((header, i) => (
              <th key={i} className="px-4 py-3 text-left font-semibold" style={{ color: 'var(--ds-text-heading)' }}>
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row, rowIdx) => (
            <tr key={rowIdx} className="border-t" style={{
              backgroundColor: rowIdx % 2 === 1 ? (isDark ? '#0d0d1a' : '#fafafa') : 'transparent',
            }}>
              {row.map((cell, cellIdx) => (
                <td key={cellIdx} className="px-4 py-3" style={{ color: 'var(--ds-text-body)' }}>
                  {renderRichText(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---- AccordionBlock ----

export function AccordionBlock({ block }: { block: PolishedBlock }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="rounded-lg border" style={{ borderColor: 'var(--ds-border)' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between px-4 py-3 text-left font-medium"
        style={{ color: 'var(--ds-text-heading)' }}
      >
        <span>{block.title || 'Details'}</span>
        <svg
          className={`h-4 w-4 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <div className="border-t px-4 py-3" style={{ color: 'var(--ds-text-body)' }}>
          {renderRichText(block.content)}
        </div>
      )}
    </div>
  );
}

// ---- ImageBlock ----

export function ImageBlock({ block }: { block: PolishedBlock }) {
  if (!block.src) return null;

  return (
    <figure className="my-2">
      <img
        src={block.src}
        alt={block.alt || ''}
        className="w-full rounded-lg"
        loading="lazy"
      />
      {block.caption && (
        <figcaption className="mt-2 text-center text-sm" style={{ color: 'var(--ds-text-muted)' }}>
          {block.caption}
        </figcaption>
      )}
    </figure>
  );
}

// ---- EmbedBlock ----

export function EmbedBlock({ block }: { block: PolishedBlock }) {
  if (!block.url) return null;

  let embedUrl = block.url;
  if (block.url.includes('youtube.com/watch')) {
    const videoId = new URL(block.url).searchParams.get('v');
    if (videoId) embedUrl = `https://www.youtube.com/embed/${videoId}`;
  } else if (block.url.includes('youtu.be/')) {
    const videoId = block.url.split('youtu.be/')[1]?.split('?')[0];
    if (videoId) embedUrl = `https://www.youtube.com/embed/${videoId}`;
  } else if (block.url.includes('vimeo.com/')) {
    const videoId = block.url.split('vimeo.com/')[1]?.split('?')[0];
    if (videoId) embedUrl = `https://player.vimeo.com/video/${videoId}`;
  } else if (block.url.includes('loom.com/share/')) {
    embedUrl = block.url.replace('/share/', '/embed/');
  }

  return (
    <div className="relative w-full overflow-hidden rounded-lg" style={{ paddingBottom: '56.25%' }}>
      <iframe
        src={embedUrl}
        className="absolute inset-0 h-full w-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        title={block.provider || 'Embedded video'}
      />
    </div>
  );
}
