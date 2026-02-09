'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import type { PipelinePost, ContentIdea } from '@/lib/types/content-pipeline';
import type { CardItem } from './KanbanCard';
import { KanbanColumn, type ColumnId } from './KanbanColumn';
import { BulkSelectionBar } from './BulkSelectionBar';
import { DetailPane } from './DetailPane';
import { PostDetailModal } from './PostDetailModal';

// ─── Types ────────────────────────────────────────────────

interface DragData {
  id: string;
  type: 'idea' | 'post';
  sourceColumn: ColumnId;
}

// ─── Component ────────────────────────────────────────────

export function KanbanBoard({ onRefresh }: { onRefresh?: () => void }) {
  // Data
  const [ideas, setIdeas] = useState<ContentIdea[]>([]);
  const [posts, setPosts] = useState<PipelinePost[]>([]);
  const [loading, setLoading] = useState(true);

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeColumn, setActiveColumn] = useState<ColumnId | null>(null);
  const lastSelectedId = useRef<string | null>(null);

  // Preview
  const [previewItem, setPreviewItem] = useState<{ item: CardItem; idea?: ContentIdea } | null>(null);

  // Modal
  const [modalPost, setModalPost] = useState<PipelinePost | null>(null);
  const [polishing, setPolishing] = useState(false);

  // Drag
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragData = useRef<DragData | null>(null);

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

  // Determine which column an item belongs to
  const getItemColumn = useCallback((item: CardItem): ColumnId => {
    if (item.type === 'idea') return 'ideas';
    const status = item.data.status;
    if (status === 'draft' || status === 'reviewing') return 'written';
    if (status === 'approved') return 'review';
    return 'scheduled';
  }, []);

  // ─── Selection ────────────────────────────────────────────

  const handleToggleSelect = useCallback((id: string, e: React.MouseEvent) => {
    // Find which column this item is in
    const columns: ColumnId[] = ['ideas', 'written', 'review', 'scheduled'];
    let itemColumn: ColumnId | null = null;
    for (const col of columns) {
      if (getColumnItems(col).some((item) => item.data.id === id)) {
        itemColumn = col;
        break;
      }
    }

    if (e.shiftKey && lastSelectedId.current && itemColumn && itemColumn === activeColumn) {
      // Shift-click range selection
      const colItems = getColumnItems(itemColumn);
      const lastIdx = colItems.findIndex((item) => item.data.id === lastSelectedId.current);
      const currIdx = colItems.findIndex((item) => item.data.id === id);
      if (lastIdx !== -1 && currIdx !== -1) {
        const start = Math.min(lastIdx, currIdx);
        const end = Math.max(lastIdx, currIdx);
        setSelectedIds((prev) => {
          const next = new Set(prev);
          for (let i = start; i <= end; i++) {
            next.add(colItems[i].data.id);
          }
          return next;
        });
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
    setActiveColumn(itemColumn);
  }, [activeColumn, getColumnItems]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setActiveColumn(null);
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
      if ((e.metaKey || e.ctrlKey) && e.key === 'a' && activeColumn) {
        e.preventDefault();
        const colItems = getColumnItems(activeColumn);
        setSelectedIds(new Set(colItems.map((item) => item.data.id)));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeColumn, getColumnItems, clearSelection]);

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

  // ─── Drag and drop ────────────────────────────────────────

  const handleDragStart = useCallback((e: React.DragEvent, item: CardItem) => {
    const data: DragData = {
      id: item.data.id,
      type: item.type,
      sourceColumn: getItemColumn(item),
    };
    dragData.current = data;
    e.dataTransfer.setData('application/json', JSON.stringify(data));
    e.dataTransfer.effectAllowed = 'move';
    setDraggingId(item.data.id);
  }, [getItemColumn]);

  const handleDrop = useCallback(async (targetColumn: ColumnId) => {
    const data = dragData.current;
    setDraggingId(null);
    dragData.current = null;
    if (!data || data.sourceColumn === targetColumn) return;

    try {
      if (data.type === 'idea' && targetColumn === 'written') {
        // Idea → Written: trigger write API
        await fetch(`/api/content-pipeline/ideas/${data.id}/write`, { method: 'POST' });
      } else if (data.type === 'post') {
        // Map column to status
        const statusMap: Record<ColumnId, string> = {
          ideas: 'draft',
          written: 'draft',
          review: 'approved',
          scheduled: 'scheduled',
        };
        const newStatus = statusMap[targetColumn];
        await fetch(`/api/content-pipeline/posts/${data.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus }),
        });
      }
      refresh();
    } catch {
      // Silent
    }
  }, [refresh]);

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
    if (!activeColumn || selectedIds.size === 0) return;
    setIsProcessing(true);

    try {
      const ids = [...selectedIds];
      if (activeColumn === 'ideas') {
        // Write all selected ideas
        await Promise.allSettled(ids.map((id) =>
          fetch(`/api/content-pipeline/ideas/${id}/write`, { method: 'POST' })
        ));
      } else if (activeColumn === 'written') {
        // Move to review (approved)
        await Promise.allSettled(ids.map((id) =>
          fetch(`/api/content-pipeline/posts/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'approved' }),
          })
        ));
      } else if (activeColumn === 'review') {
        // Schedule all
        await Promise.allSettled(ids.map((id) =>
          fetch('/api/content-pipeline/posts/schedule', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ post_id: id }),
          })
        ));
      } else if (activeColumn === 'scheduled') {
        // Move back to review
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
  }, [activeColumn, selectedIds, clearSelection, refresh]);

  const handleBulkDelete = useCallback(async () => {
    if (selectedIds.size === 0) return;
    setIsProcessing(true);

    try {
      const ids = [...selectedIds];
      // Figure out if each id is an idea or a post
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

  return (
    <div className="flex gap-3">
      {/* Columns area */}
      <div className="flex flex-1 gap-3 overflow-x-auto">
        {columns.map((col) => (
          <KanbanColumn
            key={col}
            columnId={col}
            items={getColumnItems(col)}
            selectedIds={selectedIds}
            previewId={previewItem?.item.data.id ?? null}
            draggingId={draggingId}
            onToggleSelect={handleToggleSelect}
            onCardClick={handleCardClick}
            onDragStart={handleDragStart}
            onDrop={handleDrop}
            onCardAction={handleCardAction}
          />
        ))}
      </div>

      {/* Detail pane */}
      {previewItem && (
        <div className="w-[400px] shrink-0">
          <div className="sticky top-0 h-[calc(100vh-160px)]">
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

      {/* Bulk selection bar */}
      {selectedIds.size > 0 && (
        <BulkSelectionBar
          count={selectedIds.size}
          activeColumn={activeColumn}
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
