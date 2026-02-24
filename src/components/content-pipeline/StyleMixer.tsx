'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Loader2, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import type { WritingStyle, StyleProfile, TeamProfile, TeamVoiceProfile } from '@/lib/types/content-pipeline';

interface StyleMixerProps {
  sourceStyle: WritingStyle;
  onClose: () => void;
}

type TraitKey = 'tone' | 'hook_patterns' | 'cta_patterns' | 'signature_phrases' | 'banned_phrases' | 'sentence_length' | 'formatting';

interface TraitRow {
  key: TraitKey;
  label: string;
  preview: string;
  isEmpty: boolean;
}

const SENTENCE_LENGTH_MAP: Record<string, string> = {
  short: '100-200 words',
  medium: '200-400 words',
  long: '400-600 words',
  varied: '200-500 words',
};

function formatFormattingPreview(f: StyleProfile['formatting']): string {
  const parts: string[] = [];
  if (f.uses_emojis) parts.push('emojis');
  if (f.uses_lists) parts.push('lists');
  if (f.uses_bold) parts.push('bold');
  if (f.uses_line_breaks) parts.push('line breaks');
  parts.push(`~${f.avg_paragraphs} paragraphs`);
  return parts.join(', ');
}

function buildTraitRows(profile: StyleProfile): TraitRow[] {
  const rows: TraitRow[] = [];

  // Tone (scalar)
  if (profile.tone) {
    rows.push({
      key: 'tone',
      label: 'Tone',
      preview: profile.tone,
      isEmpty: false,
    });
  }

  // Hook Patterns (array)
  if (profile.hook_patterns && profile.hook_patterns.length > 0) {
    rows.push({
      key: 'hook_patterns',
      label: 'Hook Patterns',
      preview: profile.hook_patterns.slice(0, 2).join(', ') + (profile.hook_patterns.length > 2 ? ` +${profile.hook_patterns.length - 2}` : ''),
      isEmpty: false,
    });
  }

  // CTA Patterns (array)
  if (profile.cta_patterns && profile.cta_patterns.length > 0) {
    rows.push({
      key: 'cta_patterns',
      label: 'CTA Patterns',
      preview: profile.cta_patterns.slice(0, 2).join(', ') + (profile.cta_patterns.length > 2 ? ` +${profile.cta_patterns.length - 2}` : ''),
      isEmpty: false,
    });
  }

  // Signature Phrases (array)
  if (profile.signature_phrases && profile.signature_phrases.length > 0) {
    rows.push({
      key: 'signature_phrases',
      label: 'Signature Phrases',
      preview: profile.signature_phrases.slice(0, 2).map(p => `"${p}"`).join(', ') + (profile.signature_phrases.length > 2 ? ` +${profile.signature_phrases.length - 2}` : ''),
      isEmpty: false,
    });
  }

  // Banned Phrases (array)
  if (profile.banned_phrases && profile.banned_phrases.length > 0) {
    rows.push({
      key: 'banned_phrases',
      label: 'Banned Phrases',
      preview: profile.banned_phrases.slice(0, 2).join(', ') + (profile.banned_phrases.length > 2 ? ` +${profile.banned_phrases.length - 2}` : ''),
      isEmpty: false,
    });
  }

  // Sentence Length (scalar)
  if (profile.sentence_length) {
    rows.push({
      key: 'sentence_length',
      label: 'Sentence Length',
      preview: `${profile.sentence_length} (${SENTENCE_LENGTH_MAP[profile.sentence_length] || profile.sentence_length})`,
      isEmpty: false,
    });
  }

  // Formatting (special)
  const f = profile.formatting;
  if (f) {
    const hasAny = f.uses_emojis || f.uses_lists || f.uses_bold || f.uses_line_breaks || f.avg_paragraphs > 0;
    if (hasAny) {
      rows.push({
        key: 'formatting',
        label: 'Formatting',
        preview: formatFormattingPreview(f),
        isEmpty: false,
      });
    }
  }

  return rows;
}

function buildFormattingEntries(f: StyleProfile['formatting']): string[] {
  const entries: string[] = [];
  if (f.uses_emojis) {
    entries.push('Use emojis sparingly');
  } else {
    entries.push('Avoid using emojis');
  }
  if (f.uses_lists) entries.push('Use lists when appropriate');
  if (f.avg_paragraphs > 0) entries.push(`Target ~${f.avg_paragraphs} paragraphs per post`);
  if (f.uses_bold) entries.push('Use bold for emphasis');
  if (f.uses_line_breaks) entries.push('Use line breaks between paragraphs');
  return entries;
}

function unionArrays(existing: string[] | undefined, incoming: string[]): string[] {
  const set = new Set(existing || []);
  for (const item of incoming) {
    set.add(item);
  }
  return Array.from(set);
}

/** Merge selected traits into existing voice profile, respecting protection rules */
function mergeTraits(
  existing: TeamVoiceProfile,
  source: StyleProfile,
  selectedTraits: Set<TraitKey>
): TeamVoiceProfile {
  // Deep clone to avoid mutations
  const merged: TeamVoiceProfile = JSON.parse(JSON.stringify(existing));

  if (selectedTraits.has('tone')) {
    merged.tone = source.tone;
  }

  if (selectedTraits.has('hook_patterns')) {
    merged.hook_patterns = unionArrays(merged.hook_patterns, source.hook_patterns);
  }

  if (selectedTraits.has('cta_patterns')) {
    // cta_style is a free-text string; append new patterns as newline-separated entries
    // to avoid comma-splitting which breaks patterns containing commas
    const existingPatterns = merged.cta_style
      ? merged.cta_style.split('\n').map(s => s.trim()).filter(Boolean)
      : [];
    const merged_patterns = unionArrays(existingPatterns, source.cta_patterns);
    merged.cta_style = merged_patterns.join('\n');
  }

  if (selectedTraits.has('signature_phrases')) {
    merged.signature_phrases = unionArrays(merged.signature_phrases, source.signature_phrases);
  }

  if (selectedTraits.has('banned_phrases')) {
    merged.banned_phrases = unionArrays(merged.banned_phrases, source.banned_phrases);
  }

  if (selectedTraits.has('sentence_length')) {
    if (!merged.content_length) {
      merged.content_length = { linkedin: '', email: '' };
    }
    merged.content_length.linkedin = SENTENCE_LENGTH_MAP[source.sentence_length] || source.sentence_length;
  }

  if (selectedTraits.has('formatting')) {
    const newEntries = buildFormattingEntries(source.formatting);
    if (!merged.structure_patterns) {
      merged.structure_patterns = { linkedin: [], email: [] };
    }
    // Append only (never replace structure_patterns)
    const existingLinkedin = merged.structure_patterns.linkedin || [];
    const existingSet = new Set(existingLinkedin);
    for (const entry of newEntries) {
      if (!existingSet.has(entry)) {
        existingLinkedin.push(entry);
      }
    }
    merged.structure_patterns.linkedin = existingLinkedin;
  }

  return merged;
}

export function StyleMixer({ sourceStyle, onClose }: StyleMixerProps) {
  const [profiles, setProfiles] = useState<TeamProfile[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [selectedTraits, setSelectedTraits] = useState<Set<TraitKey>>(new Set());
  const [applying, setApplying] = useState(false);
  const [showExamples, setShowExamples] = useState(false);

  const profile = sourceStyle.style_profile as StyleProfile;
  const traitRows = buildTraitRows(profile);

  const selectedProfile = profiles.find(p => p.id === selectedProfileId) || null;

  // Fetch team profiles on mount
  const fetchProfiles = useCallback(async () => {
    try {
      const res = await fetch('/api/teams/profiles');
      const data = await res.json();
      setProfiles(data.profiles || []);
      // Auto-select first profile if available
      if (data.profiles?.length > 0) {
        setSelectedProfileId(data.profiles[0].id);
      }
    } catch {
      toast.error('Failed to load team profiles');
    } finally {
      setLoadingProfiles(false);
    }
  }, []);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  // Close on escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const toggleTrait = (key: TraitKey) => {
    setSelectedTraits(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedTraits(new Set(traitRows.map(r => r.key)));
  };

  const clearAll = () => {
    setSelectedTraits(new Set());
  };

  const handleApply = async () => {
    if (!selectedProfile || selectedTraits.size === 0) return;

    setApplying(true);
    try {
      const existingVoice = (selectedProfile.voice_profile || {}) as TeamVoiceProfile;
      const mergedVoice = mergeTraits(existingVoice, profile, selectedTraits);

      const res = await fetch(`/api/teams/profiles/${selectedProfile.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voice_profile: mergedVoice }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to update profile');
      }

      toast.success(`Applied ${selectedTraits.size} trait${selectedTraits.size !== 1 ? 's' : ''} to ${selectedProfile.full_name}`);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to apply traits');
    } finally {
      setApplying(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Style Mixer"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative flex max-h-[85vh] w-full max-w-lg flex-col rounded-xl border bg-card shadow-lg">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <h2 className="text-base font-semibold">Apply Style Traits</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              From: {sourceStyle.name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Profile selector */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Target team member
            </label>
            {loadingProfiles ? (
              <div className="flex items-center gap-2 py-2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Loading profiles...</span>
              </div>
            ) : profiles.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No team profiles found. Create a team profile first.
              </p>
            ) : (
              <select
                value={selectedProfileId || ''}
                onChange={(e) => setSelectedProfileId(e.target.value || null)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name}{p.title ? ` - ${p.title}` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Trait checkboxes */}
          {traitRows.length > 0 && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Traits to apply</span>
                <div className="flex gap-2">
                  <button
                    onClick={selectAll}
                    className="text-xs text-primary hover:underline"
                  >
                    Select all
                  </button>
                  <button
                    onClick={clearAll}
                    className="text-xs text-muted-foreground hover:underline"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                {traitRows.map((row) => (
                  <label
                    key={row.key}
                    className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border p-2.5 hover:bg-accent/50 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedTraits.has(row.key)}
                      onChange={() => toggleTrait(row.key)}
                      className="mt-0.5 h-3.5 w-3.5 rounded border-border text-primary focus:ring-primary"
                    />
                    <div className="min-w-0 flex-1">
                      <span className="text-sm font-medium">{row.label}</span>
                      <p className="mt-0.5 text-xs text-muted-foreground truncate">
                        {row.preview}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Example posts (collapsible) */}
          {sourceStyle.example_posts && sourceStyle.example_posts.length > 0 && (
            <div className="border-t pt-3">
              <button
                onClick={() => setShowExamples(!showExamples)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {showExamples ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                {showExamples ? 'Hide' : 'Show'} example posts ({sourceStyle.example_posts.length})
              </button>
              {showExamples && (
                <div className="mt-2 space-y-2">
                  {sourceStyle.example_posts.map((post, i) => (
                    <div key={i} className="rounded-lg bg-secondary/50 p-3">
                      <p className="text-xs text-muted-foreground whitespace-pre-line line-clamp-6">
                        {post}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t px-5 py-3">
          <button
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            disabled={applying || !selectedProfile || selectedTraits.size === 0}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {applying ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
            Apply {selectedTraits.size} trait{selectedTraits.size !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
