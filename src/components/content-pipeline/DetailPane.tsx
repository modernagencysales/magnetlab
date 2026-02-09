'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { X, Loader2, Check, AlertCircle, Sparkles, Copy, Calendar, ExternalLink, PenLine, ChevronDown, Linkedin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PillarBadge } from './PillarBadge';
import { StatusBadge } from './StatusBadge';
import type { ContentIdea, PipelinePost } from '@/lib/types/content-pipeline';

type DetailItem =
  | { type: 'idea'; data: ContentIdea }
  | { type: 'post'; data: PipelinePost; idea?: ContentIdea };

interface DetailPaneProps {
  item: DetailItem;
  onClose: () => void;
  onWritePost: (ideaId: string) => void;
  onContentUpdate: (postId: string, content: string) => void;
  onOpenModal: (post: PipelinePost) => void;
  onRefresh: () => void;
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const CONTENT_TYPE_LABELS: Record<string, string> = {
  story: 'Story',
  insight: 'Insight',
  tip: 'Tip',
  framework: 'Framework',
  case_study: 'Case Study',
  question: 'Question',
  listicle: 'Listicle',
  contrarian: 'Contrarian',
};

export function DetailPane({ item, onClose, onWritePost, onContentUpdate, onOpenModal, onRefresh }: DetailPaneProps) {
  if (item.type === 'idea') {
    return <IdeaDetail idea={item.data} onClose={onClose} onWritePost={onWritePost} />;
  }
  return (
    <PostDetail
      post={item.data}
      idea={item.idea}
      onClose={onClose}
      onContentUpdate={onContentUpdate}
      onOpenModal={onOpenModal}
      onRefresh={onRefresh}
    />
  );
}

// ─── Idea Detail ──────────────────────────────────────────

function IdeaDetail({
  idea,
  onClose,
  onWritePost,
}: {
  idea: ContentIdea;
  onClose: () => void;
  onWritePost: (id: string) => void;
}) {
  const [writing, setWriting] = useState(false);

  const handleWrite = async () => {
    setWriting(true);
    onWritePost(idea.id);
  };

  return (
    <div className="flex h-full flex-col border-l bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <StatusBadge status={idea.status} />
          <PillarBadge pillar={idea.content_pillar} />
        </div>
        <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-secondary transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <h3 className="text-base font-semibold leading-snug">{idea.title}</h3>

        {idea.content_type && (
          <span className="inline-block rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
            {CONTENT_TYPE_LABELS[idea.content_type] || idea.content_type}
          </span>
        )}

        {idea.core_insight && (
          <div>
            <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">Core Insight</p>
            <p className="text-sm leading-relaxed">{idea.core_insight}</p>
          </div>
        )}

        {idea.why_post_worthy && (
          <div className="rounded-lg bg-violet-50 p-3 dark:bg-violet-950/30">
            <p className="mb-1 text-xs font-medium uppercase text-violet-600 dark:text-violet-400">Why Post-Worthy</p>
            <p className="text-sm italic leading-relaxed text-violet-700 dark:text-violet-300">{idea.why_post_worthy}</p>
          </div>
        )}

        {idea.full_context && (
          <div>
            <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">Full Context</p>
            <p className="text-sm leading-relaxed text-muted-foreground">{idea.full_context}</p>
          </div>
        )}

        {idea.source_quote && (
          <div className="border-l-2 border-muted pl-3">
            <p className="text-sm italic text-muted-foreground">&ldquo;{idea.source_quote}&rdquo;</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t px-4 py-3">
        <button
          onClick={handleWrite}
          disabled={writing}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          {writing ? <Loader2 className="h-4 w-4 animate-spin" /> : <PenLine className="h-4 w-4" />}
          Write Post
        </button>
      </div>
    </div>
  );
}

// ─── Post Detail ──────────────────────────────────────────

function PostDetail({
  post,
  idea,
  onClose,
  onContentUpdate,
  onOpenModal,
  onRefresh,
}: {
  post: PipelinePost;
  idea?: ContentIdea;
  onClose: () => void;
  onContentUpdate: (postId: string, content: string) => void;
  onOpenModal: (post: PipelinePost) => void;
  onRefresh: () => void;
}) {
  const content = post.draft_content || post.final_content || '';
  const [editContent, setEditContent] = useState(content);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [copied, setCopied] = useState(false);
  const [polishing, setPolishing] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset when post changes
  useEffect(() => {
    setEditContent(post.draft_content || post.final_content || '');
    setSaveState('idle');
  }, [post.id, post.draft_content, post.final_content]);

  const doSave = useCallback(async (text: string) => {
    setSaveState('saving');
    try {
      const response = await fetch(`/api/content-pipeline/posts/${post.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draft_content: text, final_content: null }),
      });
      if (response.ok) {
        setSaveState('saved');
        onContentUpdate(post.id, text);
        if (savedTimeout.current) clearTimeout(savedTimeout.current);
        savedTimeout.current = setTimeout(() => setSaveState('idle'), 2000);
      } else {
        setSaveState('error');
      }
    } catch {
      setSaveState('error');
    }
  }, [post.id, onContentUpdate]);

  const handleChange = (value: string) => {
    setEditContent(value);
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => doSave(value), 1500);
  };

  const handleBlur = () => {
    if (editContent !== content) {
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
      doSave(editContent);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(editContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePolish = async () => {
    setPolishing(true);
    try {
      const response = await fetch(`/api/content-pipeline/posts/${post.id}/polish`, {
        method: 'POST',
      });
      if (response.ok) onRefresh();
    } catch {
      // Silent
    } finally {
      setPolishing(false);
    }
  };

  const handleSchedule = async () => {
    try {
      const response = await fetch('/api/content-pipeline/posts/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: post.id }),
      });
      if (response.ok) onRefresh();
    } catch {
      // Silent
    }
  };

  const handlePublish = async () => {
    setPublishing(true);
    setPublishError(null);
    try {
      const response = await fetch(`/api/content-pipeline/posts/${post.id}/publish`, {
        method: 'POST',
      });
      const data = await response.json();
      if (response.ok) {
        onRefresh();
      } else {
        setPublishError(data.error || 'Failed to publish');
      }
    } catch {
      setPublishError('Network error. Please try again.');
    } finally {
      setPublishing(false);
    }
  };

  const canPublish = editContent.trim().length > 0 &&
    ['draft', 'reviewing', 'approved'].includes(post.status);

  return (
    <div className="flex h-full flex-col border-l bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <StatusBadge status={post.status} />
          {post.hook_score !== null && post.hook_score !== undefined && (
            <span className={cn(
              'rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
              post.hook_score >= 8 ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300' :
              post.hook_score >= 5 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300' :
              'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
            )}>
              Hook {post.hook_score}/10
            </span>
          )}
          {/* Save indicator */}
          <SaveIndicator state={saveState} />
        </div>
        <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-secondary transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Editable textarea — fills available space */}
      <div className="flex-1 p-4">
        <textarea
          value={editContent}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={handleBlur}
          className="h-full w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder="Write your post content..."
        />
      </div>

      {/* Idea context accordion */}
      {idea && (
        <details className="border-t px-4 py-2">
          <summary className="flex cursor-pointer items-center gap-1 text-xs font-medium text-muted-foreground">
            <ChevronDown className="h-3 w-3" />
            Original Idea Context
          </summary>
          <div className="mt-2 space-y-2 pb-2">
            <p className="text-xs font-medium">{idea.title}</p>
            {idea.core_insight && <p className="text-xs text-muted-foreground">{idea.core_insight}</p>}
          </div>
        </details>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-2 border-t px-4 py-3">
        <button
          onClick={handlePolish}
          disabled={polishing}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50 transition-colors"
        >
          {polishing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          Polish
        </button>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
        <button
          onClick={handleSchedule}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
        >
          <Calendar className="h-3.5 w-3.5" />
          Schedule
        </button>
        {canPublish && (
          <button
            onClick={handlePublish}
            disabled={publishing}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {publishing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Linkedin className="h-3.5 w-3.5" />}
            Publish
          </button>
        )}
        <div className="flex-1" />
        <button
          onClick={() => onOpenModal(post)}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Full Editor
        </button>
      </div>
      {/* Publish Error */}
      {publishError && (
        <div className="mx-4 mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-800 dark:bg-amber-950/50">
          <p className="text-xs text-amber-800 dark:text-amber-200">{publishError}</p>
          {publishError.includes('Settings') && (
            <a
              href="/settings"
              className="mt-0.5 inline-block text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
            >
              Go to Settings
            </a>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Save Indicator ───────────────────────────────────────

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === 'idle') return null;

  return (
    <span className={cn(
      'flex items-center gap-1 text-[10px] font-medium',
      state === 'saving' && 'text-muted-foreground',
      state === 'saved' && 'text-green-600 dark:text-green-400',
      state === 'error' && 'text-red-600 dark:text-red-400',
    )}>
      {state === 'saving' && <Loader2 className="h-3 w-3 animate-spin" />}
      {state === 'saved' && <Check className="h-3 w-3" />}
      {state === 'error' && <AlertCircle className="h-3 w-3" />}
      {state === 'saving' ? 'Saving...' : state === 'saved' ? 'Saved' : 'Save failed'}
    </span>
  );
}
