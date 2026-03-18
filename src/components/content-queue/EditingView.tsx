'use client';

/**
 * EditingView.
 * Three-column layout for content editing with keyboard shortcuts.
 * Combines PostList (left) + PostEditor (center) + ContextPanel (right).
 * Never fetches data; receives everything via props.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Trash2 } from 'lucide-react';
import type { QueueTeam, QueueTeamWritingStyle } from '@/frontend/api/content-queue';
import { PostList } from './PostList';
import { PostEditor } from './PostEditor';
import { ContextPanel } from './ContextPanel';

// ─── Types ─────────────────────────────────────────────────────────────────

interface EditingViewProps {
  team: QueueTeam;
  writingStyle: QueueTeamWritingStyle | null;
  onBack: () => void;
  onMarkEdited: (postId: string) => Promise<void>;
  onDeletePost: (postId: string) => Promise<void>;
  onContentChange: (postId: string, content: string) => void;
}

// ─── Component ─────────────────────────────────────────────────────────────

export function EditingView({
  team,
  writingStyle,
  onBack,
  onMarkEdited,
  onDeletePost,
  onContentChange,
}: EditingViewProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [isContextCollapsed, setIsContextCollapsed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const posts = team.posts;
  const currentPost = posts[currentIndex] ?? null;

  // ─── Auto-advance helper ──────────────────────────────────────────

  const findNextUnedited = useCallback(
    (fromIndex: number): number => {
      for (let i = fromIndex + 1; i < posts.length; i++) {
        if (!posts[i].edited_at) return i;
      }
      // Wrap around
      for (let i = 0; i < fromIndex; i++) {
        if (!posts[i].edited_at) return i;
      }
      return fromIndex;
    },
    [posts]
  );

  // ─── Keyboard shortcuts ──────────────────────────────────────────

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Skip if user is typing in an editor or input
      const target = e.target as HTMLElement;
      const isEditing =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable ||
        target.closest('.ProseMirror') !== null;

      // Cmd+Enter works even when editing
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        if (currentPost) {
          onMarkEdited(currentPost.id).then(() => {
            const nextIdx = findNextUnedited(currentIndex);
            setCurrentIndex(nextIdx);
          });
        }
        return;
      }

      // Other shortcuts only work when NOT editing text
      if (isEditing) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        onBack();
        return;
      }

      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        if (currentPost && window.confirm('Delete this post?')) {
          const nextIdx =
            posts.length > 1
              ? currentIndex >= posts.length - 1
                ? currentIndex - 1
                : currentIndex
              : -1;
          onDeletePost(currentPost.id).then(() => {
            if (nextIdx < 0) onBack();
            else setCurrentIndex(nextIdx);
          });
        }
        return;
      }

      if (e.key === 'p') {
        e.preventDefault();
        setIsPreviewMode((prev) => !prev);
        return;
      }

      if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        setCurrentIndex((prev) => Math.max(0, prev - 1));
        return;
      }

      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        setCurrentIndex((prev) => Math.min(posts.length - 1, prev + 1));
        return;
      }
    }

    // Use capture phase so Cmd+Enter is intercepted before ProseMirror inserts a line break
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [
    currentIndex,
    currentPost,
    posts,
    posts.length,
    onBack,
    onMarkEdited,
    onDeletePost,
    findNextUnedited,
  ]);

  // ─── Handlers ────────────────────────────────────────────────────

  const handleContentChange = useCallback(
    (content: string) => {
      if (currentPost) {
        onContentChange(currentPost.id, content);
      }
    },
    [currentPost, onContentChange]
  );

  const handleDelete = useCallback(() => {
    if (!currentPost) return;
    if (!window.confirm('Delete this post?')) return;
    const nextIdx =
      posts.length > 1 ? (currentIndex >= posts.length - 1 ? currentIndex - 1 : currentIndex) : -1;
    onDeletePost(currentPost.id).then(() => {
      if (nextIdx < 0) onBack();
      else setCurrentIndex(nextIdx);
    });
  }, [currentPost, currentIndex, posts.length, onDeletePost, onBack]);

  const handleTogglePreview = useCallback(() => {
    setIsPreviewMode((prev) => !prev);
  }, []);

  const handleToggleContext = useCallback(() => {
    setIsContextCollapsed((prev) => !prev);
  }, []);

  if (!currentPost) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-zinc-400">No posts to edit</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* Left column — post navigation */}
      <PostList
        posts={posts}
        currentIndex={currentIndex}
        onSelect={setCurrentIndex}
        onBack={onBack}
      />

      {/* Center column — editor */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Team header */}
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-medium text-zinc-200">{team.profile_name}</h2>
            <p className="text-xs text-zinc-500">{team.profile_company}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500">
              {team.edited_count}/{team.total_count} edited
            </span>
            <kbd className="rounded border border-zinc-600 px-1.5 py-0.5 text-[10px] text-zinc-500">
              Cmd+Enter
            </kbd>
            <span className="text-[10px] text-zinc-600">mark edited</span>
            <button
              type="button"
              onClick={handleDelete}
              className="ml-1 rounded p-1 text-zinc-500 transition-colors hover:bg-red-900/30 hover:text-red-400"
              title="Delete post (Backspace)"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <PostEditor
          post={currentPost}
          authorName={team.profile_name}
          authorHeadline={team.profile_company}
          isPreviewMode={isPreviewMode}
          onTogglePreview={handleTogglePreview}
          onContentChange={handleContentChange}
          imageUrls={currentPost.image_urls ?? null}
        />
      </div>

      {/* Right column — context */}
      <ContextPanel
        writingStyle={writingStyle}
        currentPost={currentPost}
        isCollapsed={isContextCollapsed}
        onToggleCollapse={handleToggleContext}
      />
    </div>
  );
}
