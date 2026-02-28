'use client';

import { useState, useRef, useEffect } from 'react';
import { GripVertical, ChevronUp, ChevronDown, Trash2 } from 'lucide-react';

interface BlockHoverControlsProps {
  blockType: string;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  children: React.ReactNode;
}

export function BlockHoverControls({
  blockType,
  onMoveUp,
  onMoveDown,
  onDelete,
  canMoveUp,
  canMoveDown,
  children,
}: BlockHoverControlsProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;

    function handleMouseDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [menuOpen]);

  function handleMouseEnter() {
    setIsHovered(true);
  }

  function handleMouseLeave() {
    setIsHovered(false);
    setMenuOpen(false);
  }

  function handleGripClick(e: React.MouseEvent) {
    e.stopPropagation();
    setMenuOpen((prev) => !prev);
  }

  function handleMoveUp(e: React.MouseEvent) {
    e.stopPropagation();
    if (!canMoveUp) return;
    onMoveUp();
    setMenuOpen(false);
  }

  function handleMoveDown(e: React.MouseEvent) {
    e.stopPropagation();
    if (!canMoveDown) return;
    onMoveDown();
    setMenuOpen(false);
  }

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    onDelete();
    setMenuOpen(false);
  }

  return (
    <div
      ref={containerRef}
      className="group relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Hover outline */}
      <div
        className="pointer-events-none absolute inset-0 rounded-md transition-opacity duration-150"
        style={{
          outline: '1px solid var(--border)',
          outlineOffset: '2px',
          opacity: isHovered ? 1 : 0,
        }}
      />

      {/* Left gutter with grip handle */}
      <div
        className="absolute -left-10 top-0 flex items-start pt-1 transition-opacity duration-150"
        style={{
          opacity: isHovered ? 1 : 0,
          pointerEvents: isHovered ? 'auto' : 'none',
        }}
      >
        <button
          type="button"
          onClick={handleGripClick}
          className="flex h-6 w-6 items-center justify-center rounded hover:bg-muted text-muted-foreground cursor-grab active:cursor-grabbing"
          aria-label={`Block controls for ${blockType}`}
        >
          <GripVertical size={16} />
        </button>

        {/* Context menu */}
        {menuOpen && (
          <div
            ref={menuRef}
            className="absolute left-0 top-7 z-50 min-w-[140px] bg-popover border rounded-lg shadow-lg p-1"
          >
            <button
              type="button"
              onClick={handleMoveUp}
              disabled={!canMoveUp}
              className="flex w-full items-center gap-2 text-xs rounded px-2 py-1.5 hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronUp size={14} />
              Move up
            </button>

            <button
              type="button"
              onClick={handleMoveDown}
              disabled={!canMoveDown}
              className="flex w-full items-center gap-2 text-xs rounded px-2 py-1.5 hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronDown size={14} />
              Move down
            </button>

            {/* Divider */}
            <div className="my-1 h-px bg-border" />

            <button
              type="button"
              onClick={handleDelete}
              className="flex w-full items-center gap-2 text-xs rounded px-2 py-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950"
            >
              <Trash2 size={14} />
              Delete
            </button>
          </div>
        )}
      </div>

      {/* Block content */}
      {children}
    </div>
  );
}
