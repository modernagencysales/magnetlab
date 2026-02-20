'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Mic, Radio, Clipboard, Upload, Video, BookOpen, Loader2, Plus, Trash2, Link2, RotateCcw } from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import { StatusBadge } from './StatusBadge';
import { TranscriptPasteModal } from './TranscriptPasteModal';
import { ConnectRecorderGuide } from './ConnectRecorderGuide';
import { TranscriptViewerModal } from './TranscriptViewerModal';
import type { CallTranscript } from '@/lib/types/content-pipeline';

const SOURCE_ICONS: Record<string, typeof Mic> = {
  grain: Radio,
  fireflies: Mic,
  fathom: Video,
  paste: Clipboard,
  upload: Upload,
  manual: BookOpen,
  attio: Mic,
};

interface TranscriptsTabProps {
  profileId?: string | null;
}

export function TranscriptsTab({ profileId }: TranscriptsTabProps) {
  const [transcripts, setTranscripts] = useState<CallTranscript[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showConnectGuide, setShowConnectGuide] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [reprocessingId, setReprocessingId] = useState<string | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const fetchTranscripts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (profileId) params.append('speaker_profile_id', profileId);
      const response = await fetch(`/api/content-pipeline/transcripts?${params}`);
      const data = await response.json();
      setTranscripts(data.transcripts || []);
    } catch {
      // Silent failure
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    fetchTranscripts();
  }, [fetchTranscripts]);

  // Poll for processing updates when any transcripts are still processing
  useEffect(() => {
    const hasProcessing = transcripts.some(
      (t) => !t.ideas_extracted_at || !t.knowledge_extracted_at
    );
    if (hasProcessing && !pollingRef.current) {
      pollingRef.current = setInterval(() => {
        fetchTranscripts();
      }, 5000);
    } else if (!hasProcessing && pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [transcripts, fetchTranscripts]);

  const handleReprocess = async (id: string) => {
    if (!confirm('This will delete existing knowledge entries and ideas for this transcript and re-process it. Continue?')) return;
    setReprocessingId(id);
    try {
      const response = await fetch(`/api/content-pipeline/transcripts/${id}/reprocess`, {
        method: 'POST',
      });
      if (response.ok) {
        fetchTranscripts();
      }
    } catch {
      // Silent failure
    } finally {
      setReprocessingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const response = await fetch(`/api/content-pipeline/transcripts?id=${id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        setTranscripts((prev) => prev.filter((t) => t.id !== id));
      }
    } catch {
      // Silent failure
    } finally {
      setDeletingId(null);
    }
  };

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
      <div className="mb-4 flex justify-end gap-2">
        <button
          onClick={() => setShowConnectGuide(true)}
          className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
        >
          <Link2 className="h-4 w-4" />
          Connect Recorder
        </button>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Transcript
        </button>
      </div>

      {/* Table */}
      {transcripts.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <Mic className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <p className="mt-4 text-base font-medium">No transcripts yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Get started by connecting your meeting recorder or pasting a transcript
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <button
              onClick={() => setShowConnectGuide(true)}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Link2 className="h-4 w-4" />
              Connect Recorder
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
            >
              <Plus className="h-4 w-4" />
              Paste or Upload
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-muted/50">
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Title</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Speaker</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Source</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Status</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase sr-only">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {transcripts.map((t) => {
                const SourceIcon = SOURCE_ICONS[t.source] || Clipboard;
                return (
                  <tr key={t.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium">
                      <button
                        onClick={() => setViewingId(t.id)}
                        className="text-left hover:text-primary hover:underline transition-colors"
                      >
                        {t.title || 'Untitled'}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      {(() => {
                        const ext = t as CallTranscript & { speaker_name?: string | null; speaker_map?: Record<string, { role: string; company?: string | null }> | null };
                        const speakerName = ext.speaker_name;
                        // Fall back to host name from speaker_map
                        const hostFromMap = !speakerName && ext.speaker_map
                          ? Object.entries(ext.speaker_map).find(([, v]) => v.role === 'host')?.[0]
                          : null;
                        const displayName = speakerName || hostFromMap;
                        return displayName ? (
                          <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                            {displayName}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">&mdash;</span>
                        );
                      })()}
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
                        <span className="text-sm text-muted-foreground">&mdash;</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {formatDate(t.call_date || t.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      {getProcessingStatus(t) === 'processing' ? (
                        <span className="flex items-center gap-1.5 text-xs font-medium text-yellow-600 dark:text-yellow-400">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Processing...
                        </span>
                      ) : (
                        <StatusBadge status={getProcessingStatus(t)} />
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleReprocess(t.id)}
                          disabled={reprocessingId === t.id || getProcessingStatus(t) === 'processing'}
                          className="rounded-lg p-1.5 text-muted-foreground hover:bg-blue-100 hover:text-blue-600 dark:hover:bg-blue-950 dark:hover:text-blue-400 disabled:opacity-50 transition-colors"
                          title="Re-process transcript"
                        >
                          {reprocessingId === t.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RotateCcw className="h-4 w-4" />
                          )}
                        </button>
                        <button
                          onClick={() => handleDelete(t.id)}
                          disabled={deletingId === t.id}
                          className="rounded-lg p-1.5 text-muted-foreground hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-950 dark:hover:text-red-400 disabled:opacity-50 transition-colors"
                          title="Delete transcript"
                        >
                          {deletingId === t.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showAddModal && (
        <TranscriptPasteModal
          onClose={() => setShowAddModal(false)}
          onSuccess={fetchTranscripts}
        />
      )}

      {showConnectGuide && (
        <ConnectRecorderGuide
          onClose={() => setShowConnectGuide(false)}
        />
      )}

      {viewingId && (
        <TranscriptViewerModal
          transcriptId={viewingId}
          onClose={() => setViewingId(null)}
          onUpdated={fetchTranscripts}
        />
      )}
    </div>
  );
}
