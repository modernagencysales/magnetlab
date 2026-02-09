'use client';

import { useState, useEffect, useCallback } from 'react';
import { Mic, Radio, Clipboard, Loader2, Plus } from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import { StatusBadge } from './StatusBadge';
import { TranscriptPasteModal } from './TranscriptPasteModal';
import type { CallTranscript } from '@/lib/types/content-pipeline';

const SOURCE_ICONS: Record<string, typeof Mic> = {
  grain: Radio,
  fireflies: Mic,
  paste: Clipboard,
};

export function TranscriptsTab() {
  const [transcripts, setTranscripts] = useState<CallTranscript[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPasteModal, setShowPasteModal] = useState(false);

  const fetchTranscripts = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/content-pipeline/transcripts');
      const data = await response.json();
      setTranscripts(data.transcripts || []);
    } catch {
      // Silent failure
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTranscripts();
  }, [fetchTranscripts]);

  const totalTranscripts = transcripts.length;
  const ideasExtracted = transcripts.filter((t) => t.ideas_extracted_at).length;
  const knowledgeExtracted = transcripts.filter((t) => t.knowledge_extracted_at).length;

  const getProcessingStatus = (t: CallTranscript): string => {
    if (t.ideas_extracted_at && t.knowledge_extracted_at) return 'completed';
    if (t.ideas_extracted_at || t.knowledge_extracted_at) return 'processing';
    return 'pending';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div>
      {/* Stats */}
      <div className="mb-6 grid grid-cols-3 gap-4">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Total Transcripts</p>
          <p className="mt-1 text-2xl font-semibold">{totalTranscripts}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Ideas Extracted</p>
          <p className="mt-1 text-2xl font-semibold">{ideasExtracted}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Knowledge Entries</p>
          <p className="mt-1 text-2xl font-semibold">{knowledgeExtracted}</p>
        </div>
      </div>

      {/* Actions */}
      <div className="mb-4 flex justify-end">
        <button
          onClick={() => setShowPasteModal(true)}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Paste Transcript
        </button>
      </div>

      {/* Table */}
      {transcripts.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <Mic className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <p className="mt-4 text-muted-foreground">No transcripts yet</p>
          <p className="mt-1 text-sm text-muted-foreground/70">
            Paste a transcript or connect Grain/Fireflies
          </p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-muted/50">
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Title</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Source</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {transcripts.map((t) => {
                const SourceIcon = SOURCE_ICONS[t.source] || Clipboard;
                return (
                  <tr key={t.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium">
                      {t.title || 'Untitled'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <SourceIcon className="h-4 w-4" />
                        {t.source}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {t.transcript_type ? (
                        <span className={cn(
                          'rounded-full px-2 py-1 text-xs font-medium',
                          t.transcript_type === 'coaching'
                            ? 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300'
                            : 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                        )}>
                          {t.transcript_type}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {formatDate(t.call_date || t.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={getProcessingStatus(t)} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showPasteModal && (
        <TranscriptPasteModal
          onClose={() => setShowPasteModal(false)}
          onSuccess={fetchTranscripts}
        />
      )}
    </div>
  );
}
