'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Pencil, Trash2, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { KnowledgeCategory, KnowledgeSpeaker } from '@/lib/types/content-pipeline';

const CATEGORY_STYLES: Record<KnowledgeCategory, { label: string; className: string }> = {
  insight: { label: 'Insight', className: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300' },
  question: { label: 'Question', className: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300' },
  product_intel: { label: 'Product Intel', className: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' },
};

const CATEGORY_OPTIONS: { value: KnowledgeCategory; label: string }[] = [
  { value: 'insight', label: 'Insight' },
  { value: 'question', label: 'Question' },
  { value: 'product_intel', label: 'Product Intel' },
];

const SPEAKER_OPTIONS: { value: KnowledgeSpeaker; label: string }[] = [
  { value: 'host', label: 'Host' },
  { value: 'participant', label: 'Participant' },
  { value: 'unknown', label: 'Unknown' },
];

interface KnowledgeEntryCardProps {
  entry: {
    id: string;
    category: KnowledgeCategory;
    speaker?: KnowledgeSpeaker;
    content: string;
    context: string | null;
    tags: string[];
    similarity?: number;
  };
  onUpdate?: (id: string, entry: Record<string, unknown>) => void;
  onDelete?: (id: string) => void;
}

export function KnowledgeEntryCard({ entry, onUpdate, onDelete }: KnowledgeEntryCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Edit state
  const [editContent, setEditContent] = useState(entry.content);
  const [editCategory, setEditCategory] = useState<KnowledgeCategory>(entry.category);
  const [editSpeaker, setEditSpeaker] = useState<KnowledgeSpeaker>(entry.speaker || 'unknown');
  const [editContext, setEditContext] = useState(entry.context || '');
  const [editTags, setEditTags] = useState(entry.tags?.join(', ') || '');

  const categoryConfig = CATEGORY_STYLES[entry.category] || CATEGORY_STYLES.insight;

  const handleStartEdit = () => {
    setEditContent(entry.content);
    setEditCategory(entry.category);
    setEditSpeaker(entry.speaker || 'unknown');
    setEditContext(entry.context || '');
    setEditTags(entry.tags?.join(', ') || '');
    setEditing(true);
  };

  const handleCancelEdit = () => {
    setEditing(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const tags = editTags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const res = await fetch(`/api/content-pipeline/knowledge/${entry.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: editContent,
          category: editCategory,
          speaker: editSpeaker,
          context: editContext || null,
          tags,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setEditing(false);
        onUpdate?.(entry.id, data.entry);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/content-pipeline/knowledge/${entry.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        onDelete?.(entry.id);
      }
    } finally {
      setSaving(false);
      setConfirmDelete(false);
    }
  };

  if (editing) {
    return (
      <div className="rounded-lg border border-primary/30 bg-card p-4">
        <div className="space-y-3">
          {/* Category + Speaker row */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Category</label>
              <select
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value as KnowledgeCategory)}
                className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
              >
                {CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Speaker</label>
              <select
                value={editSpeaker}
                onChange={(e) => setEditSpeaker(e.target.value as KnowledgeSpeaker)}
                className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
              >
                {SPEAKER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Content */}
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Content</label>
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm leading-relaxed"
              rows={4}
            />
          </div>

          {/* Context */}
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Context</label>
            <textarea
              value={editContext}
              onChange={(e) => setEditContext(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm leading-relaxed"
              rows={2}
              placeholder="Optional context..."
            />
          </div>

          {/* Tags */}
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Tags (comma-separated)</label>
            <input
              type="text"
              value={editTags}
              onChange={(e) => setEditTags(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              placeholder="tag1, tag2, tag3"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <button
              onClick={handleCancelEdit}
              disabled={saving}
              className="flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
            >
              <X className="h-3.5 w-3.5" /> Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !editContent.trim()}
              className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <Check className="h-3.5 w-3.5" /> {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="group rounded-lg border bg-card p-4 transition-colors hover:border-primary/30">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="mb-2 flex items-center gap-2 flex-wrap">
            <span className={cn('rounded-full px-2 py-1 text-xs font-medium', categoryConfig.className)}>
              {categoryConfig.label}
            </span>
            {entry.speaker && entry.speaker !== 'unknown' && (
              <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                {entry.speaker}
              </span>
            )}
            {entry.similarity !== undefined && (
              <span className="text-xs text-muted-foreground">
                {Math.round(entry.similarity * 100)}% match
              </span>
            )}
          </div>
          <p className="text-sm leading-relaxed">{entry.content}</p>
        </div>

        {/* Edit/Delete buttons */}
        {(onUpdate || onDelete) && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {onUpdate && (
              <button
                onClick={handleStartEdit}
                className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title="Edit"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
            {onDelete && !confirmDelete && (
              <button
                onClick={() => setConfirmDelete(true)}
                className="rounded-md p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                title="Delete"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
            {confirmDelete && (
              <div className="flex items-center gap-1">
                <button
                  onClick={handleDelete}
                  disabled={saving}
                  className="rounded-md bg-destructive px-2 py-1 text-xs text-destructive-foreground hover:bg-destructive/90"
                >
                  {saving ? '...' : 'Delete'}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="rounded-md border px-2 py-1 text-xs hover:bg-muted"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tags */}
      {entry.tags?.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {entry.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Collapsible context */}
      {entry.context && (
        <div className="mt-3">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            Context
          </button>
          {expanded && (
            <p className="mt-2 rounded-lg bg-muted p-3 text-xs text-muted-foreground leading-relaxed">
              {entry.context}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
