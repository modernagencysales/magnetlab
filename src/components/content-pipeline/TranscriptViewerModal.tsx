'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  X, Loader2, Pencil, Check, Calendar, Clock, Users, FileText, RotateCcw,
} from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import { SpeakerMapEditor, type SpeakerMap } from './SpeakerMapEditor';

interface TranscriptDetail {
  id: string;
  title: string | null;
  source: string;
  call_date: string | null;
  duration_minutes: number | null;
  participants: string[] | null;
  raw_transcript: string;
  transcript_type: string | null;
  speaker_profile_id: string | null;
  speaker_name: string | null;
  speaker_map: Record<string, { role: string; company: string }> | null;
  knowledge_extracted_at: string | null;
  ideas_extracted_at: string | null;
  knowledge_count: number;
  ideas_count: number;
  created_at: string;
}

interface TranscriptViewerModalProps {
  transcriptId: string;
  onClose: () => void;
  onUpdated?: () => void;
}

// Assign consistent colors to speaker names
const SPEAKER_COLORS = [
  'text-blue-600 dark:text-blue-400',
  'text-emerald-600 dark:text-emerald-400',
  'text-purple-600 dark:text-purple-400',
  'text-orange-600 dark:text-orange-400',
  'text-pink-600 dark:text-pink-400',
  'text-cyan-600 dark:text-cyan-400',
];

export function TranscriptViewerModal({ transcriptId, onClose, onUpdated }: TranscriptViewerModalProps) {
  const [transcript, setTranscript] = useState<TranscriptDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reprocessing, setReprocessing] = useState(false);

  // Editable fields
  const [editingTitle, setEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editingDate, setEditingDate] = useState(false);
  const [editDate, setEditDate] = useState('');
  const [editingParticipants, setEditingParticipants] = useState(false);
  const [editParticipants, setEditParticipants] = useState('');

  const fetchTranscript = useCallback(async () => {
    try {
      const res = await fetch(`/api/content-pipeline/transcripts/${transcriptId}`);
      if (res.ok) {
        const data = await res.json();
        setTranscript(data.transcript);
      }
    } finally {
      setLoading(false);
    }
  }, [transcriptId]);

  useEffect(() => {
    fetchTranscript();
  }, [fetchTranscript]);

  const handleSaveField = async (field: string, value: unknown) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/content-pipeline/transcripts/${transcriptId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      });
      if (res.ok) {
        const data = await res.json();
        setTranscript((prev) => prev ? { ...prev, ...data.transcript } : prev);
        onUpdated?.();
      }
    } finally {
      setSaving(false);
      setEditingTitle(false);
      setEditingDate(false);
      setEditingParticipants(false);
    }
  };

  const handleReprocess = async () => {
    if (!confirm('This will delete all existing knowledge entries and content ideas for this transcript and re-process it. Continue?')) {
      return;
    }
    setReprocessing(true);
    try {
      const res = await fetch(`/api/content-pipeline/transcripts/${transcriptId}/reprocess`, {
        method: 'POST',
      });
      if (res.ok) {
        await fetchTranscript();
        onUpdated?.();
      }
    } finally {
      setReprocessing(false);
    }
  };

  // Parse transcript into speaker-colored segments
  const speakerColorMap = useMemo(() => {
    if (!transcript?.raw_transcript) return new Map<string, string>();
    const speakers = new Set<string>();
    const lines = transcript.raw_transcript.split('\n');
    for (const line of lines) {
      const match = line.match(/^([^:]+?):\s/);
      if (match && match[1].length < 50) {
        speakers.add(match[1].trim());
      }
    }
    const map = new Map<string, string>();
    let i = 0;
    for (const speaker of speakers) {
      map.set(speaker, SPEAKER_COLORS[i % SPEAKER_COLORS.length]);
      i++;
    }
    return map;
  }, [transcript?.raw_transcript]);

  const renderedTranscript = useMemo(() => {
    if (!transcript?.raw_transcript) return [];
    const paragraphs = transcript.raw_transcript.split('\n\n').filter(Boolean);
    return paragraphs.map((para, idx) => {
      const match = para.match(/^([^:]+?):\s(.+)/s);
      if (match && match[1].length < 50) {
        const speaker = match[1].trim();
        const text = match[2];
        const colorClass = speakerColorMap.get(speaker) || '';
        return { key: idx, speaker, text, colorClass };
      }
      return { key: idx, speaker: null, text: para, colorClass: '' };
    });
  }, [transcript?.raw_transcript, speakerColorMap]);

  const processingStatus = transcript
    ? transcript.knowledge_extracted_at && transcript.ideas_extracted_at
      ? 'completed'
      : !transcript.knowledge_extracted_at && !transcript.ideas_extracted_at
        ? 'pending'
        : 'processing'
    : 'pending';

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="rounded-lg bg-card p-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!transcript) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="rounded-lg bg-card p-8">
          <p className="text-muted-foreground">Transcript not found</p>
          <button onClick={onClose} className="mt-4 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex h-[90vh] w-full max-w-4xl flex-col rounded-xl border bg-card shadow-xl">
        {/* Header */}
        <div className="flex-shrink-0 border-b p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              {/* Title */}
              {editingTitle ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="flex-1 rounded-md border bg-background px-2 py-1 text-lg font-semibold"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveField('title', editTitle);
                      if (e.key === 'Escape') setEditingTitle(false);
                    }}
                  />
                  <button
                    onClick={() => handleSaveField('title', editTitle)}
                    disabled={saving}
                    className="rounded-md p-1 text-primary hover:bg-primary/10"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button onClick={() => setEditingTitle(false)} className="rounded-md p-1 text-muted-foreground hover:bg-muted">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <h2
                  className="group flex cursor-pointer items-center gap-2 text-lg font-semibold"
                  onClick={() => { setEditTitle(transcript.title || ''); setEditingTitle(true); }}
                >
                  {transcript.title || 'Untitled'}
                  <Pencil className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </h2>
              )}

              {/* Metadata row */}
              <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                {/* Source badge */}
                <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium">
                  {transcript.source}
                </span>

                {/* Date */}
                {editingDate ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="date"
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                      className="rounded-md border bg-background px-2 py-0.5 text-xs"
                      autoFocus
                    />
                    <button onClick={() => handleSaveField('call_date', editDate || null)} disabled={saving} className="p-0.5 text-primary">
                      <Check className="h-3 w-3" />
                    </button>
                    <button onClick={() => setEditingDate(false)} className="p-0.5 text-muted-foreground">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <button
                    className="flex items-center gap-1 hover:text-foreground transition-colors"
                    onClick={() => { setEditDate(transcript.call_date?.split('T')[0] || ''); setEditingDate(true); }}
                  >
                    <Calendar className="h-3.5 w-3.5" />
                    {transcript.call_date ? formatDate(transcript.call_date) : 'No date'}
                  </button>
                )}

                {/* Duration */}
                {transcript.duration_minutes && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {transcript.duration_minutes}min
                  </span>
                )}

                {/* Type */}
                {transcript.transcript_type && (
                  <span className={cn(
                    'rounded-full px-2 py-0.5 text-xs font-medium',
                    transcript.transcript_type === 'coaching'
                      ? 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300'
                      : 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                  )}>
                    {transcript.transcript_type}
                  </span>
                )}

                {/* Counts */}
                <span className="flex items-center gap-1" title="Knowledge entries">
                  <FileText className="h-3.5 w-3.5" />
                  {transcript.knowledge_count} entries, {transcript.ideas_count} ideas
                </span>
              </div>

              {/* Participants */}
              <div className="mt-2">
                {editingParticipants ? (
                  <div className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5 text-muted-foreground" />
                    <input
                      type="text"
                      value={editParticipants}
                      onChange={(e) => setEditParticipants(e.target.value)}
                      className="flex-1 rounded-md border bg-background px-2 py-0.5 text-xs"
                      placeholder="email1@example.com, email2@example.com"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const parts = editParticipants.split(',').map(p => p.trim()).filter(Boolean);
                          handleSaveField('participants', parts.length > 0 ? parts : null);
                        }
                        if (e.key === 'Escape') setEditingParticipants(false);
                      }}
                    />
                    <button
                      onClick={() => {
                        const parts = editParticipants.split(',').map(p => p.trim()).filter(Boolean);
                        handleSaveField('participants', parts.length > 0 ? parts : null);
                      }}
                      disabled={saving}
                      className="p-0.5 text-primary"
                    >
                      <Check className="h-3 w-3" />
                    </button>
                    <button onClick={() => setEditingParticipants(false)} className="p-0.5 text-muted-foreground">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  transcript.participants && transcript.participants.length > 0 && (
                    <button
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() => { setEditParticipants(transcript.participants?.join(', ') || ''); setEditingParticipants(true); }}
                    >
                      <Users className="h-3.5 w-3.5" />
                      {transcript.participants.join(', ')}
                    </button>
                  )
                )}
              </div>
            </div>

            {/* Close button */}
            <button
              onClick={onClose}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Speaker Map Editor */}
        {transcript.raw_transcript && (
          <SpeakerMapEditor
            rawTranscript={transcript.raw_transcript}
            speakerMap={transcript.speaker_map}
            onSave={async (speakerMap: SpeakerMap) => {
              await handleSaveField('speaker_map', speakerMap);
            }}
          />
        )}

        {/* Transcript body */}
        <div className="flex-1 overflow-y-auto p-6">
          {renderedTranscript.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No transcript content</p>
          ) : (
            <div className="space-y-3">
              {renderedTranscript.map((segment) => (
                <div key={segment.key}>
                  {segment.speaker ? (
                    <div>
                      <span className={cn('text-sm font-semibold', segment.colorClass)}>
                        {segment.speaker}:
                      </span>{' '}
                      <span className="text-sm leading-relaxed">{segment.text}</span>
                    </div>
                  ) : (
                    <p className="text-sm leading-relaxed">{segment.text}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {processingStatus === 'completed' && (
                <span className="flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-green-700 dark:bg-green-950 dark:text-green-400">
                  Processed
                </span>
              )}
              {processingStatus === 'processing' && (
                <span className="flex items-center gap-1 text-yellow-600">
                  <Loader2 className="h-3 w-3 animate-spin" /> Processing...
                </span>
              )}
              {processingStatus === 'pending' && (
                <span className="text-muted-foreground">Not yet processed</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleReprocess}
                disabled={reprocessing || processingStatus === 'processing'}
                className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50 transition-colors"
              >
                {reprocessing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RotateCcw className="h-3.5 w-3.5" />
                )}
                Re-process
              </button>
              <button
                onClick={onClose}
                className="rounded-md bg-primary px-4 py-1.5 text-sm text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
