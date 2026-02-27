'use client';

import './tiptap-styles.css';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Plus, ChevronUp, ChevronDown, Trash2 } from 'lucide-react';
import type {
  PolishedContent,
  PolishedSection,
  PolishedBlock,
  PolishedBlockType,
  CalloutStyle,
} from '@/lib/types/lead-magnet';

// Inline-editor building blocks
import { TipTapTextBlock } from './TipTapTextBlock';
import { BlockHoverControls } from './BlockHoverControls';
import { StructuredBlockOverlay } from './StructuredBlockOverlay';
import SlashCommandMenu from './SlashCommandMenu';

// Published read-only renderers
import {
  SectionDivider,
  CodeBlock,
  TableBlock,
  AccordionBlock,
  ImageBlock,
  EmbedBlock,
  NumberedItem,
  StatCard,
} from '../ContentBlocks';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TEXT_BLOCK_TYPES = new Set<PolishedBlockType>([
  'paragraph',
  'callout',
  'list',
  'quote',
]);

const STRUCTURED_BLOCK_TYPES = new Set<PolishedBlockType>([
  'code',
  'table',
  'accordion',
  'numbered-item',
  'stat-card',
  'image',
  'embed',
]);

// Callout wrapper colors (mirrors ContentBlocks calloutConfig)
const CALLOUT_COLORS: Record<
  CalloutStyle,
  { darkBg: string; lightBg: string; borderColor: string }
> = {
  info: {
    darkBg: 'rgba(59,130,246,0.1)',
    lightBg: 'rgba(59,130,246,0.08)',
    borderColor: '#3b82f6',
  },
  warning: {
    darkBg: 'rgba(245,158,11,0.1)',
    lightBg: 'rgba(245,158,11,0.08)',
    borderColor: '#f59e0b',
  },
  success: {
    darkBg: 'rgba(34,197,94,0.1)',
    lightBg: 'rgba(34,197,94,0.08)',
    borderColor: '#22c55e',
  },
};

// ---------------------------------------------------------------------------
// Local ThemeColors (matches ContentBlocks)
// ---------------------------------------------------------------------------

interface ThemeColors {
  text: string;
  body: string;
  muted: string;
  border: string;
  card: string;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface InlineContentEditorProps {
  content: PolishedContent;
  isDark: boolean;
  primaryColor: string;
  onChange: (content: PolishedContent) => void;
}

// ---------------------------------------------------------------------------
// Helpers: derive theme colors from isDark
// ---------------------------------------------------------------------------

function deriveColors(isDark: boolean): ThemeColors {
  return isDark
    ? {
        text: '#F4F4F5',
        body: '#D4D4D8',
        muted: '#A1A1AA',
        border: '#27272A',
        card: '#18181B',
      }
    : {
        text: '#18181B',
        body: '#3F3F46',
        muted: '#71717A',
        border: '#E4E4E7',
        card: '#FFFFFF',
      };
}

// ---------------------------------------------------------------------------
// Default block factory
// ---------------------------------------------------------------------------

function createBlock(
  type: PolishedBlockType,
  style?: CalloutStyle,
): PolishedBlock {
  const base: PolishedBlock = { type, content: '' };
  switch (type) {
    case 'callout':
      return { ...base, style: style ?? 'info' };
    case 'table':
      return {
        ...base,
        headers: ['Column 1', 'Column 2'],
        rows: [['', '']],
      };
    case 'numbered-item':
      return { ...base, number: 1, title: '', detail: '' };
    case 'stat-card':
      return { ...base, title: '', style: style ?? 'info' };
    case 'accordion':
      return { ...base, title: '' };
    case 'code':
      return { ...base, language: 'typescript' };
    case 'image':
      return { ...base, src: '', alt: '' };
    case 'embed':
      return { ...base, url: '' };
    default:
      return base;
  }
}

// ---------------------------------------------------------------------------
// Default section factory
// ---------------------------------------------------------------------------

function createSection(): PolishedSection {
  return {
    id: `section-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    sectionName: 'New Section',
    introduction: '',
    blocks: [{ type: 'paragraph', content: '' }],
    keyTakeaway: '',
  };
}

// ---------------------------------------------------------------------------
// Add Section Divider (hover between sections)
// ---------------------------------------------------------------------------

function AddSectionDivider({ onAdd }: { onAdd: () => void }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="relative flex items-center justify-center py-2"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Thin line */}
      <div className="absolute inset-x-0 top-1/2 h-px bg-border" />

      {/* Button */}
      <button
        type="button"
        onClick={onAdd}
        className="relative z-10 flex items-center gap-1.5 rounded-full border bg-popover px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm transition-opacity duration-150 hover:text-foreground"
        style={{ opacity: hovered ? 1 : 0 }}
      >
        <Plus size={14} />
        Add section
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section Header Controls (hover gutter for section move/delete)
// ---------------------------------------------------------------------------

interface SectionHeaderControlsProps {
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function SectionHeaderControls({
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onDelete,
}: SectionHeaderControlsProps) {
  const [show, setShow] = useState(false);

  return (
    <div
      className="absolute -left-10 top-0 flex flex-col gap-0.5 transition-opacity duration-150"
      style={{ opacity: show ? 1 : 0, pointerEvents: show ? 'auto' : 'none' }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <button
        type="button"
        disabled={!canMoveUp}
        onClick={onMoveUp}
        className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-muted disabled:opacity-30"
        aria-label="Move section up"
      >
        <ChevronUp size={14} />
      </button>
      <button
        type="button"
        disabled={!canMoveDown}
        onClick={onMoveDown}
        className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-muted disabled:opacity-30"
        aria-label="Move section down"
      >
        <ChevronDown size={14} />
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="flex h-5 w-5 items-center justify-center rounded text-red-500 hover:bg-red-500/10"
        aria-label="Delete section"
      >
        <Trash2 size={12} />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// InlineContentEditor
// ---------------------------------------------------------------------------

export function InlineContentEditor({
  content,
  isDark,
  primaryColor,
  onChange,
}: InlineContentEditorProps) {
  const colors = useMemo(() => deriveColors(isDark), [isDark]);

  // --- Slash command state ---
  const [slashMenu, setSlashMenu] = useState<{
    sectionIdx: number;
    blockIdx: number;
  } | null>(null);
  const slashAnchorRef = useRef<HTMLDivElement>(null);

  // =========================================================================
  // Mutation helpers (all produce a new PolishedContent via onChange)
  // =========================================================================

  const replaceContent = useCallback(
    (updater: (draft: PolishedContent) => PolishedContent) => {
      onChange(updater(content));
    },
    [content, onChange],
  );

  // ---- Hero summary ----
  const updateHeroSummary = useCallback(
    (heroSummary: string) => {
      replaceContent((c) => ({ ...c, heroSummary }));
    },
    [replaceContent],
  );

  // ---- Section-level mutations ----
  const updateSection = useCallback(
    (sectionIdx: number, updates: Partial<PolishedSection>) => {
      replaceContent((c) => ({
        ...c,
        sections: c.sections.map((s, i) =>
          i === sectionIdx ? { ...s, ...updates } : s,
        ),
      }));
    },
    [replaceContent],
  );

  const addSection = useCallback(
    (afterIdx: number) => {
      replaceContent((c) => {
        const next = [...c.sections];
        next.splice(afterIdx + 1, 0, createSection());
        return { ...c, sections: next };
      });
    },
    [replaceContent],
  );

  const deleteSection = useCallback(
    (sectionIdx: number) => {
      replaceContent((c) => ({
        ...c,
        sections: c.sections.filter((_, i) => i !== sectionIdx),
      }));
    },
    [replaceContent],
  );

  const moveSection = useCallback(
    (sectionIdx: number, direction: -1 | 1) => {
      replaceContent((c) => {
        const next = [...c.sections];
        const target = sectionIdx + direction;
        if (target < 0 || target >= next.length) return c;
        [next[sectionIdx], next[target]] = [next[target], next[sectionIdx]];
        return { ...c, sections: next };
      });
    },
    [replaceContent],
  );

  // ---- Block-level mutations ----
  const updateBlock = useCallback(
    (sectionIdx: number, blockIdx: number, updates: Partial<PolishedBlock>) => {
      replaceContent((c) => ({
        ...c,
        sections: c.sections.map((s, si) =>
          si === sectionIdx
            ? {
                ...s,
                blocks: s.blocks.map((b, bi) =>
                  bi === blockIdx ? { ...b, ...updates } : b,
                ),
              }
            : s,
        ),
      }));
    },
    [replaceContent],
  );

  const addBlock = useCallback(
    (
      sectionIdx: number,
      afterBlockIdx: number,
      type: PolishedBlockType,
      style?: CalloutStyle,
    ) => {
      replaceContent((c) => ({
        ...c,
        sections: c.sections.map((s, si) => {
          if (si !== sectionIdx) return s;
          const next = [...s.blocks];
          next.splice(afterBlockIdx + 1, 0, createBlock(type, style));
          return { ...s, blocks: next };
        }),
      }));
    },
    [replaceContent],
  );

  const deleteBlock = useCallback(
    (sectionIdx: number, blockIdx: number) => {
      replaceContent((c) => ({
        ...c,
        sections: c.sections.map((s, si) =>
          si === sectionIdx
            ? { ...s, blocks: s.blocks.filter((_, bi) => bi !== blockIdx) }
            : s,
        ),
      }));
    },
    [replaceContent],
  );

  const moveBlock = useCallback(
    (sectionIdx: number, blockIdx: number, direction: -1 | 1) => {
      replaceContent((c) => ({
        ...c,
        sections: c.sections.map((s, si) => {
          if (si !== sectionIdx) return s;
          const next = [...s.blocks];
          const target = blockIdx + direction;
          if (target < 0 || target >= next.length) return s;
          [next[blockIdx], next[target]] = [next[target], next[blockIdx]];
          return { ...s, blocks: next };
        }),
      }));
    },
    [replaceContent],
  );

  // =========================================================================
  // Slash command handling
  // =========================================================================

  const handleBlockContentChange = useCallback(
    (sectionIdx: number, blockIdx: number, newContent: string) => {
      // Detect slash trigger: content is exactly "/"
      if (newContent === '/') {
        setSlashMenu({ sectionIdx, blockIdx });
      } else {
        setSlashMenu(null);
      }
      updateBlock(sectionIdx, blockIdx, { content: newContent });
    },
    [updateBlock],
  );

  const handleSlashSelect = useCallback(
    (type: PolishedBlockType, style?: CalloutStyle) => {
      if (!slashMenu) return;
      const { sectionIdx, blockIdx } = slashMenu;

      // Replace the empty "/" paragraph with the selected block type
      if (type === 'paragraph' || TEXT_BLOCK_TYPES.has(type)) {
        // Replace in-place
        updateBlock(sectionIdx, blockIdx, {
          ...createBlock(type, style),
        });
      } else {
        // Replace the paragraph with the new block
        replaceContent((c) => ({
          ...c,
          sections: c.sections.map((s, si) => {
            if (si !== sectionIdx) return s;
            const next = [...s.blocks];
            next[blockIdx] = createBlock(type, style);
            return { ...s, blocks: next };
          }),
        }));
      }

      setSlashMenu(null);
    },
    [slashMenu, updateBlock, replaceContent],
  );

  const handleSlashClose = useCallback(() => {
    setSlashMenu(null);
  }, []);

  // =========================================================================
  // Render helpers for individual blocks
  // =========================================================================

  const renderBlock = useCallback(
    (block: PolishedBlock, sectionIdx: number, blockIdx: number) => {
      const totalBlocks = content.sections[sectionIdx]?.blocks.length ?? 0;

      // -- Text blocks: TipTap editing --
      if (TEXT_BLOCK_TYPES.has(block.type)) {
        let inner: React.ReactNode;

        switch (block.type) {
          case 'callout': {
            const cs = block.style ?? 'info';
            const cc = CALLOUT_COLORS[cs];
            inner = (
              <div
                style={{
                  background: isDark ? cc.darkBg : cc.lightBg,
                  borderLeft: `3px solid ${cc.borderColor}`,
                  borderRadius: '0.5rem',
                  padding: '1rem 1.25rem',
                  margin: '1.5rem 0',
                }}
              >
                <TipTapTextBlock
                  content={block.content}
                  onChange={(val) =>
                    handleBlockContentChange(sectionIdx, blockIdx, val)
                  }
                  placeholder="Callout text..."
                />
              </div>
            );
            break;
          }

          case 'quote':
            inner = (
              <blockquote
                style={{
                  borderLeft: `3px solid ${primaryColor}`,
                  paddingLeft: '1.25rem',
                  margin: '1.5rem 0',
                  fontStyle: 'italic',
                }}
              >
                <TipTapTextBlock
                  content={block.content}
                  onChange={(val) =>
                    handleBlockContentChange(sectionIdx, blockIdx, val)
                  }
                  placeholder="Quote..."
                  style={{ color: colors.muted }}
                />
              </blockquote>
            );
            break;

          case 'list':
          case 'paragraph':
          default:
            inner = (
              <div style={{ margin: '0.5rem 0' }}>
                <TipTapTextBlock
                  content={block.content}
                  onChange={(val) =>
                    handleBlockContentChange(sectionIdx, blockIdx, val)
                  }
                  placeholder={
                    block.type === 'list'
                      ? 'List items (one per line)...'
                      : 'Start typing or press / for commands...'
                  }
                  style={{ color: colors.body }}
                />
              </div>
            );
            break;
        }

        return (
          <BlockHoverControls
            key={blockIdx}
            blockType={block.type}
            canMoveUp={blockIdx > 0}
            canMoveDown={blockIdx < totalBlocks - 1}
            onMoveUp={() => moveBlock(sectionIdx, blockIdx, -1)}
            onMoveDown={() => moveBlock(sectionIdx, blockIdx, 1)}
            onDelete={() => deleteBlock(sectionIdx, blockIdx)}
          >
            {inner}
            {/* Slash command menu anchored below this block */}
            {slashMenu?.sectionIdx === sectionIdx &&
              slashMenu?.blockIdx === blockIdx && (
                <div ref={slashAnchorRef} className="relative">
                  <div className="absolute left-0 top-0 z-50">
                    <SlashCommandMenu
                      isOpen
                      onSelect={handleSlashSelect}
                      onClose={handleSlashClose}
                    />
                  </div>
                </div>
              )}
          </BlockHoverControls>
        );
      }

      // -- Divider: no editing --
      if (block.type === 'divider') {
        return (
          <BlockHoverControls
            key={blockIdx}
            blockType="divider"
            canMoveUp={blockIdx > 0}
            canMoveDown={blockIdx < totalBlocks - 1}
            onMoveUp={() => moveBlock(sectionIdx, blockIdx, -1)}
            onMoveDown={() => moveBlock(sectionIdx, blockIdx, 1)}
            onDelete={() => deleteBlock(sectionIdx, blockIdx)}
          >
            <SectionDivider colors={colors} />
          </BlockHoverControls>
        );
      }

      // -- Structured blocks: overlay + read-only renderer --
      if (STRUCTURED_BLOCK_TYPES.has(block.type)) {
        const readOnlyRenderer = renderReadOnlyBlock(block);

        return (
          <BlockHoverControls
            key={blockIdx}
            blockType={block.type}
            canMoveUp={blockIdx > 0}
            canMoveDown={blockIdx < totalBlocks - 1}
            onMoveUp={() => moveBlock(sectionIdx, blockIdx, -1)}
            onMoveDown={() => moveBlock(sectionIdx, blockIdx, 1)}
            onDelete={() => deleteBlock(sectionIdx, blockIdx)}
          >
            <StructuredBlockOverlay
              block={block}
              onChange={(updates) =>
                updateBlock(sectionIdx, blockIdx, updates)
              }
              isDark={isDark}
              primaryColor={primaryColor}
            >
              {readOnlyRenderer}
            </StructuredBlockOverlay>
          </BlockHoverControls>
        );
      }

      // Fallback (shouldn't happen)
      return null;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      content.sections,
      isDark,
      primaryColor,
      colors,
      slashMenu,
      handleBlockContentChange,
      handleSlashSelect,
      handleSlashClose,
      moveBlock,
      deleteBlock,
      updateBlock,
    ],
  );

  // Read-only published renderer for structured blocks
  const renderReadOnlyBlock = useCallback(
    (block: PolishedBlock): React.ReactNode => {
      switch (block.type) {
        case 'code':
          return <CodeBlock block={block} isDark={isDark} />;
        case 'table':
          return <TableBlock block={block} isDark={isDark} />;
        case 'accordion':
          return <AccordionBlock block={block} />;
        case 'image':
          return <ImageBlock block={block} />;
        case 'embed':
          return <EmbedBlock block={block} />;
        case 'numbered-item':
          return (
            <NumberedItem
              block={block}
              colors={colors}
              primaryColor={primaryColor}
              isDark={isDark}
            />
          );
        case 'stat-card':
          return (
            <StatCard
              block={block}
              isDark={isDark}
              primaryColor={primaryColor}
            />
          );
        default:
          return null;
      }
    },
    [isDark, primaryColor, colors],
  );

  // =========================================================================
  // Render
  // =========================================================================

  return (
    <div className="inline-content-editor pl-10">
      {/* ---- Hero Summary ---- */}
      <div className="mb-8">
        <TipTapTextBlock
          content={content.heroSummary}
          onChange={updateHeroSummary}
          placeholder="Hero summary..."
          className="text-lg"
          style={{ color: colors.muted }}
        />
      </div>

      {/* ---- Sections ---- */}
      {content.sections.map((section, sectionIdx) => (
        <React.Fragment key={section.id}>
          {/* Add section divider BEFORE each section (except first) */}
          {sectionIdx > 0 && (
            <AddSectionDivider
              onAdd={() => addSection(sectionIdx - 1)}
            />
          )}

          <section className="relative mb-10">
            {/* Section header controls (move/delete) */}
            <div
              className="relative"
              onMouseEnter={(e) => {
                const controls = e.currentTarget.querySelector<HTMLElement>(
                  '[data-section-controls]',
                );
                if (controls) controls.style.opacity = '1';
                if (controls) controls.style.pointerEvents = 'auto';
              }}
              onMouseLeave={(e) => {
                const controls = e.currentTarget.querySelector<HTMLElement>(
                  '[data-section-controls]',
                );
                if (controls) controls.style.opacity = '0';
                if (controls) controls.style.pointerEvents = 'none';
              }}
            >
              <div
                data-section-controls
                className="absolute -left-10 top-0 flex flex-col gap-0.5 transition-opacity duration-150"
                style={{ opacity: 0, pointerEvents: 'none' }}
              >
                <button
                  type="button"
                  disabled={sectionIdx === 0}
                  onClick={() => moveSection(sectionIdx, -1)}
                  className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-muted disabled:opacity-30"
                  aria-label="Move section up"
                >
                  <ChevronUp size={14} />
                </button>
                <button
                  type="button"
                  disabled={sectionIdx === content.sections.length - 1}
                  onClick={() => moveSection(sectionIdx, 1)}
                  className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-muted disabled:opacity-30"
                  aria-label="Move section down"
                >
                  <ChevronDown size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => deleteSection(sectionIdx)}
                  className="flex h-5 w-5 items-center justify-center rounded text-red-500 hover:bg-red-500/10"
                  aria-label="Delete section"
                >
                  <Trash2 size={12} />
                </button>
              </div>

              {/* Section heading (contentEditable) */}
              <h2
                contentEditable
                suppressContentEditableWarning
                onBlur={(e) =>
                  updateSection(sectionIdx, {
                    sectionName: e.currentTarget.textContent || '',
                  })
                }
                className="mb-3 text-2xl font-bold outline-none focus:ring-1 focus:ring-violet-500 focus:ring-offset-2 rounded px-1 -mx-1"
                style={{ color: colors.text }}
              >
                {section.sectionName}
              </h2>
            </div>

            {/* Section introduction */}
            <div className="mb-4">
              <TipTapTextBlock
                content={section.introduction}
                onChange={(val) =>
                  updateSection(sectionIdx, { introduction: val })
                }
                placeholder="Section introduction..."
                style={{ color: colors.body }}
              />
            </div>

            {/* Blocks */}
            {section.blocks.map((block, blockIdx) => (
              <React.Fragment key={blockIdx}>
                {renderBlock(block, sectionIdx, blockIdx)}
              </React.Fragment>
            ))}

            {/* Add block button at end of section */}
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  addBlock(
                    sectionIdx,
                    section.blocks.length - 1,
                    'paragraph',
                  )
                }
                className="flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted transition-colors"
              >
                <Plus size={14} />
                Add block
              </button>
            </div>

            {/* Key takeaway */}
            <div className="mt-4 rounded-md border border-dashed p-3" style={{ borderColor: colors.border }}>
              <span
                className="mb-1 block text-xs font-semibold uppercase tracking-wide"
                style={{ color: colors.muted }}
              >
                Key Takeaway
              </span>
              <TipTapTextBlock
                content={section.keyTakeaway}
                onChange={(val) =>
                  updateSection(sectionIdx, { keyTakeaway: val })
                }
                placeholder="Key takeaway for this section..."
                style={{ color: colors.body }}
              />
            </div>
          </section>
        </React.Fragment>
      ))}

      {/* Add section at the very end */}
      <AddSectionDivider
        onAdd={() => addSection(content.sections.length - 1)}
      />
    </div>
  );
}
