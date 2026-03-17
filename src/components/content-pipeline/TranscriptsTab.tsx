'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Mic,
  Radio,
  Clipboard,
  Upload,
  Video,
  BookOpen,
  Loader2,
  Plus,
  Trash2,
  Link2,
  RotateCcw,
  Pencil,
} from 'lucide-react';
import { Button, Badge } from '@magnetlab/magnetui';
import { formatDate } from '@/lib/utils';
import { StatusBadge } from './StatusBadge';
import { TranscriptPasteModal } from './TranscriptPasteModal';
import { ConnectRecorderGuide } from './ConnectRecorderGuide';
import { TranscriptViewerModal } from './TranscriptViewerModal';
import type { CallTranscript } from '@/lib/types/content-pipeline';
import * as transcriptsApi from '@/frontend/api/content-pipeline/transcripts';

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

  const fetchTranscripts = useCallback(
    async (showLoader = false) => {
      if (showLoader) setLoading(true);
      try {
        const data = await transcriptsApi.listTranscripts({
          speaker_profile_id: profileId ?? undefined,
        });
        setTranscripts((data.transcripts || []) as CallTranscript[]);
      } catch {
        // Silent failure
      } finally {
        if (showLoader) setLoading(false);
      }
    },
    [profileId]
  );

  useEffect(() => {
    fetchTranscripts(true);
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
    if (
      !confirm(
        'This will delete existing knowledge entries and ideas for this transcript and re-process it. Continue?'
      )
    )
      return;
    setReprocessingId(id);
    try {
      await transcriptsApi.reprocessTranscript(id);
      fetchTranscripts();
    } catch {
      // Silent failure
    } finally {
      setReprocessingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await transcriptsApi.deleteTranscript(id);
      setTranscripts((prev) => prev.filter((t) => t.id !== id));
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
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Total Transcripts</p>
          <p className="mt-1 text-2xl font-semibold">{totalTranscripts}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Ideas Extracted</p>
          <p className="mt-1 text-2xl font-semibold">{ideasExtracted}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Knowledge Entries</p>
          <p className="mt-1 text-2xl font-semibold">{knowledgeExtracted}</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <Button variant="outline" size="sm" onClick={() => setShowConnectGuide(true)}>
          <Link2 className="mr-1.5 h-4 w-4" />
          Connect Recorder
        </Button>
        <Button size="sm" onClick={() => setShowAddModal(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          Add Transcript
        </Button>
      </div>

      {/* Table */}
      {transcripts.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <Mic className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <p className="mt-4 text-base font-medium">No transcripts yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Get started by connecting your meeting recorder or pasting a transcript
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Button size="sm" onClick={() => setShowConnectGuide(true)}>
              <Link2 className="mr-1.5 h-4 w-4" />
              Connect Recorder
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowAddModal(true)}>
              <Plus className="mr-1.5 h-4 w-4" />
              Paste or Upload
            </Button>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-left text-xs font-medium uppercase text-muted-foreground">
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Speaker</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right sr-only">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {transcripts.map((t) => {
                const SourceIcon = SOURCE_ICONS[t.source] || Clipboard;
                return (
                  <tr key={t.id} className="transition-colors hover:bg-muted/50">
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
                        const ext = t as CallTranscript & {
                          speaker_name?: string | null;
                          speaker_map?: Record<
                            string,
                            { role: string; company?: string | null }
                          > | null;
                        };
                        const speakerName = ext.speaker_name;
                        // Fall back to host name from speaker_map
                        const hostFromMap =
                          !speakerName && ext.speaker_map
                            ? Object.entries(ext.speaker_map).find(
                                ([, v]) => v.role === 'host'
                              )?.[0]
                            : null;
                        const displayName = speakerName || hostFromMap;
                        return displayName ? (
                          <Badge variant="purple">{displayName}</Badge>
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
                        <Badge variant={t.transcript_type === 'coaching' ? 'purple' : 'blue'}>
                          {t.transcript_type}
                        </Badge>
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
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setViewingId(t.id)}
                          title="Edit transcript"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleReprocess(t.id)}
                          disabled={
                            reprocessingId === t.id || getProcessingStatus(t) === 'processing'
                          }
                          title="Re-process transcript"
                        >
                          {reprocessingId === t.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RotateCcw className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleDelete(t.id)}
                          disabled={deletingId === t.id}
                          title="Delete transcript"
                        >
                          {deletingId === t.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4 text-destructive" />
                          )}
                        </Button>
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
        <TranscriptPasteModal onClose={() => setShowAddModal(false)} onSuccess={fetchTranscripts} />
      )}

      {showConnectGuide && <ConnectRecorderGuide onClose={() => setShowConnectGuide(false)} />}

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
