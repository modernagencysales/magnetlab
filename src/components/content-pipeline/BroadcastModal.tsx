'use client';

import { useState } from 'react';
import { X, Loader2, Radio, Check, Linkedin, AlertCircle } from 'lucide-react';
import {
  Button,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Label,
  Badge,
} from '@magnetlab/magnetui';
import { cn } from '@/lib/utils';
import type { PipelinePost, TeamProfileWithConnection } from '@/lib/types/content-pipeline';
import * as broadcastApi from '@/frontend/api/content-pipeline/broadcast';

interface BroadcastModalProps {
  post: PipelinePost;
  profiles: TeamProfileWithConnection[];
  onClose: () => void;
  onBroadcast: () => void;
}

export function BroadcastModal({ post, profiles, onClose, onBroadcast }: BroadcastModalProps) {
  // Pre-select all connected profiles except the source author
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    for (const p of profiles) {
      if (p.linkedin_connected && p.id !== post.team_profile_id) {
        initial.add(p.id);
      }
    }
    return initial;
  });
  const [staggerDays, setStaggerDays] = useState(2);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sourceContent = post.final_content || post.draft_content || '';
  const previewLines = sourceContent.split('\n').slice(0, 4).join('\n');
  const isTruncated = sourceContent.split('\n').length > 4;

  const toggleProfile = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSubmit = async () => {
    if (selectedIds.size === 0) return;

    setSubmitting(true);
    setError(null);

    try {
      await broadcastApi.triggerBroadcast({
        source_post_id: post.id,
        target_profile_ids: Array.from(selectedIds),
        stagger_days: staggerDays,
      });
      onBroadcast();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative mx-4 w-full max-w-lg rounded-xl border bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div className="flex items-center gap-2">
            <Radio className="h-5 w-5 text-primary" />
            <h2 className="text-base font-semibold">Broadcast to Team</h2>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onClose} title="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-5 px-5 py-4">
          {/* Source post preview */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Source Post
            </label>
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="whitespace-pre-wrap text-xs leading-relaxed text-foreground/80">
                {previewLines}
                {isTruncated && <span className="text-muted-foreground">...</span>}
              </p>
            </div>
          </div>

          {/* Team member selection */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Team Members ({selectedIds.size} selected)
            </label>
            <div className="max-h-52 space-y-1.5 overflow-y-auto rounded-lg border p-2">
              {profiles.map((profile) => {
                const isSource = profile.id === post.team_profile_id;
                const isSelected = selectedIds.has(profile.id);

                return (
                  <button
                    key={profile.id}
                    onClick={() => !isSource && toggleProfile(profile.id)}
                    disabled={isSource}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors',
                      isSource
                        ? 'cursor-not-allowed opacity-50'
                        : isSelected
                          ? 'bg-primary/10 border border-primary/30'
                          : 'hover:bg-muted/50 border border-transparent'
                    )}
                  >
                    {/* Checkbox */}
                    <div
                      className={cn(
                        'flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border transition-colors',
                        isSelected
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-muted-foreground/30'
                      )}
                    >
                      {isSelected && <Check className="h-3 w-3" />}
                    </div>

                    {/* Profile info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">{profile.full_name}</span>
                        {isSource && (
                          <span className="flex-shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                            Source
                          </span>
                        )}
                      </div>
                      {profile.title && (
                        <p className="truncate text-xs text-muted-foreground">{profile.title}</p>
                      )}
                    </div>

                    {/* LinkedIn connection badge */}
                    <div className="flex-shrink-0">
                      {profile.linkedin_connected ? (
                        <Badge variant="blue" className="gap-1">
                          <Linkedin className="h-3 w-3" />
                          Connected
                        </Badge>
                      ) : (
                        <Badge variant="gray" className="gap-1">
                          <Linkedin className="h-3 w-3" />
                          Not connected
                        </Badge>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Stagger config */}
          <div>
            <Label className="mb-1.5 text-xs text-muted-foreground">Stagger Over</Label>
            <Select value={String(staggerDays)} onValueChange={(v) => setStaggerDays(Number(v))}>
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 day</SelectItem>
                <SelectItem value="2">2 days</SelectItem>
                <SelectItem value="3">3 days</SelectItem>
                <SelectItem value="4">4 days</SelectItem>
                <SelectItem value="5">5 days</SelectItem>
              </SelectContent>
            </Select>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Posts will be spread across {staggerDays} day{staggerDays > 1 ? 's' : ''}, starting
              tomorrow.
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t px-5 py-4">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={selectedIds.size === 0 || submitting}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Broadcasting...
              </>
            ) : (
              <>
                <Radio className="h-4 w-4" />
                Broadcast to {selectedIds.size} member{selectedIds.size !== 1 ? 's' : ''}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
