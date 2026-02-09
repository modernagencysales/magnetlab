'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Loader2, CheckSquare, Square } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PipelinePost, ContentIdea } from '@/lib/types/content-pipeline';
import type { CardItem } from './KanbanCard';
import { FocusedCard } from './KanbanCard';
import { COLUMN_STYLES, type ColumnId } from './KanbanColumn';
import { BulkSelectionBar } from './BulkSelectionBar';
import { DetailPane } from './DetailPane';
import { PostDetailModal } from './PostDetailModal';

// ─── Component ────────────────────────────────────────────

export function KanbanBoard({ onRefresh }: { onRefresh?: () => void }) {
  // Data
  const [ideas, setIdeas] = useState<ContentIdea[]>([]);
  const [posts, setPosts] = useState<PipelinePost[]>([]);
  const [loading, setLoading] = useState(true);

  // Focused column
  const [focusedColumn, setFocusedColumn] = useState<ColumnId>('ideas');

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const lastSelectedId = useRef<string | null>(null);

  // Preview
  const [previewItem, setPreviewItem] = useState<{ item: CardItem; idea?: ContentIdea } | null>(null);

  // Modal
  const [modalPost, setModalPost] = useState<PipelinePost | null>(null);
  const [polishing, setPolishing] = useState(false);

  // Processing
  const [isProcessing, setIsProcessing] = useState(false);

  // ─── Data fetching ────────────────────────────────────────

  const fetchData = useCallback(async () => {
    try {
      const [ideasRes, postsRes] = await Promise.all([
        fetch('/api/content-pipeline/ideas?status=extracted&limit=200'),
        fetch('/api/content-pipeline/posts?limit=200'),
      ]);
      const [ideasData, postsData] = await Promise.all([
        ideasRes.json(),
        postsRes.json(),
      ]);
      setIdeas(ideasData.ideas || []);
      setPosts(postsData.posts || []);
    } catch {
      // Silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refresh = useCallback(() => {
    fetchData();
    onRefresh?.();
  }, [fetchData, onRefresh]);

  // ─── Column data ──────────────────────────────────────────

  const getColumnItems = useCallback((columnId: ColumnId): CardItem[] => {
    switch (columnId) {
      case 'ideas':
        return ideas.map((idea) => ({ type: 'idea' as const, data: idea }));
      case 'written':
        return posts
          .filter((p) => p.status === 'draft' || p.status === 'reviewing')
          .map((post) => ({ type: 'post' as const, data: post }));
      case 'review':
        return posts
          .filter((p) => p.status === 'approved')
          .map((post) => ({ type: 'post' as const, data: post }));
      case 'scheduled':
        return posts
          .filter((p) => p.status === 'scheduled' || p.status === 'published')
          .map((post) => ({ type: 'post' as const, data: post }));
      default:
        return [];
    }
  }, [ideas, posts]);

  // ─── Column switching ─────────────────────────────────────

  const handleColumnSwitch = useCallback((col: ColumnId) => {
    setFocusedColumn(col);
    setSelectedIds(new Set());
    lastSelectedId.current = null;
    setPreviewItem(null);
  }, []);

  // ─── Selection ────────────────────────────────────────────

  const handleToggleSelect = useCallback((id: string, e: React.MouseEvent) => {
    const items = getColumnItems(focusedColumn);

    if (e.shiftKey && lastSelectedId.current) {
      const lastIdx = items.findIndex((i) => i.data.id === lastSelectedId.current);
      const currIdx = items.findIndex((i) => i.data.id === id);
      if (lastIdx !== -1 && currIdx !== -1) {
        const start = Math.min(lastIdx, currIdx);
        const end = Math.max(lastIdx, currIdx);
        setSelectedIds((prev) => {
          const next = new Set(prev);
          for (let i = start; i <= end; i++) next.add(items[i].data.id);
          return next;
        });
        lastSelectedId.current = id;
        return;
      }
    }

    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    lastSelectedId.current = id;
  }, [focusedColumn, getColumnItems]);

  const selectAll = useCallback(() => {
    const items = getColumnItems(focusedColumn);
    setSelectedIds(new Set(items.map((i) => i.data.id)));
  }, [focusedColumn, getColumnItems]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    lastSelectedId.current = null;
  }, []);

  // ─── Keyboard shortcuts ───────────────────────────────────

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        clearSelection();
        setPreviewItem(null);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
        e.preventDefault();
        selectAll();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [clearSelection, selectAll]);

  // ─── Card click → preview ─────────────────────────────────

  const handleCardClick = useCallback((item: CardItem) => {
    if (previewItem && previewItem.item.data.id === item.data.id) {
      setPreviewItem(null);
    } else {
      const idea = item.type === 'post' && item.data.idea_id
        ? ideas.find((i) => i.id === item.data.idea_id)
        : undefined;
      setPreviewItem({ item, idea });
    }
  }, [previewItem, ideas]);

  // ─── Card actions ─────────────────────────────────────────

  const handleCardAction = useCallback(async (item: CardItem, action: string) => {
    try {
      if (item.type === 'idea') {
        if (action === 'write') {
          await fetch(`/api/content-pipeline/ideas/${item.data.id}/write`, { method: 'POST' });
          refresh();
        } else if (action === 'archive') {
          await fetch(`/api/content-pipeline/ideas/${item.data.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'archived' }),
          });
          refresh();
        } else if (action === 'delete') {
          await fetch(`/api/content-pipeline/ideas/${item.data.id}`, { method: 'DELETE' });
          refresh();
        }
      } else {
        if (action === 'edit') {
          setModalPost(item.data);
        } else if (action === 'publish') {
          const res = await fetch(`/api/content-pipeline/posts/${item.data.id}/publish`, { method: 'POST' });
          const data = await res.json();
          if (!res.ok && data.error?.includes('Settings')) {
            alert(data.error);
          }
          refresh();
        } else if (action === 'delete') {
          await fetch(`/api/content-pipeline/posts/${item.data.id}`, { method: 'DELETE' });
          if (previewItem?.item.data.id === item.data.id) setPreviewItem(null);
          refresh();
        }
      }
    } catch {
      // Silent
    }
  }, [refresh, previewItem]);

  // ─── Bulk actions ─────────────────────────────────────────

  const handleBulkPrimary = useCallback(async () => {
    if (selectedIds.size === 0) return;
    setIsProcessing(true);

    try {
      const ids = [...selectedIds];
      if (focusedColumn === 'ideas') {
        await Promise.allSettled(ids.map((id) =>
          fetch(`/api/content-pipeline/ideas/${id}/write`, { method: 'POST' })
        ));
      } else if (focusedColumn === 'written') {
        await Promise.allSettled(ids.map((id) =>
          fetch(`/api/content-pipeline/posts/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'approved' }),
          })
        ));
      } else if (focusedColumn === 'review') {
        await Promise.allSettled(ids.map((id) =>
          fetch('/api/content-pipeline/posts/schedule', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ post_id: id }),
          })
        ));
      } else if (focusedColumn === 'scheduled') {
        await Promise.allSettled(ids.map((id) =>
          fetch(`/api/content-pipeline/posts/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'approved' }),
          })
        ));
      }
    } catch {
      // Silent
    } finally {
      clearSelection();
      setIsProcessing(false);
      refresh();
    }
  }, [focusedColumn, selectedIds, clearSelection, refresh]);

  const handleBulkDelete = useCallback(async () => {
    if (selectedIds.size === 0) return;
    setIsProcessing(true);

    try {
      const ids = [...selectedIds];
      const ideaIds = new Set(ideas.map((i) => i.id));
      await Promise.allSettled(ids.map((id) => {
        const endpoint = ideaIds.has(id)
          ? `/api/content-pipeline/ideas/${id}`
          : `/api/content-pipeline/posts/${id}`;
        return fetch(endpoint, { method: 'DELETE' });
      }));
    } catch {
      // Silent
    } finally {
      clearSelection();
      setIsProcessing(false);
      refresh();
    }
  }, [selectedIds, ideas, clearSelection, refresh]);

  // ─── Detail pane callbacks ────────────────────────────────

  const handleWritePost = useCallback(async (ideaId: string) => {
    try {
      await fetch(`/api/content-pipeline/ideas/${ideaId}/write`, { method: 'POST' });
      setPreviewItem(null);
      refresh();
    } catch {
      // Silent
    }
  }, [refresh]);

  const handleContentUpdate = useCallback((postId: string, content: string) => {
    setPosts((prev) =>
      prev.map((p) => p.id === postId ? { ...p, draft_content: content, final_content: null } : p)
    );
  }, []);

  const handleOpenModal = useCallback((post: PipelinePost) => {
    setModalPost(post);
  }, []);

  // ─── Modal callbacks ─────────────────────────────────────

  const handlePolish = useCallback(async (postId: string) => {
    setPolishing(true);
    try {
      await fetch(`/api/content-pipeline/posts/${postId}/polish`, { method: 'POST' });
      refresh();
    } catch {
      // Silent
    } finally {
      setPolishing(false);
    }
  }, [refresh]);

  // ─── Render ───────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const columns: ColumnId[] = ['ideas', 'written', 'review', 'scheduled'];
  const currentItems = getColumnItems(focusedColumn);
  const allSelected = currentItems.length > 0 && currentItems.every((i) => selectedIds.has(i.data.id));

  return (
    <div>
      {/* Column tabs */}
      <div className="flex gap-1 mb-4 p-1 rounded-lg bg-muted/50">
        {columns.map((col) => {
          const items = getColumnItems(col);
          const config = COLUMN_STYLES[col];
          const active = focusedColumn === col;
          return (
            <button
              key={col}
              onClick={() => handleColumnSwitch(col)}
              className={cn(
                'flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition-all flex-1',
                active
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
              )}
            >
              <span className={cn('h-2 w-2 rounded-full shrink-0', config.dotColor)} />
              <span>{config.label}</span>
              <span className={cn(
                'rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                active ? config.badgeColor : 'text-muted-foreground'
              )}>
                {items.length}
              </span>
            </button>
          );
        })}
      </div>

      {/* Focused column content */}
      <div className="flex gap-4">
        <div className="flex-1 min-w-0">
          {/* Select all header */}
          {currentItems.length > 0 && (
            <div className="flex items-center gap-3 mb-3 px-1">
              <button
                onClick={allSelected ? clearSelection : selectAll}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {allSelected ? (
                  <CheckSquare className="h-4 w-4 text-primary" />
                ) : (
                  <Square className="h-4 w-4" />
                )}
              </button>
              <span className="text-xs text-muted-foreground">
                {selectedIds.size > 0
                  ? `${selectedIds.size} of ${currentItems.length} selected`
                  : `${currentItems.length} items`}
              </span>
            </div>
          )}

          {/* Item list */}
          <div className="space-y-2">
            {currentItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <p className="text-sm">No items in this column</p>
                <p className="text-xs mt-1">
                  {focusedColumn === 'ideas' && 'Process some transcripts to generate ideas'}
                  {focusedColumn === 'written' && 'Write posts from your ideas'}
                  {focusedColumn === 'review' && 'Move written posts here for review'}
                  {focusedColumn === 'scheduled' && 'Schedule approved posts for publishing'}
                </p>
              </div>
            ) : (
              currentItems.map((item) => (
                <FocusedCard
                  key={item.data.id}
                  item={item}
                  selected={selectedIds.has(item.data.id)}
                  previewActive={previewItem?.item.data.id === item.data.id}
                  onToggleSelect={(e) => handleToggleSelect(item.data.id, e)}
                  onClick={() => handleCardClick(item)}
                  onAction={(action) => handleCardAction(item, action)}
                />
              ))
            )}
          </div>
        </div>

        {/* Detail pane */}
        {previewItem && (
          <div className="w-[400px] shrink-0">
            <div className="sticky top-0 h-[calc(100vh-200px)]">
              <DetailPane
                item={
                  previewItem.item.type === 'idea'
                    ? { type: 'idea', data: previewItem.item.data as ContentIdea }
                    : { type: 'post', data: previewItem.item.data as PipelinePost, idea: previewItem.idea }
                }
                onClose={() => setPreviewItem(null)}
                onWritePost={handleWritePost}
                onContentUpdate={handleContentUpdate}
                onOpenModal={handleOpenModal}
                onRefresh={refresh}
              />
            </div>
          </div>
        )}
      </div>

      {/* Bulk selection bar */}
      {selectedIds.size > 0 && (
        <BulkSelectionBar
          count={selectedIds.size}
          activeColumn={focusedColumn}
          isProcessing={isProcessing}
          onPrimaryAction={handleBulkPrimary}
          onDelete={handleBulkDelete}
          onClear={clearSelection}
        />
      )}

      {/* Post detail modal */}
      {modalPost && (
        <PostDetailModal
          post={modalPost}
          onClose={() => setModalPost(null)}
          onPolish={handlePolish}
          onUpdate={refresh}
          polishing={polishing}
        />
      )}
    </div>
  );
}
