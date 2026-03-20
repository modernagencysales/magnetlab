'use client';

/**
 * ContentReviewPanel — inline card for reviewing AI-generated lead magnet content.
 * Renders in the conversation message stream when content_review displayHint is received.
 * Constraint: Only receives data via props. No direct API calls.
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Plus } from 'lucide-react';
import type { ExtractedContent } from '@/lib/types/lead-magnet';
import { EditableField, SectionRenderer, MistakesList } from './ContentReviewSections';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface ContentReviewPanelProps {
  content: ExtractedContent;
  onApprove: (content: ExtractedContent) => void;
  onRequestChanges: (feedback: string) => void;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Normalize content items that may be strings or objects from AI output. */
function normalizeItem(item: unknown): string {
  if (typeof item === 'string') return item;
  if (item && typeof item === 'object' && 'text' in item) {
    return String((item as { text: string }).text);
  }
  if (item && typeof item === 'object' && 'content' in item) {
    return String((item as { content: string }).content);
  }
  return String(item ?? '');
}

// ─── ContentReviewPanel ────────────────────────────────────────────────────────

export function ContentReviewPanel({
  content,
  onApprove,
  onRequestChanges,
}: ContentReviewPanelProps) {
  // ── Local editing state ────────────────────────────────────────────────────

  const [editedContent, setEditedContent] = useState<ExtractedContent>(content);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<number>>(
    () => new Set(content.structure.map((_, i) => i))
  );
  const [isRequestingChanges, setIsRequestingChanges] = useState(false);
  const [changeFeedback, setChangeFeedback] = useState('');
  const feedbackInputRef = useRef<HTMLInputElement>(null);

  // Reset when content prop changes
  useEffect(() => {
    setEditedContent(content);
    setEditingField(null);
    setExpandedSections(new Set(content.structure.map((_, i) => i)));
    setIsRequestingChanges(false);
    setChangeFeedback('');
  }, [content]);

  // Focus feedback input when entering request-changes mode
  useEffect(() => {
    if (isRequestingChanges) {
      requestAnimationFrame(() => feedbackInputRef.current?.focus());
    }
  }, [isRequestingChanges]);

  // Dismiss editing state on Escape
  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (editingField) {
          setEditingField(null);
        } else if (isRequestingChanges) {
          setIsRequestingChanges(false);
          setChangeFeedback('');
        }
      }
    }

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [editingField, isRequestingChanges]);

  // ── Editing helpers ────────────────────────────────────────────────────────

  const startEdit = useCallback((field: string) => {
    setEditingField(field);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingField(null);
  }, []);

  const saveField = useCallback((field: string, value: string) => {
    setEditingField(null);

    setEditedContent((prev) => {
      const next = { ...prev };

      if (field === 'title') {
        next.title = value;
      } else if (field === 'insight') {
        next.nonObviousInsight = value;
      } else if (field === 'experience') {
        next.personalExperience = value;
      } else if (field === 'proof') {
        next.proof = value;
      } else if (field === 'differentiation') {
        next.differentiation = value;
      } else if (field.startsWith('section-name-')) {
        const sectionIdx = parseInt(field.replace('section-name-', ''), 10);
        next.structure = prev.structure.map((s, i) =>
          i === sectionIdx ? { ...s, sectionName: value } : s
        );
      } else if (field.startsWith('item-')) {
        const parts = field.replace('item-', '').split('-');
        const sectionIdx = parseInt(parts[0], 10);
        const itemIdx = parseInt(parts[1], 10);
        next.structure = prev.structure.map((s, si) =>
          si === sectionIdx
            ? {
                ...s,
                contents: s.contents.map((c, ci) => (ci === itemIdx ? value : c)),
              }
            : s
        );
      } else if (field.startsWith('mistake-')) {
        const mistakeIdx = parseInt(field.replace('mistake-', ''), 10);
        next.commonMistakes = prev.commonMistakes.map((m, i) => (i === mistakeIdx ? value : m));
      }

      return next;
    });
  }, []);

  // ── Section manipulation ───────────────────────────────────────────────────

  const toggleSection = useCallback((idx: number) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  }, []);

  const addSection = useCallback(() => {
    setEditedContent((prev) => ({
      ...prev,
      structure: [...prev.structure, { sectionName: 'New Section', contents: [''] }],
    }));
    setExpandedSections((prev) => {
      const next = new Set(prev);
      next.add(editedContent.structure.length);
      return next;
    });
  }, [editedContent.structure.length]);

  const removeSection = useCallback(
    (idx: number) => {
      if (editedContent.structure.length <= 1) return;
      setEditedContent((prev) => ({
        ...prev,
        structure: prev.structure.filter((_, i) => i !== idx),
      }));
      setExpandedSections((prev) => {
        const next = new Set<number>();
        for (const v of prev) {
          if (v < idx) next.add(v);
          else if (v > idx) next.add(v - 1);
          // skip the removed index
        }
        return next;
      });
    },
    [editedContent.structure.length]
  );

  const addItem = useCallback((sectionIdx: number) => {
    setEditedContent((prev) => ({
      ...prev,
      structure: prev.structure.map((s, i) =>
        i === sectionIdx ? { ...s, contents: [...s.contents, ''] } : s
      ),
    }));
  }, []);

  const removeItem = useCallback((sectionIdx: number, itemIdx: number) => {
    setEditedContent((prev) => ({
      ...prev,
      structure: prev.structure.map((s, si) =>
        si === sectionIdx ? { ...s, contents: s.contents.filter((_, ci) => ci !== itemIdx) } : s
      ),
    }));
  }, []);

  // ── Request changes handlers ───────────────────────────────────────────────

  const handleRequestChanges = useCallback(() => {
    setIsRequestingChanges(true);
  }, []);

  const submitChangeFeedback = useCallback(() => {
    const trimmed = changeFeedback.trim();
    if (!trimmed) return;
    onRequestChanges(trimmed);
    setIsRequestingChanges(false);
    setChangeFeedback('');
  }, [changeFeedback, onRequestChanges]);

  const cancelRequestChanges = useCallback(() => {
    setIsRequestingChanges(false);
    setChangeFeedback('');
  }, []);

  const handleFeedbackKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        submitChangeFeedback();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancelRequestChanges();
      }
    },
    [submitChangeFeedback, cancelRequestChanges]
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="bg-card border border-border rounded-lg p-6 my-4">
      {/* ── Header ────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <h2 className="text-lg font-semibold text-foreground truncate">Review Content</h2>

        <div className="flex items-center gap-3">
          {isRequestingChanges ? (
            <div className="flex items-center gap-2">
              <input
                ref={feedbackInputRef}
                type="text"
                value={changeFeedback}
                onChange={(e) => setChangeFeedback(e.target.value)}
                onKeyDown={handleFeedbackKeyDown}
                placeholder="What should be changed?"
                className="w-64 sm:w-80 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                onClick={submitChangeFeedback}
                disabled={!changeFeedback.trim()}
                className="px-3 py-1.5 text-sm font-medium text-white bg-amber-600 rounded-md hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Send
              </button>
              <button
                onClick={cancelRequestChanges}
                className="px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <>
              <button
                onClick={handleRequestChanges}
                className="px-4 py-2 text-sm font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md hover:bg-amber-100 dark:hover:bg-amber-950/50 transition-colors"
              >
                Request Changes
              </button>
              <button
                onClick={() => onApprove(editedContent)}
                className="px-4 py-2 text-sm font-medium text-white bg-violet-600 rounded-md hover:bg-violet-700 transition-colors"
              >
                Approve &amp; Save
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Content ───────────────────────────────────────────────── */}
      <div className="space-y-8">
        {/* ── Title ─────────────────────────────────────────── */}
        <div>
          <EditableField
            value={editedContent.title}
            isEditing={editingField === 'title'}
            onStartEdit={() => startEdit('title')}
            onSave={(v) => saveField('title', v)}
            onCancel={cancelEdit}
            large
          />
          <p className="mt-1 text-sm text-muted-foreground">{editedContent.format}</p>
        </div>

        {/* ── Key Insight ────────────────────────────────────── */}
        {editedContent.nonObviousInsight && (
          <div className="border-l-4 border-amber-500 bg-amber-50 dark:bg-amber-950/20 rounded-r-lg p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400 mb-1">
              Key Insight
            </p>
            <EditableField
              value={editedContent.nonObviousInsight}
              isEditing={editingField === 'insight'}
              onStartEdit={() => startEdit('insight')}
              onSave={(v) => saveField('insight', v)}
              onCancel={cancelEdit}
              multiline
            />
          </div>
        )}

        {/* ── Sections ──────────────────────────────────────── */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Sections
            </h3>
            <button
              onClick={addSection}
              className="flex items-center gap-1 text-xs font-medium text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Section
            </button>
          </div>

          {editedContent.structure.map((section, sectionIdx) => (
            <SectionRenderer
              key={sectionIdx}
              section={section}
              sectionIdx={sectionIdx}
              isExpanded={expandedSections.has(sectionIdx)}
              editingField={editingField}
              canRemove={editedContent.structure.length > 1}
              normalizeItem={normalizeItem}
              onToggle={toggleSection}
              onStartEdit={startEdit}
              onSaveField={saveField}
              onCancelEdit={cancelEdit}
              onRemoveSection={removeSection}
              onAddItem={addItem}
              onRemoveItem={removeItem}
            />
          ))}
        </div>

        {/* ── Personal Experience ────────────────────────────── */}
        {editedContent.personalExperience && (
          <div className="border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-950/20 rounded-r-lg p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-400 mb-1">
              Personal Experience
            </p>
            <EditableField
              value={editedContent.personalExperience}
              isEditing={editingField === 'experience'}
              onStartEdit={() => startEdit('experience')}
              onSave={(v) => saveField('experience', v)}
              onCancel={cancelEdit}
              multiline
            />
          </div>
        )}

        {/* ── Proof & Results ────────────────────────────────── */}
        {editedContent.proof && (
          <div className="border-l-4 border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20 rounded-r-lg p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400 mb-1">
              Proof &amp; Results
            </p>
            <EditableField
              value={editedContent.proof}
              isEditing={editingField === 'proof'}
              onStartEdit={() => startEdit('proof')}
              onSave={(v) => saveField('proof', v)}
              onCancel={cancelEdit}
              multiline
            />
          </div>
        )}

        {/* ── Common Mistakes ────────────────────────────────── */}
        <MistakesList
          mistakes={editedContent.commonMistakes}
          editingField={editingField}
          normalizeItem={normalizeItem}
          onStartEdit={startEdit}
          onSaveField={saveField}
          onCancelEdit={cancelEdit}
        />

        {/* ── Differentiation ────────────────────────────────── */}
        {editedContent.differentiation && (
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              What Makes This Different
            </h3>
            <EditableField
              value={editedContent.differentiation}
              isEditing={editingField === 'differentiation'}
              onStartEdit={() => startEdit('differentiation')}
              onSave={(v) => saveField('differentiation', v)}
              onCancel={cancelEdit}
              multiline
            />
          </div>
        )}
      </div>
    </div>
  );
}
