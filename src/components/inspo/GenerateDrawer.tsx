'use client';

/**
 * GenerateDrawer. Compose post from primitives (creative + exploit + optional voice/knowledge).
 * Two states: compose (pick inputs) and preview (show generated post with actions).
 * Never imports from Next.js HTTP layer.
 */

import { useState, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  Button,
  Badge,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Label,
  Textarea,
} from '@magnetlab/magnetui';
import { Zap, RotateCcw, Send, Pencil, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useExploits } from '@/frontend/hooks/api/useExploits';
import { useGeneratePost } from '@/frontend/hooks/api/useGenerate';
import { updatePost } from '@/frontend/api/content-pipeline/posts';
import { getStyles } from '@/frontend/api/content-pipeline/styles';
import type { Creative } from '@/lib/types/exploits';
import type { PipelinePost, WritingStyle } from '@/lib/types/content-pipeline';

// ─── Types ────────────────────────────────────────────────────────────────────

interface GenerateDrawerProps {
  creative: Creative | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerated?: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function GenerateDrawer({ creative, open, onOpenChange, onGenerated }: GenerateDrawerProps) {
  // ─── State ──────────────────────────────────────────────
  const [exploitId, setExploitId] = useState<string>('');
  const [hook, setHook] = useState<string>('');
  const [styleId, setStyleId] = useState<string>('');
  const [instructions, setInstructions] = useState<string>('');
  const [generatedPost, setGeneratedPost] = useState<PipelinePost | null>(null);
  const [hookScore, setHookScore] = useState<number | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [sending, setSending] = useState(false);
  const [styles, setStyles] = useState<WritingStyle[]>([]);

  // ─── Data ───────────────────────────────────────────────
  const { exploits } = useExploits({ with_stats: true });
  const { mutate: generate, isPending: generating } = useGeneratePost((result) => {
    setGeneratedPost(result.post);
    setHookScore(result.hook_score ?? null);
  });

  // ─── Load styles ─────────────────────────────────────────────────────
  useEffect(() => {
    if (open) {
      getStyles()
        .then((res) => {
          setStyles((res.styles as WritingStyle[]) ?? []);
        })
        .catch(() => {
          // Non-critical -- drawer works without styles
        });
    }
  }, [open]);

  // ─── Reset on open ─────────────────────────────────────
  useEffect(() => {
    if (creative && open) {
      setExploitId(creative.suggested_exploit_id ?? '');
      setHook('');
      setStyleId('');
      setInstructions('');
      setGeneratedPost(null);
      setHookScore(null);
      setIsEditing(false);
    }
  }, [creative, open]);

  // ─── Handlers ──────────────────────────────────────────
  const handleGenerate = async () => {
    if (!exploitId) {
      toast.error('Select an exploit format');
      return;
    }
    try {
      await generate({
        creative_id: creative?.id,
        exploit_id: exploitId,
        hook: hook || undefined,
        style_id: styleId || undefined,
        instructions: instructions || undefined,
      });
    } catch {
      toast.error('Failed to generate post');
    }
  };

  const handleSendToQueue = async () => {
    if (!generatedPost) return;
    setSending(true);
    try {
      const content = isEditing ? editContent : undefined;
      await updatePost(generatedPost.id, {
        status: 'draft',
        ...(content ? { draft_content: content } : {}),
      });
      toast.success('Post sent to content queue');
      onOpenChange(false);
      onGenerated?.();
    } catch {
      toast.error('Failed to send to queue');
    } finally {
      setSending(false);
    }
  };

  if (!creative) return null;

  const postContent = generatedPost?.draft_content || generatedPost?.final_content || '';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[480px] sm:max-w-[480px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{generatedPost ? 'Generated Post' : 'Generate Post'}</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {!generatedPost ? (
            <>
              {/* ─── Source Creative ──────────────────────────── */}
              <div>
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Source Creative
                </Label>
                <div className="mt-1.5 p-3 rounded-lg bg-muted/50 border border-border">
                  <p className="text-sm text-foreground line-clamp-3">{creative.content_text}</p>
                  <div className="flex gap-1.5 mt-2">
                    <Badge variant="gray" className="text-xs">
                      {creative.source_platform}
                    </Badge>
                    {creative.source_author && (
                      <Badge variant="gray" className="text-xs">
                        {creative.source_author}
                      </Badge>
                    )}
                    <Badge variant="gray" className="text-xs bg-emerald-500/10 text-emerald-500">
                      Score: {creative.commentary_worthy_score}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* ─── Exploit picker ──────────────────────────── */}
              <div>
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Exploit Format <span className="text-red-500">*</span>
                </Label>
                <Select value={exploitId} onValueChange={setExploitId}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Select exploit format..." />
                  </SelectTrigger>
                  <SelectContent>
                    {exploits.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        <div>
                          <span>{e.name}</span>
                          <span className="text-muted-foreground ml-2 text-xs">
                            {e.times_used}× used
                            {e.avg_impressions
                              ? ` · ${(e.avg_impressions / 1000).toFixed(1)}k impr`
                              : ''}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {creative.suggested_exploit_id && exploitId === creative.suggested_exploit_id && (
                  <p className="text-xs text-muted-foreground mt-1">
                    AI suggested based on creative type
                  </p>
                )}
              </div>

              {/* ─── Hook chips ───────────────────────────────── */}
              {creative.suggested_hooks.length > 0 && (
                <div>
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                    Hook <span className="text-xs font-normal">(optional)</span>
                  </Label>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {creative.suggested_hooks.map((h, i) => (
                      <button
                        key={i}
                        type="button"
                        className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                          hook === h
                            ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                            : 'border-border bg-muted/50 text-muted-foreground hover:text-foreground'
                        }`}
                        onClick={() => setHook(hook === h ? '' : h)}
                      >
                        {h}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ─── Writing Style ───────────────────────────── */}
              <div>
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Writing Style <span className="text-xs font-normal">(optional)</span>
                </Label>
                <Select value={styleId} onValueChange={setStyleId}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Default voice" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Default voice</SelectItem>
                    {styles.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* TODO: Knowledge Context multi-select picker — deferred to v2
                  API supports knowledge_ids in GeneratePostInput */}

              {/* ─── Instructions ─────────────────────────────── */}
              <div>
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Instructions <span className="text-xs font-normal">(optional)</span>
                </Label>
                <Textarea
                  className="mt-1.5"
                  rows={2}
                  placeholder="Extra instructions for AI..."
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                />
              </div>

              {/* ─── Generate button ──────────────────────────── */}
              <Button
                className="w-full"
                onClick={handleGenerate}
                disabled={generating || !exploitId}
              >
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4 mr-1.5" />
                    Generate Post
                  </>
                )}
              </Button>
            </>
          ) : (
            <>
              {/* ─── Preview ─────────────────────────────────── */}
              <div className="p-4 rounded-lg bg-muted/50 border border-border">
                {isEditing ? (
                  <Textarea
                    className="min-h-[200px] bg-transparent border-0 p-0 text-sm"
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                  />
                ) : (
                  <p className="text-sm text-foreground whitespace-pre-line leading-relaxed">
                    {postContent}
                  </p>
                )}
              </div>

              {/* ─── Metadata ────────────────────────────────── */}
              <div className="flex gap-2 flex-wrap">
                {hookScore != null && (
                  <Badge variant="gray" className="bg-emerald-500/10 text-emerald-500">
                    Hook Score: {hookScore.toFixed(1)}
                  </Badge>
                )}
                <Badge variant="gray">
                  {exploits.find((e) => e.id === exploitId)?.name ?? 'Unknown exploit'}
                </Badge>
                <Badge variant="gray">{postContent.split(/\s+/).length} words</Badge>
              </div>

              {/* ─── Actions ─────────────────────────────────── */}
              <div className="flex gap-2">
                <Button
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                  onClick={handleSendToQueue}
                  disabled={sending}
                >
                  <Send className="h-4 w-4 mr-1.5" />
                  {sending ? 'Sending...' : 'Send to Queue'}
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setGeneratedPost(null);
                    setHookScore(null);
                  }}
                >
                  <RotateCcw className="h-4 w-4 mr-1.5" />
                  Regenerate
                </Button>
              </div>
              {!isEditing ? (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setEditContent(postContent);
                    setIsEditing(true);
                  }}
                >
                  <Pencil className="h-4 w-4 mr-1.5" />
                  Edit & Send to Queue
                </Button>
              ) : null}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
