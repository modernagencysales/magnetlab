'use client';

import { useState, useRef, useEffect } from 'react';
import { Settings, X } from 'lucide-react';
import type { PolishedBlock, CalloutStyle } from '@/lib/types/lead-magnet';

interface StructuredBlockOverlayProps {
  block: PolishedBlock;
  onChange: (updates: Partial<PolishedBlock>) => void;
  isDark: boolean;
  primaryColor?: string;
  children: React.ReactNode;
}

const CODE_LANGUAGES = [
  'typescript',
  'javascript',
  'python',
  'bash',
  'html',
  'css',
  'json',
  'sql',
  'text',
];

const inputClass = (isDark: boolean) =>
  `w-full rounded border px-2 py-1.5 text-sm bg-background ${
    isDark ? 'border-zinc-700' : 'border-zinc-300'
  } focus:outline-none focus:ring-1 focus:ring-violet-500`;

const labelClass = 'text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground';

function CodeEditor({
  block,
  onChange,
  isDark,
}: {
  block: PolishedBlock;
  onChange: (updates: Partial<PolishedBlock>) => void;
  isDark: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div>
        <label className={labelClass}>Language</label>
        <select
          value={block.language || 'text'}
          onChange={(e) => onChange({ language: e.target.value })}
          className={inputClass(isDark)}
        >
          {CODE_LANGUAGES.map((lang) => (
            <option key={lang} value={lang}>
              {lang}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelClass}>Code</label>
        <textarea
          value={block.content}
          onChange={(e) => onChange({ content: e.target.value })}
          placeholder="Enter code..."
          className={`${inputClass(isDark)} font-mono`}
          style={{ minHeight: '160px', whiteSpace: 'pre', tabSize: 2 }}
        />
      </div>
    </div>
  );
}

function ImageEditor({
  block,
  onChange,
  isDark,
}: {
  block: PolishedBlock;
  onChange: (updates: Partial<PolishedBlock>) => void;
  isDark: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div>
        <label className={labelClass}>Image URL</label>
        <input
          value={block.src || ''}
          onChange={(e) => onChange({ src: e.target.value })}
          placeholder="https://example.com/image.jpg"
          className={inputClass(isDark)}
        />
      </div>
      <div>
        <label className={labelClass}>Alt Text</label>
        <input
          value={block.alt || ''}
          onChange={(e) => onChange({ alt: e.target.value })}
          placeholder="Describe the image..."
          className={inputClass(isDark)}
        />
      </div>
      <div>
        <label className={labelClass}>Caption</label>
        <input
          value={block.caption || ''}
          onChange={(e) => onChange({ caption: e.target.value })}
          placeholder="Image caption (optional)"
          className={inputClass(isDark)}
        />
      </div>
    </div>
  );
}

function EmbedEditor({
  block,
  onChange,
  isDark,
}: {
  block: PolishedBlock;
  onChange: (updates: Partial<PolishedBlock>) => void;
  isDark: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div>
        <label className={labelClass}>Video URL</label>
        <input
          value={block.url || ''}
          onChange={(e) => onChange({ url: e.target.value })}
          placeholder="YouTube, Loom, or Vimeo URL"
          className={inputClass(isDark)}
        />
      </div>
    </div>
  );
}

function AccordionEditor({
  block,
  onChange,
  isDark,
}: {
  block: PolishedBlock;
  onChange: (updates: Partial<PolishedBlock>) => void;
  isDark: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div>
        <label className={labelClass}>Title</label>
        <input
          value={block.title || ''}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="Accordion title..."
          className={inputClass(isDark)}
        />
      </div>
      <div>
        <label className={labelClass}>Content</label>
        <textarea
          value={block.content}
          onChange={(e) => onChange({ content: e.target.value })}
          placeholder="Accordion content..."
          className={inputClass(isDark)}
          style={{ minHeight: '100px' }}
        />
      </div>
    </div>
  );
}

function NumberedItemEditor({
  block,
  onChange,
  isDark,
}: {
  block: PolishedBlock;
  onChange: (updates: Partial<PolishedBlock>) => void;
  isDark: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-3">
        <div className="w-16">
          <label className={labelClass}>Number</label>
          <input
            type="number"
            value={block.number ?? 1}
            onChange={(e) => onChange({ number: parseInt(e.target.value) || 1 })}
            className={`${inputClass(isDark)} text-center`}
          />
        </div>
        <div className="flex-1">
          <label className={labelClass}>Title</label>
          <input
            value={block.title || ''}
            onChange={(e) => onChange({ title: e.target.value })}
            placeholder="Item title..."
            className={inputClass(isDark)}
          />
        </div>
      </div>
      <div>
        <label className={labelClass}>Category</label>
        <input
          value={block.category || ''}
          onChange={(e) => onChange({ category: e.target.value })}
          placeholder="e.g. Critical, Important, Quick Win"
          className={inputClass(isDark)}
        />
      </div>
      <div>
        <label className={labelClass}>Description</label>
        <textarea
          value={block.content}
          onChange={(e) => onChange({ content: e.target.value })}
          placeholder="Short description..."
          className={inputClass(isDark)}
          style={{ minHeight: '80px' }}
        />
      </div>
      <div>
        <label className={labelClass}>Detail (Read More)</label>
        <textarea
          value={block.detail || ''}
          onChange={(e) => onChange({ detail: e.target.value })}
          placeholder="Extended detail shown when expanded (optional)"
          className={inputClass(isDark)}
          style={{ minHeight: '80px' }}
        />
      </div>
    </div>
  );
}

function StatCardEditor({
  block,
  onChange,
  isDark,
}: {
  block: PolishedBlock;
  onChange: (updates: Partial<PolishedBlock>) => void;
  isDark: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div>
        <label className={labelClass}>Stat Value</label>
        <input
          value={block.content}
          onChange={(e) => onChange({ content: e.target.value })}
          placeholder="35%, 2.3x, $50k+..."
          className={inputClass(isDark)}
        />
      </div>
      <div>
        <label className={labelClass}>Style</label>
        <select
          value={block.style || 'info'}
          onChange={(e) => onChange({ style: e.target.value as CalloutStyle })}
          className={inputClass(isDark)}
        >
          <option value="info">Info (Blue)</option>
          <option value="warning">Warning (Amber)</option>
          <option value="success">Success (Green)</option>
        </select>
      </div>
      <div>
        <label className={labelClass}>Description</label>
        <input
          value={block.title || ''}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="What the stat means..."
          className={inputClass(isDark)}
        />
      </div>
    </div>
  );
}

function TableEditor({
  block,
  onChange,
  isDark,
}: {
  block: PolishedBlock;
  onChange: (updates: Partial<PolishedBlock>) => void;
  isDark: boolean;
}) {
  const headers = block.headers || [];
  const rows = block.rows || [];

  const addColumn = () => {
    const newHeaders = [...headers, `Column ${headers.length + 1}`];
    const newRows = rows.map((row) => [...row, '']);
    onChange({ headers: newHeaders, rows: newRows });
  };

  const addRow = () => {
    const newRows = [...rows, Array(headers.length).fill('')];
    onChange({ rows: newRows });
  };

  const updateHeader = (colIdx: number, value: string) => {
    const newHeaders = [...headers];
    newHeaders[colIdx] = value;
    onChange({ headers: newHeaders });
  };

  const removeColumn = (colIdx: number) => {
    if (headers.length <= 1) return;
    const newHeaders = headers.filter((_, i) => i !== colIdx);
    const newRows = rows.map((row) => row.filter((_, i) => i !== colIdx));
    onChange({ headers: newHeaders, rows: newRows });
  };

  const updateCell = (rowIdx: number, cellIdx: number, value: string) => {
    const newRows = rows.map((r, ri) =>
      ri === rowIdx ? r.map((c, ci) => (ci === cellIdx ? value : c)) : [...r]
    );
    onChange({ rows: newRows });
  };

  const removeRow = (rowIdx: number) => {
    if (rows.length <= 1) return;
    const newRows = rows.filter((_, i) => i !== rowIdx);
    onChange({ rows: newRows });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className={labelClass}>Table</span>
        <button
          onClick={addColumn}
          className={`rounded border px-2 py-0.5 text-xs ${
            isDark
              ? 'border-zinc-700 text-zinc-400 hover:bg-zinc-800'
              : 'border-zinc-300 text-zinc-600 hover:bg-zinc-100'
          }`}
        >
          + Column
        </button>
        <button
          onClick={addRow}
          className={`rounded border px-2 py-0.5 text-xs ${
            isDark
              ? 'border-zinc-700 text-zinc-400 hover:bg-zinc-800'
              : 'border-zinc-300 text-zinc-600 hover:bg-zinc-100'
          }`}
        >
          + Row
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {headers.map((header, colIdx) => (
                <th key={colIdx} className="p-0.5">
                  <div className="flex items-center gap-0.5">
                    <input
                      value={header}
                      onChange={(e) => updateHeader(colIdx, e.target.value)}
                      placeholder={`Header ${colIdx + 1}`}
                      className={`${inputClass(isDark)} font-semibold`}
                    />
                    {headers.length > 1 && (
                      <button
                        onClick={() => removeColumn(colIdx)}
                        className="shrink-0 rounded p-0.5 text-red-500 hover:bg-red-500/10"
                      >
                        <X size={10} />
                      </button>
                    )}
                  </div>
                </th>
              ))}
              <th className="w-6" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIdx) => (
              <tr key={rowIdx}>
                {row.map((cell, cellIdx) => (
                  <td key={cellIdx} className="p-0.5">
                    <input
                      value={cell}
                      onChange={(e) => updateCell(rowIdx, cellIdx, e.target.value)}
                      placeholder="Cell value"
                      className={inputClass(isDark)}
                    />
                  </td>
                ))}
                <td className="w-6 p-0.5">
                  {rows.length > 1 && (
                    <button
                      onClick={() => removeRow(rowIdx)}
                      className="rounded p-0.5 text-red-500 hover:bg-red-500/10"
                    >
                      <X size={10} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function getEditorForBlockType(
  block: PolishedBlock,
  onChange: (updates: Partial<PolishedBlock>) => void,
  isDark: boolean
): React.ReactNode | null {
  switch (block.type) {
    case 'code':
      return <CodeEditor block={block} onChange={onChange} isDark={isDark} />;
    case 'image':
      return <ImageEditor block={block} onChange={onChange} isDark={isDark} />;
    case 'embed':
      return <EmbedEditor block={block} onChange={onChange} isDark={isDark} />;
    case 'accordion':
      return <AccordionEditor block={block} onChange={onChange} isDark={isDark} />;
    case 'numbered-item':
      return <NumberedItemEditor block={block} onChange={onChange} isDark={isDark} />;
    case 'stat-card':
      return <StatCardEditor block={block} onChange={onChange} isDark={isDark} />;
    case 'table':
      return <TableEditor block={block} onChange={onChange} isDark={isDark} />;
    default:
      return null;
  }
}

const STRUCTURED_BLOCK_TYPES = new Set([
  'table',
  'code',
  'image',
  'embed',
  'accordion',
  'numbered-item',
  'stat-card',
]);

export function StructuredBlockOverlay({
  block,
  onChange,
  isDark,
  children,
}: StructuredBlockOverlayProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close popover on outside click
  useEffect(() => {
    if (!isOpen) return;

    function handleMouseDown(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [isOpen]);

  // If this block type does not have a structured editor, just render children
  if (!STRUCTURED_BLOCK_TYPES.has(block.type)) {
    return <>{children}</>;
  }

  const editor = getEditorForBlockType(block, onChange, isDark);

  return (
    <div
      ref={containerRef}
      className="relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* The published/rendered block */}
      {children}

      {/* Gear icon -- visible on hover or when popover is open */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className={`absolute -right-2 -top-2 z-10 rounded-full border bg-popover p-1 shadow-sm transition-opacity duration-150 ${
          isHovered || isOpen ? 'opacity-100' : 'opacity-0'
        }`}
        style={{
          borderColor: isDark ? '#27272A' : '#E4E4E7',
          color: isDark ? '#A1A1AA' : '#71717A',
        }}
        aria-label="Edit block settings"
      >
        <Settings size={14} />
      </button>

      {/* Popover editor */}
      {isOpen && editor && (
        <div
          ref={popoverRef}
          className="absolute right-0 top-8 z-50 w-[400px] rounded-lg border bg-popover p-4 shadow-xl"
          style={{
            borderColor: isDark ? '#27272A' : '#E4E4E7',
          }}
        >
          {/* Header */}
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {block.type.replace('-', ' ')} Settings
            </span>
            <button
              onClick={() => setIsOpen(false)}
              className="rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Close editor"
            >
              <X size={14} />
            </button>
          </div>

          {/* Block-specific form */}
          {editor}
        </div>
      )}
    </div>
  );
}
