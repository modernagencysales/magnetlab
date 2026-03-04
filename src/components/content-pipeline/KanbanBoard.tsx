'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { Loader2, CheckSquare, Square } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PipelinePost, ContentIdea, PostStatus } from '@/lib/types/content-pipeline';
import type { CardItem } from './KanbanCard';
import { FocusedCard } from './KanbanCard';
import { COLUMN_STYLES, type ColumnId } from './KanbanColumn';
import { BulkSelectionBar } from './BulkSelectionBar';
import { DetailPane } from './DetailPane';
import { PostDetailModal } from './PostDetailModal';
import { getIdeas, writeFromIdea, updateIdeaStatus, deleteIdea } from '@/frontend/api/content-pipeline/ideas';
import { getPosts, updatePost, deletePost, schedulePost, publishPost, polishPost } from '@/frontend/api/content-pipeline/posts';

// ─── Component ────────────────────────────────────────────

interface KanbanBoardProps {
  onRefresh?: () => void;
  profileId?: string | null;
  initialIdeas?: ContentIdea[];
  initialPosts?: PipelinePost[];
}

export function KanbanBoard({
  onRefresh,
  profileId,
  initialIdeas: initialIdeasProp,
  initialPosts: initialPostsProp,
}: KanbanBoardProps) {
  const [ideas, setIdeas] = useState<ContentIdea[]>(initialIdeasProp ?? []);
  const [posts, setPosts] = useState<PipelinePost[]>(initialPostsProp ?? []);
  const [loading, setLoading] = useState(!initialIdeasProp && !initialPostsProp);

  useEffect(() => {
    if (initialIdeasProp !== undefined && initialPostsProp !== undefined) {
      setIdeas(initialIdeasProp);
      setPosts(initialPostsProp);
    }
  }, [initialIdeasProp, initialPostsProp]);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [ideasList, postsList] = await Promise.all([
        getIdeas({ status: 'extracted', limit: 200, teamProfileId: profileId ?? undefined }),
        getPosts({ limit: 200, teamProfileId: profileId ?? undefined, isBuffer: false }),
      ]);
      setIdeas(ideasList);
      setPosts(postsList);
    } catch {
      // Silent
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    if (initialIdeasProp === undefined || initialPostsProp === undefined) {
      fetchData(false);
    }
  }, [fetchData, initialIdeasProp, initialPostsProp]);

  // Filter by profileId for display (ideas/posts in state are full set for scope)
  const displayIdeas = profileId
    ? ideas.filter((i) => i.team_profile_id === profileId)
    : ideas;
  const displayPosts = profileId
    ? posts.filter((p) => p.team_profile_id === profileId)
    : posts;

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

  // Processing (kept for BulkSelectionBar prop — always false with optimistic updates)
  const [isProcessing] = useState(false);

  const refresh = useCallback(() => {
    if (initialIdeasProp !== undefined && initialPostsProp !== undefined) {
      onRefresh?.();
    } else {
      fetchData(true);
      onRefresh?.();
    }
  }, [onRefresh, initialIdeasProp, initialPostsProp, fetchData]);

  // ─── Column data ──────────────────────────────────────────

  const getColumnItems = useCallback((columnId: ColumnId): CardItem[] => {
    switch (columnId) {
      case 'ideas':
        return displayIdeas
          .slice()
          .sort((a, b) => (b.composite_score ?? 0) - (a.composite_score ?? 0))
          .map((idea) => ({ type: 'idea' as const, data: idea }));
      case 'written':
        return displayPosts
          .filter((p) => p.status === 'draft' || p.status === 'reviewing')
          .map((post) => ({ type: 'post' as const, data: post }));
      case 'review':
        return displayPosts
          .filter((p) => p.status === 'approved')
          .map((post) => ({ type: 'post' as const, data: post }));
      case 'scheduled':
        return displayPosts
          .filter((p) => p.status === 'scheduled' || p.status === 'published')
          .map((post) => ({ type: 'post' as const, data: post }));
      default:
        return [];
    }
  }, [displayIdeas, displayPosts]);

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
        const idea = item.data as ContentIdea;
        if (action === 'write') {
          setIdeas((prev) => prev.filter((i) => i.id !== idea.id));
          if (previewItem?.item.data.id === idea.id) setPreviewItem(null);
          writeFromIdea(idea.id)
            .then(() => fetchData(true))
            .catch(() => {
              setIdeas((prev) => [...prev, idea]);
              toast.error('Failed to write post');
            });
          return;
        } else if (action === 'archive') {
          setIdeas((prev) => prev.filter((i) => i.id !== idea.id));
          if (previewItem?.item.data.id === idea.id) setPreviewItem(null);
          updateIdeaStatus({ ideaId: idea.id, status: 'archived' }).catch(() => {
            setIdeas((prev) => [...prev, idea]);
            toast.error('Failed to archive idea');
          });
          return;
        } else if (action === 'delete') {
          setIdeas((prev) => prev.filter((i) => i.id !== idea.id));
          if (previewItem?.item.data.id === idea.id) setPreviewItem(null);
          deleteIdea(idea.id).catch(() => {
            setIdeas((prev) => [...prev, idea]);
            toast.error('Failed to delete idea');
          });
          return;
        }
      } else {
        const post = item.data as PipelinePost;
        if (action === 'edit') {
          setModalPost(post);
        } else if (action === 'publish') {
          const oldStatus = post.status;
          setPosts((prev) => prev.map((p) =>
            p.id === post.id ? { ...p, status: 'published' as PostStatus } : p
          ));
          publishPost(post.id)
            .catch((err) => {
              setPosts((prev) => prev.map((p) =>
                p.id === post.id ? { ...p, status: oldStatus } : p
              ));
              const msg = err instanceof Error ? err.message : 'Failed to publish';
              toast.error(msg.includes('Settings') ? msg : 'Failed to publish');
            });
          return;
        } else if (action === 'delete') {
          setPosts((prev) => prev.filter((p) => p.id !== post.id));
          if (previewItem?.item.data.id === post.id) setPreviewItem(null);
          deletePost(post.id).catch(() => {
            setPosts((prev) => [...prev, post]);
            toast.error('Failed to delete post');
          });
          return;
        }
      }
    } catch {
      // Silent
    }
  }, [fetchData, previewItem]);

  // ─── Bulk actions ─────────────────────────────────────────

  const handleBulkPrimary = useCallback(() => {
    if (selectedIds.size === 0) return;

    const ids = [...selectedIds];

    if (focusedColumn === 'ideas') {
      // Optimistic: remove all selected ideas immediately
      const removedIdeas = ideas.filter((i) => selectedIds.has(i.id));
      setIdeas((prev) => prev.filter((i) => !selectedIds.has(i.id)));
      if (previewItem && selectedIds.has(previewItem.item.data.id)) setPreviewItem(null);
      setSelectedIds(new Set());

      Promise.allSettled(ids.map((id) => writeFromIdea(id))).then((results) => {
        const failed = results.filter((r) => r.status === 'rejected');
        if (failed.length > 0) {
          toast.error(`Failed to write ${failed.length} post(s)`);
        }
        fetchData(true);
      }).catch(() => {
        setIdeas((prev) => [...prev, ...removedIdeas]);
        toast.error('Failed to write posts');
      });

    } else if (focusedColumn === 'written') {
      setPosts((prev) => prev.map((p) =>
        ids.includes(p.id) ? { ...p, status: 'approved' as PostStatus } : p
      ));
      setSelectedIds(new Set());

      Promise.allSettled(ids.map((id) => updatePost(id, { status: 'approved' }))).then((results) => {
        if (results.some((r) => r.status === 'rejected')) {
          fetchData(true);
          toast.error('Some posts failed to approve');
        }
      }).catch(() => { fetchData(true); toast.error('Failed to approve posts'); });

    } else if (focusedColumn === 'review') {
      setPosts((prev) => prev.map((p) =>
        ids.includes(p.id) ? { ...p, status: 'scheduled' as PostStatus } : p
      ));
      setSelectedIds(new Set());

      Promise.allSettled(ids.map((id) => schedulePost(id))).then((results) => {
        if (results.some((r) => r.status === 'rejected')) {
          fetchData(true);
          toast.error('Some posts failed to schedule');
        }
      }).catch(() => { fetchData(true); toast.error('Failed to schedule posts'); });

    } else if (focusedColumn === 'scheduled') {
      setPosts((prev) => prev.map((p) =>
        ids.includes(p.id) ? { ...p, status: 'approved' as PostStatus } : p
      ));
      setSelectedIds(new Set());

      Promise.allSettled(ids.map((id) => updatePost(id, { status: 'approved' }))).then((results) => {
        if (results.some((r) => r.status === 'rejected')) {
          fetchData(true);
          toast.error('Some posts failed to move');
        }
      }).catch(() => { fetchData(true); toast.error('Failed to move posts'); });
    }
  }, [focusedColumn, selectedIds, ideas, previewItem, fetchData]);

  const handleBulkDelete = useCallback(() => {
    if (selectedIds.size === 0) return;

    const ids = [...selectedIds];
    const ideaIds = new Set(ideas.map((i) => i.id));

    // Optimistic: remove all selected items from local state immediately
    const removedIdeas = ideas.filter((i) => selectedIds.has(i.id));
    const removedPosts = posts.filter((p) => selectedIds.has(p.id));
    setIdeas((prev) => prev.filter((i) => !selectedIds.has(i.id)));
    setPosts((prev) => prev.filter((p) => !selectedIds.has(p.id)));
    if (previewItem && selectedIds.has(previewItem.item.data.id)) setPreviewItem(null);
    setSelectedIds(new Set());

    Promise.allSettled(ids.map((id) => {
      if (ideaIds.has(id)) return deleteIdea(id);
      return deletePost(id);
    })).then((results) => {
      const hasFailure = results.some((r) => r.status === 'rejected');
      if (hasFailure) {
        fetchData(true);
        toast.error('Some items failed to delete');
      }
    }).catch(() => {
      setIdeas((prev) => [...prev, ...removedIdeas]);
      setPosts((prev) => [...prev, ...removedPosts]);
      toast.error('Failed to delete items');
    });
  }, [selectedIds, ideas, posts, previewItem, fetchData]);

  // ─── Detail pane callbacks ────────────────────────────────

  const handleWritePost = useCallback(async (ideaId: string) => {
    const removedIdea = ideas.find((i) => i.id === ideaId);
    setIdeas((prev) => prev.filter((i) => i.id !== ideaId));
    setPreviewItem(null);
    writeFromIdea(ideaId)
      .then(() => fetchData(true))
      .catch(() => {
        if (removedIdea) setIdeas((prev) => [...prev, removedIdea]);
        toast.error('Failed to write post');
      });
  }, [fetchData, ideas]);

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
      await polishPost(postId);
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
