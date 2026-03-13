/** PromptVaultRenderer. Renders polished_content as a searchable, collapsible prompt vault.
 *  Used for focused-toolkit archetypes with prompt-style content.
 *  Never imports NextRequest, NextResponse, or cookies. */

'use client';

import { useState, useMemo, useCallback } from 'react';
import Image from 'next/image';
import { Search, ChevronRight, Copy, Check } from 'lucide-react';
import type { PolishedContent, PolishedSection, PolishedBlock } from '@/lib/types/lead-magnet';

// --- Types -----

interface PromptVaultRendererProps {
  content: PolishedContent;
  isDark: boolean;
  primaryColor: string;
  authorName?: string | null;
  authorAvatarUrl?: string | null;
}

interface ParsedPrompt {
  number: string;
  title: string;
  useCase: string;
  fullPrompt: string;
  outputFormat: string | null;
  qualityChecks: string | null;
  commonPitfalls: string | null;
  variables: string | null;
  exampleOutput: string | null;
}

interface ParsedCategory {
  id: string;
  name: string;
  emoji: string;
  description: string;
  promptCount: number;
  prompts: ParsedPrompt[];
}

// --- Constants -----

const CATEGORY_EMOJIS: Record<string, string> = {
  'strategic account deep-dives': '🔍',
  'performance troubleshooting & recovery': '🚨',
  'high-authority content engineering': '✍️',
  'client communications & reporting': '📊',
  'sales & agency growth infrastructure': '💰',
  'competitive intelligence & market analysis': '🕵️',
  'creative strategy & ad copy lab': '🎨',
  'bid strategy & budget optimization': '⚖️',
  'landing page & conversion rate analysis': '🚀',
  'keyword & match type architecture': '🏗️',
  'audience & first-party data strategy': '👥',
  'seasonal & promotional scaling': '📈',
  'ai agent & automation workflows': '🤖',
};

// --- Parsing -----

function parsePromptFromBlocks(
  blocks: PolishedBlock[],
  startIdx: number
): { prompt: ParsedPrompt; nextIdx: number } {
  const infoBlock = blocks[startIdx];
  const titleMatch = infoBlock.title?.match(/^(\d{3})\s*[—–-]\s*(.+)$/);
  const number = titleMatch?.[1] || '000';
  const title = titleMatch?.[2] || infoBlock.title || 'Untitled Prompt';
  const useCase = (infoBlock.content || '').replace(/^\*\*Use Case:\*\*\s*/i, '');

  let fullPrompt = '';
  let outputFormat: string | null = null;
  let qualityChecks: string | null = null;
  let commonPitfalls: string | null = null;
  let variables: string | null = null;
  let exampleOutput: string | null = null;

  let i = startIdx + 1;
  while (i < blocks.length) {
    const block = blocks[i];

    // Stop at next prompt's info callout or divider before next info callout
    if (block.type === 'divider') {
      i++;
      break;
    }
    if (
      block.type === 'callout' &&
      block.style === 'info' &&
      block.title?.match(/^\d{3}\s*[—–-]/)
    ) {
      break;
    }

    if (block.type === 'paragraph') {
      fullPrompt += (fullPrompt ? '\n\n' : '') + block.content;
    } else if (block.type === 'callout' && block.style === 'success') {
      const t = (block.title || '').toLowerCase();
      if (t.includes('output')) outputFormat = block.content;
      else if (t.includes('example')) exampleOutput = block.content;
      else outputFormat = block.content;
    } else if (block.type === 'callout' && block.style === 'warning') {
      const t = (block.title || '').toLowerCase();
      if (t.includes('pitfall')) commonPitfalls = block.content;
      else if (t.includes('quality') || t.includes('check')) qualityChecks = block.content;
      else commonPitfalls = block.content;
    } else if (
      block.type === 'callout' &&
      block.style === 'info' &&
      !block.title?.match(/^\d{3}/)
    ) {
      const t = (block.title || '').toLowerCase();
      if (t.includes('variable')) variables = block.content;
    }

    i++;
  }

  return {
    prompt: {
      number,
      title,
      useCase,
      fullPrompt,
      outputFormat,
      qualityChecks,
      commonPitfalls,
      variables,
      exampleOutput,
    },
    nextIdx: i,
  };
}

function parseSectionToCategory(section: PolishedSection): ParsedCategory {
  const nameLower = section.sectionName.toLowerCase();
  const emoji = CATEGORY_EMOJIS[nameLower] || '📋';
  const prompts: ParsedPrompt[] = [];

  let i = 0;
  while (i < section.blocks.length) {
    const block = section.blocks[i];
    if (
      block.type === 'callout' &&
      block.style === 'info' &&
      block.title?.match(/^\d{3}\s*[—–-]/)
    ) {
      const { prompt, nextIdx } = parsePromptFromBlocks(section.blocks, i);
      prompts.push(prompt);
      i = nextIdx;
    } else {
      i++;
    }
  }

  const countMatch = section.keyTakeaway?.match(/(\d+)/);
  const promptCount = countMatch ? parseInt(countMatch[1], 10) : prompts.length;

  return {
    id: section.id,
    name: section.sectionName,
    emoji,
    description: section.introduction,
    promptCount,
    prompts,
  };
}

// --- Sub-components -----

function PromptTextBox({
  text,
  isDark,
  primaryColor,
  promptId,
}: {
  text: string;
  isDark: boolean;
  primaryColor: string;
  promptId: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [text]);

  // Parse the prompt text into styled segments
  const segments = useMemo(() => {
    return text.split('\n').map((line, i) => {
      const trimmed = line.trim();
      if (!trimmed) return <br key={i} />;

      // Step headers
      if (/^step\s+\d+/i.test(trimmed)) {
        return (
          <span
            key={i}
            style={{
              color: primaryColor,
              fontWeight: 700,
              textTransform: 'uppercase',
              display: 'block',
              marginTop: 14,
              marginBottom: 4,
            }}
          >
            {trimmed}
          </span>
        );
      }

      // Task headers
      if (/^task:/i.test(trimmed)) {
        return (
          <span
            key={i}
            style={{
              color: primaryColor,
              fontWeight: 700,
              textTransform: 'uppercase',
              display: 'block',
              marginTop: 8,
              marginBottom: 4,
            }}
          >
            {trimmed}
          </span>
        );
      }

      // Bullet points
      if (trimmed.startsWith('•') || trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        const content = trimmed.replace(/^[•\-*]\s*/, '');
        return (
          <span
            key={i}
            style={{ display: 'block', paddingLeft: 16, position: 'relative', margin: '4px 0' }}
          >
            <span style={{ position: 'absolute', left: 0 }}>•</span>
            {content}
          </span>
        );
      }

      return (
        <span key={i} style={{ display: 'block', margin: '2px 0' }}>
          {trimmed}
        </span>
      );
    });
  }, [text, primaryColor]);

  return (
    <div
      id={`prompt-text-${promptId}`}
      style={{
        background: isDark ? '#111' : '#f4f4f5',
        border: `1px solid ${isDark ? '#2a2a2a' : '#e4e4e7'}`,
        borderRadius: 8,
        padding: '16px 16px 16px 16px',
        fontSize: 13,
        lineHeight: 1.7,
        color: isDark ? '#ccc' : '#444',
        position: 'relative',
        paddingRight: 120,
      }}
    >
      <button
        onClick={handleCopy}
        style={{
          position: 'absolute',
          top: 12,
          right: 12,
          padding: '5px 12px',
          background: copied ? '#22c55e' : primaryColor,
          border: 'none',
          borderRadius: 6,
          color: 'white',
          fontSize: 12,
          fontWeight: 500,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          transition: 'background 0.2s',
        }}
      >
        {copied ? <Check size={12} /> : <Copy size={12} />}
        {copied ? 'Copied!' : 'Copy Prompt'}
      </button>
      {segments}
    </div>
  );
}

function MetaSection({
  label,
  content,
  isDark,
  primaryColor,
  variant,
}: {
  label: string;
  content: string;
  isDark: boolean;
  primaryColor: string;
  variant: 'success' | 'warning' | 'info';
}) {
  const bgMap = {
    success: isDark ? '#111' : '#f4f4f5',
    warning: isDark ? 'rgba(245, 158, 11, 0.05)' : 'rgba(245, 158, 11, 0.05)',
    info: isDark ? 'rgba(59, 130, 246, 0.05)' : 'rgba(59, 130, 246, 0.05)',
  };

  const lines = content.split('\n').filter((l) => l.trim());

  return (
    <div>
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          color: isDark ? '#888' : '#71717a',
          margin: '16px 0 8px',
        }}
      >
        {label}
      </div>
      <div
        style={{
          background: bgMap[variant],
          border: `1px solid ${isDark ? '#2a2a2a' : '#e4e4e7'}`,
          borderRadius: 8,
          padding: 16,
          fontSize: 13,
          lineHeight: 1.7,
          color: isDark ? '#aaa' : '#555',
        }}
      >
        {lines.map((line, i) => {
          const trimmed = line.trim();
          if (trimmed.startsWith('###')) {
            return (
              <span
                key={i}
                style={{
                  color: primaryColor,
                  fontWeight: 700,
                  display: 'block',
                  marginTop: i > 0 ? 12 : 0,
                  marginBottom: 4,
                }}
              >
                {trimmed}
              </span>
            );
          }
          if (trimmed.startsWith('•') || trimmed.startsWith('- ')) {
            const text = trimmed.replace(/^[•-]\s*/, '');
            return (
              <span
                key={i}
                style={{ display: 'block', paddingLeft: 16, position: 'relative', margin: '2px 0' }}
              >
                <span style={{ position: 'absolute', left: 0 }}>•</span>
                <span
                  dangerouslySetInnerHTML={{
                    __html: text.replace(
                      /\*\*(.+?)\*\*/g,
                      '<strong style="color: ' + (isDark ? '#e5e5e5' : '#1a1a1a') + '">$1</strong>'
                    ),
                  }}
                />
              </span>
            );
          }
          return (
            <span
              key={i}
              style={{ display: 'block', margin: '2px 0' }}
              dangerouslySetInnerHTML={{
                __html: trimmed.replace(
                  /\*\*(.+?)\*\*/g,
                  '<strong style="color: ' + (isDark ? '#e5e5e5' : '#1a1a1a') + '">$1</strong>'
                ),
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

function PromptCard({
  prompt,
  isDark,
  primaryColor,
}: {
  prompt: ParsedPrompt;
  isDark: boolean;
  primaryColor: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleQuickCopy = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      navigator.clipboard.writeText(prompt.fullPrompt).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    },
    [prompt.fullPrompt]
  );

  return (
    <div
      style={{
        background: isDark ? '#1a1a1a' : '#ffffff',
        border: `1px solid ${isDark ? '#2a2a2a' : '#e4e4e7'}`,
        borderRadius: 12,
        marginBottom: 8,
        overflow: 'hidden',
        transition: 'border-color 0.2s',
      }}
    >
      {/* Header */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '14px 16px',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <span
          style={{
            fontSize: 13,
            color: isDark ? '#888' : '#71717a',
            fontWeight: 500,
            fontVariantNumeric: 'tabular-nums',
            minWidth: 28,
          }}
        >
          {prompt.number}
        </span>
        <ChevronRight
          size={14}
          style={{
            color: isDark ? '#888' : '#71717a',
            transition: 'transform 0.2s',
            transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
            flexShrink: 0,
          }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: isDark ? '#e5e5e5' : '#1a1a1a' }}>
            {prompt.title}
          </div>
          {!isOpen && (
            <div
              style={{
                fontSize: 12,
                color: isDark ? '#888' : '#71717a',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                marginTop: 2,
              }}
            >
              {prompt.useCase}
            </div>
          )}
        </div>
        <button
          onClick={handleQuickCopy}
          style={{
            padding: '6px 10px',
            background: 'transparent',
            border: `1px solid ${copied ? '#22c55e' : isDark ? '#2a2a2a' : '#e4e4e7'}`,
            borderRadius: 6,
            color: copied ? '#22c55e' : isDark ? '#888' : '#71717a',
            fontSize: 12,
            cursor: 'pointer',
            flexShrink: 0,
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
        </button>
      </div>

      {/* Body */}
      {isOpen && (
        <div
          style={{
            padding: '0 16px 16px',
            borderTop: `1px solid ${isDark ? '#2a2a2a' : '#e4e4e7'}`,
          }}
        >
          {/* Use Case */}
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              color: isDark ? '#888' : '#71717a',
              margin: '16px 0 8px',
            }}
          >
            Use Case
          </div>
          <div style={{ fontSize: 14, color: isDark ? '#e5e5e5' : '#1a1a1a', lineHeight: 1.6 }}>
            {prompt.useCase}
          </div>

          {/* Full Prompt */}
          {prompt.fullPrompt && (
            <>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  color: isDark ? '#888' : '#71717a',
                  margin: '16px 0 8px',
                }}
              >
                Full Prompt
              </div>
              <PromptTextBox
                text={prompt.fullPrompt}
                isDark={isDark}
                primaryColor={primaryColor}
                promptId={prompt.number}
              />
            </>
          )}

          {/* Output Format */}
          {prompt.outputFormat && (
            <MetaSection
              label="Output Format"
              content={prompt.outputFormat}
              isDark={isDark}
              primaryColor={primaryColor}
              variant="success"
            />
          )}

          {/* Quality Checks */}
          {prompt.qualityChecks && (
            <MetaSection
              label="Quality Checks"
              content={prompt.qualityChecks}
              isDark={isDark}
              primaryColor={primaryColor}
              variant="warning"
            />
          )}

          {/* Common Pitfalls */}
          {prompt.commonPitfalls && (
            <MetaSection
              label="Common Pitfalls"
              content={prompt.commonPitfalls}
              isDark={isDark}
              primaryColor={primaryColor}
              variant="warning"
            />
          )}

          {/* Variables */}
          {prompt.variables && (
            <MetaSection
              label="Variables"
              content={prompt.variables}
              isDark={isDark}
              primaryColor={primaryColor}
              variant="info"
            />
          )}

          {/* Example Output */}
          {prompt.exampleOutput && (
            <MetaSection
              label="Example Output"
              content={prompt.exampleOutput}
              isDark={isDark}
              primaryColor={primaryColor}
              variant="success"
            />
          )}
        </div>
      )}
    </div>
  );
}

// --- Main Component -----

export function PromptVaultRenderer({
  content,
  isDark,
  primaryColor,
  authorName,
  authorAvatarUrl,
}: PromptVaultRendererProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const categories = useMemo(() => {
    return content.sections.map(parseSectionToCategory);
  }, [content.sections]);

  const totalPrompts = useMemo(() => {
    return categories.reduce((sum, cat) => sum + cat.prompts.length, 0);
  }, [categories]);

  const filteredCategories = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return categories
      .filter((cat) => selectedCategory === 'all' || cat.id === selectedCategory)
      .map((cat) => {
        if (!query) return cat;
        const filtered = cat.prompts.filter(
          (p) =>
            p.title.toLowerCase().includes(query) ||
            p.useCase.toLowerCase().includes(query) ||
            p.fullPrompt.toLowerCase().includes(query)
        );
        return { ...cat, prompts: filtered };
      })
      .filter((cat) => cat.prompts.length > 0);
  }, [categories, searchQuery, selectedCategory]);

  return (
    <div>
      {/* Author bar */}
      {authorName && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
          {authorAvatarUrl && (
            <Image
              src={authorAvatarUrl}
              alt={authorName}
              width={36}
              height={36}
              style={{ borderRadius: '50%', objectFit: 'cover' }}
              unoptimized
            />
          )}
          <span style={{ fontSize: 14, fontWeight: 600, color: isDark ? '#e5e5e5' : '#1a1a1a' }}>
            {authorName}
          </span>
        </div>
      )}

      {/* Hero */}
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <div
          style={{
            width: 48,
            height: 48,
            background: `linear-gradient(135deg, ${primaryColor}, #f97316)`,
            borderRadius: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 24,
            margin: '0 auto 20px',
          }}
        >
          ⚡
        </div>
        <h1
          style={{
            fontSize: 32,
            fontWeight: 700,
            lineHeight: 1.2,
            marginBottom: 16,
            color: isDark ? '#e5e5e5' : '#1a1a1a',
          }}
        >
          {content.title}
        </h1>
        <p
          style={{
            color: isDark ? '#888' : '#71717a',
            fontSize: 15,
            maxWidth: 500,
            margin: '0 auto 12px',
            lineHeight: 1.6,
          }}
        >
          {content.heroSummary}
        </p>
        <span style={{ color: isDark ? '#888' : '#71717a', fontSize: 13 }}>
          {totalPrompts} AI Prompts • Ready to Copy
        </span>
      </div>

      {/* Search & Filter */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 32, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              color: isDark ? '#555' : '#a1a1aa',
            }}
          />
          <input
            type="text"
            placeholder="Search prompts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px 10px 36px',
              background: isDark ? '#1a1a1a' : '#ffffff',
              border: `1px solid ${isDark ? '#2a2a2a' : '#e4e4e7'}`,
              borderRadius: 8,
              color: isDark ? '#e5e5e5' : '#1a1a1a',
              fontSize: 14,
              outline: 'none',
            }}
          />
        </div>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          style={{
            padding: '10px 12px',
            background: isDark ? '#1a1a1a' : '#ffffff',
            border: `1px solid ${isDark ? '#2a2a2a' : '#e4e4e7'}`,
            borderRadius: 8,
            color: isDark ? '#e5e5e5' : '#1a1a1a',
            fontSize: 14,
            outline: 'none',
            minWidth: 200,
            cursor: 'pointer',
          }}
        >
          <option value="all">All Categories ({totalPrompts})</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.emoji} {cat.name} ({cat.prompts.length})
            </option>
          ))}
        </select>
      </div>

      {/* Categories & Prompts */}
      {filteredCategories.map((category) => (
        <div key={category.id} style={{ marginBottom: 32 }}>
          {/* Category header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
              marginBottom: 16,
              paddingBottom: 12,
              borderBottom: `1px solid ${isDark ? '#2a2a2a' : '#e4e4e7'}`,
            }}
          >
            <span style={{ fontSize: 20, flexShrink: 0, marginTop: 2 }}>{category.emoji}</span>
            <div style={{ flex: 1 }}>
              <h2
                style={{
                  fontSize: 17,
                  fontWeight: 600,
                  marginBottom: 4,
                  color: isDark ? '#e5e5e5' : '#1a1a1a',
                }}
              >
                {category.name}
              </h2>
              <p
                style={{
                  fontSize: 13,
                  color: isDark ? '#888' : '#71717a',
                  lineHeight: 1.5,
                  margin: 0,
                }}
              >
                {category.description}
              </p>
            </div>
            <span
              style={{
                fontSize: 13,
                color: isDark ? '#888' : '#71717a',
                whiteSpace: 'nowrap',
                marginTop: 2,
              }}
            >
              {category.prompts.length} prompts
            </span>
          </div>

          {/* Prompt cards */}
          {category.prompts.map((prompt) => (
            <PromptCard
              key={prompt.number}
              prompt={prompt}
              isDark={isDark}
              primaryColor={primaryColor}
            />
          ))}
        </div>
      ))}

      {/* No results */}
      {filteredCategories.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 0', color: isDark ? '#888' : '#71717a' }}>
          <p style={{ fontSize: 16, marginBottom: 4 }}>No prompts found</p>
          <p style={{ fontSize: 13 }}>Try a different search term or category</p>
        </div>
      )}
    </div>
  );
}
