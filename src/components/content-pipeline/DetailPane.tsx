'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  X,
  Loader2,
  Check,
  AlertCircle,
  Sparkles,
  Copy,
  Calendar,
  Maximize2,
  PenLine,
  ChevronDown,
  Linkedin,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, Badge, Textarea } from '@magnetlab/magnetui';
import { PillarBadge } from './PillarBadge';
import { StatusBadge } from './StatusBadge';
import type { ContentIdea, PipelinePost, ReviewData } from '@/lib/types/content-pipeline';

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

export function DetailPane({
  item,
  onClose,
  onWritePost,
  onContentUpdate,
  onOpenModal,
  onRefresh,
}: DetailPaneProps) {
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
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <h3 className="text-base font-semibold leading-snug">{idea.title}</h3>

        {idea.content_type && (
          <Badge variant="gray">
            {CONTENT_TYPE_LABELS[idea.content_type] || idea.content_type}
          </Badge>
        )}

        {idea.core_insight && (
          <div>
            <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">Core Insight</p>
            <p className="text-sm leading-relaxed">{idea.core_insight}</p>
          </div>
        )}

        {idea.why_post_worthy && (
          <div className="rounded-lg bg-violet-50 p-3 dark:bg-violet-950/30">
            <p className="mb-1 text-xs font-medium uppercase text-violet-600 dark:text-violet-400">
              Why Post-Worthy
            </p>
            <p className="text-sm italic leading-relaxed text-violet-700 dark:text-violet-300">
              {idea.why_post_worthy}
            </p>
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
            <p className="text-sm italic text-muted-foreground">
              &ldquo;{idea.source_quote}&rdquo;
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t px-4 py-3">
        <Button
          onClick={handleWrite}
          disabled={writing}
          className="w-full bg-green-600 hover:bg-green-700 text-white"
        >
          {writing ? (
            <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
          ) : (
            <PenLine className="h-4 w-4 mr-1.5" />
          )}
          Write Post
        </Button>
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

  const doSave = useCallback(
    async (text: string) => {
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
    },
    [post.id, onContentUpdate]
  );

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

  const canPublish =
    editContent.trim().length > 0 && ['draft', 'reviewing', 'approved'].includes(post.status);

  return (
    <div className="flex h-full flex-col border-l bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <StatusBadge status={post.status} />
          {post.hook_score !== null && post.hook_score !== undefined && (
            <Badge
              variant={post.hook_score >= 8 ? 'green' : post.hook_score >= 5 ? 'orange' : 'red'}
            >
              Hook {post.hook_score}/10
            </Badge>
          )}
          {post.review_data &&
            (() => {
              const rd = post.review_data as ReviewData;
              const label =
                rd.category === 'excellent'
                  ? 'Excellent'
                  : rd.category === 'good_with_edits'
                    ? 'Needs Edits'
                    : 'Rewrite';
              return (
                <Badge
                  variant={
                    rd.category === 'excellent'
                      ? 'green'
                      : rd.category === 'good_with_edits'
                        ? 'orange'
                        : 'red'
                  }
                >
                  {label} {rd.score}/10
                </Badge>
              );
            })()}
          {/* Save indicator */}
          <SaveIndicator state={saveState} />
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Editable textarea — fills available space */}
      <div className="flex-1 p-4">
        <Textarea
          value={editContent}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={handleBlur}
          className="h-full resize-none leading-relaxed"
          placeholder="Write your post content..."
        />
      </div>

      {/* Review notes accordion */}
      {post.review_data &&
        (() => {
          const rd = post.review_data as ReviewData;
          const hasNotes = rd.notes && rd.notes.length > 0;
          const hasFlags = rd.flags && rd.flags.length > 0;
          if (!hasNotes && !hasFlags) return null;
          return (
            <div className="border-t px-4 py-2 space-y-1">
              {hasNotes && (
                <details>
                  <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                    {rd.notes.length} edit suggestion{rd.notes.length !== 1 ? 's' : ''}
                  </summary>
                  <ul className="mt-1 space-y-1 pl-4">
                    {rd.notes.map((note: string, i: number) => (
                      <li key={i} className="text-xs text-muted-foreground">
                        &bull; {note}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
              {hasFlags && (
                <details>
                  <summary className="cursor-pointer text-xs text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300">
                    {rd.flags.length} consistency flag{rd.flags.length !== 1 ? 's' : ''}
                  </summary>
                  <ul className="mt-1 space-y-1 pl-4">
                    {rd.flags.map((flag: string, i: number) => (
                      <li key={i} className="text-xs text-orange-600 dark:text-orange-400">
                        &bull; {flag}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          );
        })()}

      {/* Idea context accordion */}
      {idea && (
        <details className="border-t px-4 py-2">
          <summary className="flex cursor-pointer items-center gap-1 text-xs font-medium text-muted-foreground">
            <ChevronDown className="h-3 w-3" />
            Original Idea Context
          </summary>
          <div className="mt-2 space-y-2 pb-2">
            <p className="text-xs font-medium">{idea.title}</p>
            {idea.core_insight && (
              <p className="text-xs text-muted-foreground">{idea.core_insight}</p>
            )}
          </div>
        </details>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-2 border-t px-4 py-3">
        <Button variant="outline" size="sm" onClick={handlePolish} disabled={polishing}>
          {polishing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
          ) : (
            <Sparkles className="h-3.5 w-3.5 mr-1" />
          )}
          Polish
        </Button>
        <Button variant="outline" size="sm" onClick={handleCopy}>
          {copied ? (
            <Check className="h-3.5 w-3.5 text-green-500 mr-1" />
          ) : (
            <Copy className="h-3.5 w-3.5 mr-1" />
          )}
          {copied ? 'Copied' : 'Copy'}
        </Button>
        <Button variant="outline" size="sm" onClick={handleSchedule}>
          <Calendar className="h-3.5 w-3.5 mr-1" />
          Schedule
        </Button>
        {canPublish && (
          <Button
            size="sm"
            onClick={handlePublish}
            disabled={publishing}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {publishing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
            ) : (
              <Linkedin className="h-3.5 w-3.5 mr-1" />
            )}
            Publish
          </Button>
        )}
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={() => onOpenModal(post)}>
          <Maximize2 className="h-3.5 w-3.5 mr-1" />
          Full Editor
        </Button>
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

export function SaveIndicator({ state }: { state: SaveState }) {
  if (state === 'idle') return null;

  return (
    <span
      className={cn(
        'flex items-center gap-1 text-[10px] font-medium',
        state === 'saving' && 'text-muted-foreground',
        state === 'saved' && 'text-green-600 dark:text-green-400',
        state === 'error' && 'text-destructive'
      )}
    >
      {state === 'saving' && <Loader2 className="h-3 w-3 animate-spin" />}
      {state === 'saved' && <Check className="h-3 w-3" />}
      {state === 'error' && <AlertCircle className="h-3 w-3" />}
      {state === 'saving' ? 'Saving...' : state === 'saved' ? 'Saved' : 'Save failed'}
    </span>
  );
}
