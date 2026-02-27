'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Type,
  AlertCircle,
  List,
  Quote,
  Minus,
  Code,
  Table,
  ChevronRight,
  BarChart3,
  Image,
  Play,
  Hash,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { PolishedBlockType, CalloutStyle } from '@/lib/types/lead-magnet';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SlashCommandMenuProps {
  isOpen: boolean;
  onSelect: (type: PolishedBlockType, style?: CalloutStyle) => void;
  onClose: () => void;
}

interface BlockOption {
  type: PolishedBlockType;
  label: string;
  icon: LucideIcon;
  style?: CalloutStyle;
  description: string;
}

// ---------------------------------------------------------------------------
// Block option definitions (all 14)
// ---------------------------------------------------------------------------

const BLOCK_OPTIONS: BlockOption[] = [
  { type: 'paragraph', label: 'Paragraph', icon: Type, description: 'Plain text block' },
  { type: 'list', label: 'Bullet List', icon: List, description: 'Simple bulleted list' },
  { type: 'quote', label: 'Quote', icon: Quote, description: 'Blockquote' },
  { type: 'callout', label: 'Info Callout', icon: AlertCircle, style: 'info', description: 'Blue info box' },
  { type: 'callout', label: 'Warning', icon: AlertCircle, style: 'warning', description: 'Amber warning box' },
  { type: 'callout', label: 'Success', icon: AlertCircle, style: 'success', description: 'Green success box' },
  { type: 'divider', label: 'Divider', icon: Minus, description: 'Horizontal rule' },
  { type: 'code', label: 'Code Block', icon: Code, description: 'Syntax-highlighted code' },
  { type: 'table', label: 'Table', icon: Table, description: 'Data table with headers' },
  { type: 'accordion', label: 'Accordion', icon: ChevronRight, description: 'Collapsible section' },
  { type: 'numbered-item', label: 'Numbered Item', icon: Hash, description: 'Numbered card with detail' },
  { type: 'stat-card', label: 'Stat Card', icon: BarChart3, description: 'Big number highlight' },
  { type: 'image', label: 'Image', icon: Image, description: 'Image with caption' },
  { type: 'embed', label: 'Video Embed', icon: Play, description: 'YouTube, Loom, Vimeo' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SlashCommandMenu({ isOpen, onSelect, onClose }: SlashCommandMenuProps) {
  const [filter, setFilter] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // ---- Filtered list (memoised) ----
  const filtered = useMemo(() => {
    if (!filter) return BLOCK_OPTIONS;
    const q = filter.toLowerCase();
    return BLOCK_OPTIONS.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        opt.description.toLowerCase().includes(q),
    );
  }, [filter]);

  // ---- Reset state when menu opens ----
  useEffect(() => {
    if (isOpen) {
      setFilter('');
      setActiveIndex(0);
      // Auto-focus input on next tick so the DOM has rendered
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [isOpen]);

  // ---- Keep active index in bounds when filter changes ----
  useEffect(() => {
    setActiveIndex(0);
  }, [filter]);

  // ---- Scroll active item into view ----
  useEffect(() => {
    itemRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  // ---- Close on outside click ----
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  // ---- Keyboard navigation ----
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown': {
          e.preventDefault();
          setActiveIndex((prev) => (prev + 1) % filtered.length);
          break;
        }
        case 'ArrowUp': {
          e.preventDefault();
          setActiveIndex((prev) => (prev - 1 + filtered.length) % filtered.length);
          break;
        }
        case 'Enter': {
          e.preventDefault();
          const option = filtered[activeIndex];
          if (option) {
            onSelect(option.type, option.style);
          }
          break;
        }
        case 'Escape': {
          e.preventDefault();
          onClose();
          break;
        }
      }
    },
    [filtered, activeIndex, onSelect, onClose],
  );

  // ---- Don't render when closed ----
  if (!isOpen) return null;

  return (
    <div
      ref={containerRef}
      className="z-50 w-[280px] max-h-[320px] overflow-y-auto rounded-lg border bg-popover p-1 shadow-xl"
      onKeyDown={handleKeyDown}
    >
      {/* Filter input */}
      <input
        ref={inputRef}
        type="text"
        placeholder="Filter blocks..."
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="w-full rounded border-0 bg-transparent px-2 py-1.5 text-sm outline-none"
      />

      {/* Options list */}
      {filtered.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">No blocks match</p>
      ) : (
        filtered.map((option, index) => {
          const Icon = option.icon;
          const isActive = index === activeIndex;

          return (
            <button
              key={`${option.type}-${option.style ?? index}`}
              ref={(el) => {
                itemRefs.current[index] = el;
              }}
              type="button"
              className={`flex w-full items-center gap-2.5 rounded px-2 py-1.5 text-left text-sm ${
                isActive
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:bg-muted/50'
              }`}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => onSelect(option.type, option.style)}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <div className="min-w-0">
                <span className="font-medium">{option.label}</span>
                <span className="ml-2 text-xs text-muted-foreground">{option.description}</span>
              </div>
            </button>
          );
        })
      )}
    </div>
  );
}
