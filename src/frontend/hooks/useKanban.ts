'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import type { PipelinePost, ContentIdea, PostStatus } from '@/lib/types/content-pipeline';
import type { CardItem } from '@/components/content-pipeline/KanbanCard';
import type { ColumnId } from '@/components/content-pipeline/KanbanColumn';
import {
  getIdeas,
  writeFromIdea,
  updateIdeaStatus,
  deleteIdea,
} from '@/frontend/api/content-pipeline/ideas';
import {
  getPosts,
  updatePost,
  deletePost,
  schedulePost,
  publishPost,
  polishPost,
} from '@/frontend/api/content-pipeline/posts';

export interface KanbanBoardProps {
  onRefresh?: () => void;
  profileId?: string | null;
  initialIdeas?: ContentIdea[];
  initialPosts?: PipelinePost[];
}

export interface KanbanState {
  loading: boolean;
  focusedColumn: ColumnId;
  selectedIds: Set<string>;
  previewItem: { item: CardItem; idea?: ContentIdea } | null;
  modalPost: PipelinePost | null;
  polishing: boolean;
  isProcessing: boolean;
  setPreviewItem: React.Dispatch<
    React.SetStateAction<{ item: CardItem; idea?: ContentIdea } | null>
  >;
  setModalPost: React.Dispatch<React.SetStateAction<PipelinePost | null>>;
  getColumnItems: (columnId: ColumnId) => CardItem[];
  refresh: () => void;
  handleColumnSwitch: (col: ColumnId) => void;
  handleToggleSelect: (id: string, e: React.MouseEvent) => void;
  selectAll: () => void;
  clearSelection: () => void;
  handleCardClick: (item: CardItem) => void;
  handleCardAction: (item: CardItem, action: string) => Promise<void>;
  handleBulkPrimary: () => void;
  handleBulkDelete: () => void;
  handleWritePost: (ideaId: string) => Promise<void>;
  handleContentUpdate: (postId: string, content: string) => void;
  handleOpenModal: (post: PipelinePost) => void;
  handlePolish: (postId: string) => Promise<void>;
}

export function useKanban({
  onRefresh,
  profileId,
  initialIdeas: initialIdeasProp,
  initialPosts: initialPostsProp,
}: KanbanBoardProps): KanbanState {
  const [ideas, setIdeas] = useState<ContentIdea[]>(initialIdeasProp ?? []);
  const [posts, setPosts] = useState<PipelinePost[]>(initialPostsProp ?? []);
  const [loading, setLoading] = useState(!initialIdeasProp && !initialPostsProp);

  useEffect(() => {
    if (initialIdeasProp !== undefined && initialPostsProp !== undefined) {
      setIdeas(initialIdeasProp);
      setPosts(initialPostsProp);
    }
  }, [initialIdeasProp, initialPostsProp]);

  const fetchData = useCallback(
    async (silent = false) => {
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
    },
    [profileId]
  );

  useEffect(() => {
    if (initialIdeasProp === undefined || initialPostsProp === undefined) {
      fetchData(false);
    }
  }, [fetchData, initialIdeasProp, initialPostsProp]);

  const displayIdeas = profileId ? ideas.filter((i) => i.team_profile_id === profileId) : ideas;
  const displayPosts = profileId ? posts.filter((p) => p.team_profile_id === profileId) : posts;

  const [focusedColumn, setFocusedColumn] = useState<ColumnId>('ideas');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const lastSelectedId = useRef<string | null>(null);
  const [previewItem, setPreviewItem] = useState<{ item: CardItem; idea?: ContentIdea } | null>(
    null
  );
  const [modalPost, setModalPost] = useState<PipelinePost | null>(null);
  const [polishing, setPolishing] = useState(false);
  const [isProcessing] = useState(false);

  const refresh = useCallback(() => {
    if (initialIdeasProp !== undefined && initialPostsProp !== undefined) {
      onRefresh?.();
    } else {
      fetchData(true);
      onRefresh?.();
    }
  }, [onRefresh, initialIdeasProp, initialPostsProp, fetchData]);

  const getColumnItems = useCallback(
    (columnId: ColumnId): CardItem[] => {
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
    },
    [displayIdeas, displayPosts]
  );

  const handleColumnSwitch = useCallback((col: ColumnId) => {
    setFocusedColumn(col);
    setSelectedIds(new Set());
    lastSelectedId.current = null;
    setPreviewItem(null);
  }, []);

  const handleToggleSelect = useCallback(
    (id: string, e: React.MouseEvent) => {
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
    },
    [focusedColumn, getColumnItems]
  );

  const selectAll = useCallback(() => {
    const items = getColumnItems(focusedColumn);
    setSelectedIds(new Set(items.map((i) => i.data.id)));
  }, [focusedColumn, getColumnItems]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    lastSelectedId.current = null;
  }, []);

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

  const handleCardClick = useCallback(
    (item: CardItem) => {
      if (previewItem && previewItem.item.data.id === item.data.id) {
        setPreviewItem(null);
      } else {
        const idea =
          item.type === 'post' && item.data.idea_id
            ? ideas.find((i) => i.id === item.data.idea_id)
            : undefined;
        setPreviewItem({ item, idea });
      }
    },
    [previewItem, ideas]
  );

  const handleCardAction = useCallback(
    async (item: CardItem, action: string) => {
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
            setPosts((prev) =>
              prev.map((p) => (p.id === post.id ? { ...p, status: 'published' as PostStatus } : p))
            );
            publishPost(post.id).catch((err) => {
              setPosts((prev) =>
                prev.map((p) => (p.id === post.id ? { ...p, status: oldStatus } : p))
              );
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
    },
    [fetchData, previewItem]
  );

  const handleBulkPrimary = useCallback(() => {
    if (selectedIds.size === 0) return;

    const ids = [...selectedIds];

    if (focusedColumn === 'ideas') {
      const removedIdeas = ideas.filter((i) => selectedIds.has(i.id));
      setIdeas((prev) => prev.filter((i) => !selectedIds.has(i.id)));
      if (previewItem && selectedIds.has(previewItem.item.data.id)) setPreviewItem(null);
      setSelectedIds(new Set());

      Promise.allSettled(ids.map((id) => writeFromIdea(id)))
        .then((results) => {
          const failed = results.filter((r) => r.status === 'rejected');
          if (failed.length > 0) toast.error(`Failed to write ${failed.length} post(s)`);
          fetchData(true);
        })
        .catch(() => {
          setIdeas((prev) => [...prev, ...removedIdeas]);
          toast.error('Failed to write posts');
        });
    } else if (focusedColumn === 'written') {
      setPosts((prev) =>
        prev.map((p) => (ids.includes(p.id) ? { ...p, status: 'approved' as PostStatus } : p))
      );
      setSelectedIds(new Set());

      Promise.allSettled(ids.map((id) => updatePost(id, { status: 'approved' })))
        .then((results) => {
          if (results.some((r) => r.status === 'rejected')) {
            fetchData(true);
            toast.error('Some posts failed to approve');
          }
        })
        .catch(() => {
          fetchData(true);
          toast.error('Failed to approve posts');
        });
    } else if (focusedColumn === 'review') {
      setPosts((prev) =>
        prev.map((p) => (ids.includes(p.id) ? { ...p, status: 'scheduled' as PostStatus } : p))
      );
      setSelectedIds(new Set());

      Promise.allSettled(ids.map((id) => schedulePost(id)))
        .then((results) => {
          if (results.some((r) => r.status === 'rejected')) {
            fetchData(true);
            toast.error('Some posts failed to schedule');
          }
        })
        .catch(() => {
          fetchData(true);
          toast.error('Failed to schedule posts');
        });
    } else if (focusedColumn === 'scheduled') {
      setPosts((prev) =>
        prev.map((p) => (ids.includes(p.id) ? { ...p, status: 'approved' as PostStatus } : p))
      );
      setSelectedIds(new Set());

      Promise.allSettled(ids.map((id) => updatePost(id, { status: 'approved' })))
        .then((results) => {
          if (results.some((r) => r.status === 'rejected')) {
            fetchData(true);
            toast.error('Some posts failed to move');
          }
        })
        .catch(() => {
          fetchData(true);
          toast.error('Failed to move posts');
        });
    }
  }, [focusedColumn, selectedIds, ideas, previewItem, fetchData]);

  const handleBulkDelete = useCallback(() => {
    if (selectedIds.size === 0) return;

    const ids = [...selectedIds];
    const ideaIds = new Set(ideas.map((i) => i.id));

    const removedIdeas = ideas.filter((i) => selectedIds.has(i.id));
    const removedPosts = posts.filter((p) => selectedIds.has(p.id));
    setIdeas((prev) => prev.filter((i) => !selectedIds.has(i.id)));
    setPosts((prev) => prev.filter((p) => !selectedIds.has(p.id)));
    if (previewItem && selectedIds.has(previewItem.item.data.id)) setPreviewItem(null);
    setSelectedIds(new Set());

    Promise.allSettled(
      ids.map((id) => {
        if (ideaIds.has(id)) return deleteIdea(id);
        return deletePost(id);
      })
    )
      .then((results) => {
        if (results.some((r) => r.status === 'rejected')) {
          fetchData(true);
          toast.error('Some items failed to delete');
        }
      })
      .catch(() => {
        setIdeas((prev) => [...prev, ...removedIdeas]);
        setPosts((prev) => [...prev, ...removedPosts]);
        toast.error('Failed to delete items');
      });
  }, [selectedIds, ideas, posts, previewItem, fetchData]);

  const handleWritePost = useCallback(
    async (ideaId: string) => {
      const removedIdea = ideas.find((i) => i.id === ideaId);
      setIdeas((prev) => prev.filter((i) => i.id !== ideaId));
      setPreviewItem(null);
      writeFromIdea(ideaId)
        .then(() => fetchData(true))
        .catch(() => {
          if (removedIdea) setIdeas((prev) => [...prev, removedIdea]);
          toast.error('Failed to write post');
        });
    },
    [fetchData, ideas]
  );

  const handleContentUpdate = useCallback((postId: string, content: string) => {
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, draft_content: content, final_content: null } : p))
    );
  }, []);

  const handleOpenModal = useCallback((post: PipelinePost) => {
    setModalPost(post);
  }, []);

  const handlePolish = useCallback(
    async (postId: string) => {
      setPolishing(true);
      try {
        await polishPost(postId);
        refresh();
      } catch {
        // Silent
      } finally {
        setPolishing(false);
      }
    },
    [refresh]
  );

  return {
    loading,
    focusedColumn,
    selectedIds,
    previewItem,
    modalPost,
    polishing,
    isProcessing,
    setPreviewItem,
    setModalPost,
    getColumnItems,
    refresh,
    handleColumnSwitch,
    handleToggleSelect,
    selectAll,
    clearSelection,
    handleCardClick,
    handleCardAction,
    handleBulkPrimary,
    handleBulkDelete,
    handleWritePost,
    handleContentUpdate,
    handleOpenModal,
    handlePolish,
  };
}
