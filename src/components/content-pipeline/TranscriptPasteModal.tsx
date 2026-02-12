'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { X, Loader2, Check, Upload, FileText, Clipboard } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TeamProfile } from '@/lib/types/content-pipeline';

interface TranscriptPasteModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

type Mode = 'paste' | 'upload';

export function TranscriptPasteModal({ onClose, onSuccess }: TranscriptPasteModalProps) {
  const [mode, setMode] = useState<Mode>('paste');
  const [title, setTitle] = useState('');
  const [transcript, setTranscript] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [teamProfiles, setTeamProfiles] = useState<TeamProfile[]>([]);
  const [speakerProfileId, setSpeakerProfileId] = useState<string>('');

  useEffect(() => {
    fetch('/api/teams/profiles')
      .then(r => r.json())
      .then(data => {
        if (data.profiles?.length > 1) {
          setTeamProfiles(data.profiles);
        }
      })
      .catch(() => {});
  }, []);

  const ACCEPTED_TYPES = '.txt,.vtt,.srt';

  const handleFile = useCallback((f: File) => {
    const name = f.name.toLowerCase();
    if (!name.endsWith('.txt') && !name.endsWith('.vtt') && !name.endsWith('.srt')) {
      setError('Only .txt, .vtt, and .srt files are supported');
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      setError('File too large (max 10MB)');
      return;
    }
    setFile(f);
    setError('');
    if (!title) setTitle(f.name.replace(/\.(txt|vtt|srt)$/i, ''));
  }, [title]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const handleSubmit = async () => {
    setError('');

    if (mode === 'paste') {
      if (transcript.trim().length < 100) {
        setError('Transcript must be at least 100 characters');
        return;
      }
      setSubmitting(true);
      try {
        const response = await fetch('/api/content-pipeline/transcripts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: title.trim() || undefined,
            transcript: transcript.trim(),
            speakerProfileId: speakerProfileId || undefined,
          }),
        });
        if (!response.ok) {
          const data = await response.json();
          setError(data.error || 'Failed to save transcript');
          return;
        }
        setSuccess(true);
        setTimeout(() => { onSuccess(); onClose(); }, 1500);
      } catch {
        setError('Failed to save transcript');
      } finally {
        setSubmitting(false);
      }
    } else {
      if (!file) {
        setError('Please select a file');
        return;
      }
      setSubmitting(true);
      try {
        const formData = new FormData();
        formData.append('file', file);
        if (title.trim()) formData.append('title', title.trim());

        const response = await fetch('/api/content-pipeline/transcripts/upload', {
          method: 'POST',
          body: formData,
        });
        if (!response.ok) {
          const data = await response.json();
          setError(data.error || 'Failed to upload transcript');
          return;
        }
        setSuccess(true);
        setTimeout(() => { onSuccess(); onClose(); }, 1500);
      } catch {
        setError('Failed to upload transcript');
      } finally {
        setSubmitting(false);
      }
    }
  };

  const canSubmit = mode === 'paste'
    ? transcript.trim().length >= 100
    : !!file;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl bg-background p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Add Transcript</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-secondary">
            <X className="h-4 w-4" />
          </button>
        </div>

        {success ? (
          <div className="py-8 text-center">
            <Check className="mx-auto h-12 w-12 text-green-500" />
            <p className="mt-4 font-medium">Transcript saved!</p>
            <p className="mt-1 text-sm text-muted-foreground">Processing will begin shortly.</p>
          </div>
        ) : (
          <>
            {/* Mode toggle */}
            <div className="mb-4 flex rounded-lg bg-muted p-1">
              <button
                onClick={() => setMode('paste')}
                className={cn(
                  'flex flex-1 items-center justify-center gap-2 rounded-md py-2 text-sm font-medium transition-colors',
                  mode === 'paste' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Clipboard className="h-4 w-4" />
                Paste
              </button>
              <button
                onClick={() => setMode('upload')}
                className={cn(
                  'flex flex-1 items-center justify-center gap-2 rounded-md py-2 text-sm font-medium transition-colors',
                  mode === 'upload' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Upload className="h-4 w-4" />
                Upload File
              </button>
            </div>

            <div className="space-y-4">
              {/* Title — shared */}
              <div>
                <label className="mb-1 block text-sm font-medium">Title (optional)</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="e.g., Client Discovery Call"
                />
              </div>

              {/* Speaker selector — only shown when team has multiple profiles */}
              {teamProfiles.length > 1 && (
                <div>
                  <label className="mb-1 block text-sm font-medium">Speaker</label>
                  <select
                    value={speakerProfileId}
                    onChange={(e) => setSpeakerProfileId(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">Auto-detect / Default</option>
                    {teamProfiles.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.full_name}{p.title ? ` (${p.title})` : ''}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Select who was speaking. Ideas will be assigned to this person.
                  </p>
                </div>
              )}

              {mode === 'paste' ? (
                /* Paste mode */
                <div>
                  <label className="mb-1 block text-sm font-medium">Transcript *</label>
                  <textarea
                    value={transcript}
                    onChange={(e) => setTranscript(e.target.value)}
                    className="h-48 w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Paste your call transcript here (min 100 characters)..."
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    {transcript.length} characters
                    {transcript.length < 100 && transcript.length > 0
                      ? ` (${100 - transcript.length} more needed)`
                      : ''}
                  </p>
                </div>
              ) : (
                /* Upload mode — drag and drop zone */
                <div>
                  <label className="mb-1 block text-sm font-medium">File *</label>
                  <div
                    onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={cn(
                      'flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed py-12 transition-colors',
                      dragging
                        ? 'border-primary bg-primary/5'
                        : file
                          ? 'border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950/20'
                          : 'border-border hover:border-muted-foreground/50'
                    )}
                  >
                    {file ? (
                      <>
                        <FileText className="h-8 w-8 text-green-600 dark:text-green-400" />
                        <p className="mt-2 text-sm font-medium">{file.name}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {(file.size / 1024).toFixed(1)} KB
                        </p>
                        <button
                          onClick={(e) => { e.stopPropagation(); setFile(null); }}
                          className="mt-2 text-xs text-red-500 hover:underline"
                        >
                          Remove
                        </button>
                      </>
                    ) : (
                      <>
                        <Upload className="h-8 w-8 text-muted-foreground/50" />
                        <p className="mt-2 text-sm text-muted-foreground">
                          Drop a file here, or <span className="font-medium text-primary">browse</span>
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground/70">
                          .txt, .vtt, or .srt up to 10MB
                        </p>
                      </>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={ACCEPTED_TYPES}
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleFile(f);
                    }}
                  />
                </div>
              )}
            </div>

            {error && (
              <div className="mt-3 rounded-lg border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
                {error}
              </div>
            )}

            <div className="mt-6 flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 rounded-lg border border-border py-2 text-sm font-medium hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || !canSubmit}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save & Process'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
