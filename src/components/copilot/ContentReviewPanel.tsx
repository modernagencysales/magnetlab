'use client';

/**
 * ContentReviewPanel — inline card for reviewing AI-generated lead magnet content.
 * Renders in the conversation message stream when content_review displayHint is received.
 * Constraint: Only receives data via props. No direct API calls.
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { X, ChevronDown, ChevronRight, Plus, Trash2, Check, Pencil } from 'lucide-react';
import type { ExtractedContent } from '@/lib/types/lead-magnet';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface ContentReviewPanelProps {
  content: ExtractedContent;
  onApprove: (content: ExtractedContent) => void;
  onRequestChanges: (feedback: string) => void;
}

interface EditableFieldProps {
  value: string;
  isEditing: boolean;
  onStartEdit: () => void;
  onSave: (value: string) => void;
  onCancel: () => void;
  large?: boolean;
  inline?: boolean;
  multiline?: boolean;
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

// ─── EditableField Sub-component ───────────────────────────────────────────────

function EditableField({
  value,
  isEditing,
  onStartEdit,
  onSave,
  onCancel,
  large = false,
  inline = false,
  multiline = false,
}: EditableFieldProps) {
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing) {
      setDraft(value);
      // Focus on next tick so the element is rendered
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isEditing, value]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
        return;
      }
      if (multiline) {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          onSave(draft);
        }
      } else {
        if (e.key === 'Enter') {
          e.preventDefault();
          onSave(draft);
        }
      }
    },
    [draft, multiline, onSave, onCancel]
  );

  if (isEditing) {
    const sharedClasses =
      'w-full rounded-md border border-violet-300 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500';

    return (
      <div className="flex items-start gap-2">
        {multiline ? (
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={4}
            className={`${sharedClasses} resize-y`}
          />
        ) : (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            className={`${sharedClasses} ${large ? 'text-2xl font-bold' : ''}`}
          />
        )}
        <button
          onClick={() => onSave(draft)}
          className="mt-1 p-1.5 rounded-md bg-violet-600 text-white hover:bg-violet-700 transition-colors flex-shrink-0"
          aria-label="Save"
        >
          <Check className="w-4 h-4" />
        </button>
        <button
          onClick={onCancel}
          className="mt-1 p-1.5 rounded-md bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors flex-shrink-0"
          aria-label="Cancel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  const textClasses = large
    ? 'text-2xl font-bold text-zinc-900 dark:text-zinc-100'
    : inline
      ? 'text-sm text-zinc-700 dark:text-zinc-300'
      : 'text-sm text-zinc-800 dark:text-zinc-200 leading-relaxed';

  return (
    <div
      className="group relative cursor-pointer rounded-md px-1 -mx-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
      onClick={onStartEdit}
    >
      <span className={textClasses}>{value || '(empty)'}</span>
      <Pencil className="absolute top-1/2 -translate-y-1/2 right-1 w-3.5 h-3.5 text-zinc-400 opacity-0 group-hover:opacity-50 transition-opacity" />
    </div>
  );
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
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 truncate">
          Review Content
        </h2>

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
                className="w-64 sm:w-80 rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-1.5 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
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
                className="px-3 py-1.5 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors"
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
          <p className="mt-1 text-sm text-zinc-400">{editedContent.format}</p>
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
            <h3 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
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

          {editedContent.structure.map((section, sectionIdx) => {
            const isExpanded = expandedSections.has(sectionIdx);
            return (
              <div
                key={sectionIdx}
                className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 overflow-hidden"
              >
                {/* Section header */}
                <div className="flex items-center gap-2 px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50">
                  <button
                    onClick={() => toggleSection(sectionIdx)}
                    className="p-0.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                    aria-label={isExpanded ? 'Collapse section' : 'Expand section'}
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <EditableField
                      value={section.sectionName}
                      isEditing={editingField === `section-name-${sectionIdx}`}
                      onStartEdit={() => startEdit(`section-name-${sectionIdx}`)}
                      onSave={(v) => saveField(`section-name-${sectionIdx}`, v)}
                      onCancel={cancelEdit}
                      inline
                    />
                  </div>
                  {editedContent.structure.length > 1 && (
                    <button
                      onClick={() => removeSection(sectionIdx)}
                      className="p-1 text-zinc-300 hover:text-red-500 dark:text-zinc-600 dark:hover:text-red-400 transition-colors"
                      aria-label="Remove section"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Section body */}
                {isExpanded && (
                  <div className="px-4 py-3 space-y-2">
                    {section.contents.map((item, itemIdx) => (
                      <div key={itemIdx} className="flex items-start gap-2">
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-zinc-300 dark:bg-zinc-600 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <EditableField
                            value={normalizeItem(item)}
                            isEditing={editingField === `item-${sectionIdx}-${itemIdx}`}
                            onStartEdit={() => startEdit(`item-${sectionIdx}-${itemIdx}`)}
                            onSave={(v) => saveField(`item-${sectionIdx}-${itemIdx}`, v)}
                            onCancel={cancelEdit}
                            multiline
                          />
                        </div>
                        <button
                          onClick={() => removeItem(sectionIdx, itemIdx)}
                          className="mt-1 p-0.5 text-zinc-300 hover:text-red-500 dark:text-zinc-600 dark:hover:text-red-400 transition-colors flex-shrink-0"
                          aria-label="Remove item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => addItem(sectionIdx)}
                      className="flex items-center gap-1 mt-1 text-xs font-medium text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300 transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      Add item
                    </button>
                  </div>
                )}
              </div>
            );
          })}
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
        {editedContent.commonMistakes.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-3">
              Common Mistakes
            </h3>
            <div className="flex flex-wrap gap-2">
              {editedContent.commonMistakes.map((mistake, i) => (
                <div key={i} className="group relative">
                  {editingField === `mistake-${i}` ? (
                    <div className="flex items-center gap-1">
                      <EditableField
                        value={normalizeItem(mistake)}
                        isEditing
                        onStartEdit={() => startEdit(`mistake-${i}`)}
                        onSave={(v) => saveField(`mistake-${i}`, v)}
                        onCancel={cancelEdit}
                        inline
                      />
                    </div>
                  ) : (
                    <span
                      onClick={() => startEdit(`mistake-${i}`)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 cursor-pointer hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                    >
                      {normalizeItem(mistake)}
                      <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity" />
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Differentiation ────────────────────────────────── */}
        {editedContent.differentiation && (
          <div>
            <h3 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-2">
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
