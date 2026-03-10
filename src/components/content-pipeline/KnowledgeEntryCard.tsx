'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Pencil, Trash2, Check, X } from 'lucide-react';
import {
  Button,
  Input,
  Textarea,
  Label,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@magnetlab/magnetui';
import { cn } from '@/lib/utils';
import type { KnowledgeCategory, KnowledgeSpeaker } from '@/lib/types/content-pipeline';
import * as knowledgeApi from '@/frontend/api/content-pipeline/knowledge';

const CATEGORY_STYLES: Record<KnowledgeCategory, { label: string; className: string }> = {
  insight: {
    label: 'Insight',
    className: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300',
  },
  question: {
    label: 'Question',
    className: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  },
  product_intel: {
    label: 'Product Intel',
    className: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  },
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

      const data = (await knowledgeApi.updateKnowledgeEntry(entry.id, {
        content: editContent,
        category: editCategory,
        speaker: editSpeaker,
        context: editContext || null,
        tags,
      })) as { entry?: Record<string, unknown> };
      if (data.entry) {
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
      await knowledgeApi.deleteKnowledgeEntry(entry.id);
      onDelete?.(entry.id);
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
              <Label className="mb-1.5">Category</Label>
              <Select
                value={editCategory}
                onValueChange={(v) => setEditCategory(v as KnowledgeCategory)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Label className="mb-1.5">Speaker</Label>
              <Select
                value={editSpeaker}
                onValueChange={(v) => setEditSpeaker(v as KnowledgeSpeaker)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SPEAKER_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Content */}
          <div>
            <Label className="mb-1.5">Content</Label>
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="leading-relaxed"
              rows={4}
            />
          </div>

          {/* Context */}
          <div>
            <Label className="mb-1.5">Context</Label>
            <Textarea
              value={editContext}
              onChange={(e) => setEditContext(e.target.value)}
              className="leading-relaxed"
              rows={2}
              placeholder="Optional context..."
            />
          </div>

          {/* Tags */}
          <div>
            <Label className="mb-1.5">Tags (comma-separated)</Label>
            <Input
              type="text"
              value={editTags}
              onChange={(e) => setEditTags(e.target.value)}
              placeholder="tag1, tag2, tag3"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={handleCancelEdit} disabled={saving}>
              <X className="h-3.5 w-3.5" /> Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving || !editContent.trim()}>
              <Check className="h-3.5 w-3.5" /> {saving ? 'Saving...' : 'Save'}
            </Button>
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
            <span
              className={cn('rounded-full px-2 py-1 text-xs font-medium', categoryConfig.className)}
            >
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
              <Button variant="ghost" size="icon-sm" onClick={handleStartEdit} title="Edit">
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
            {onDelete && !confirmDelete && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setConfirmDelete(true)}
                title="Delete"
              >
                <Trash2 className="h-3.5 w-3.5 text-red-400" />
              </Button>
            )}
            {confirmDelete && (
              <div className="flex items-center gap-1">
                <Button variant="destructive" size="sm" onClick={handleDelete} disabled={saving}>
                  {saving ? '...' : 'Delete'}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setConfirmDelete(false)}>
                  Cancel
                </Button>
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
