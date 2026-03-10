'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { X, Loader2, Check, Upload, FileText, Clipboard } from 'lucide-react';
import {
  Button,
  Input,
  Textarea,
  Label,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@magnetlab/magnetui';
import { cn } from '@/lib/utils';
import type { TeamProfile } from '@/lib/types/content-pipeline';
import * as transcriptsApi from '@/frontend/api/content-pipeline/transcripts';
import * as teamsApi from '@/frontend/api/teams';

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
    teamsApi
      .listProfiles()
      .then((profiles) => {
        if (Array.isArray(profiles) && profiles.length > 1) {
          setTeamProfiles(profiles as TeamProfile[]);
        }
      })
      .catch(() => {});
  }, []);

  const ACCEPTED_TYPES = '.txt,.vtt,.srt';

  const handleFile = useCallback(
    (f: File) => {
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
    },
    [title]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const f = e.dataTransfer.files[0];
      if (f) handleFile(f);
    },
    [handleFile]
  );

  const handleSubmit = async () => {
    setError('');

    if (mode === 'paste') {
      if (transcript.trim().length < 100) {
        setError('Transcript must be at least 100 characters');
        return;
      }
      setSubmitting(true);
      try {
        await transcriptsApi.createTranscript({
          title: title.trim() || undefined,
          transcript: transcript.trim(),
          speakerProfileId: speakerProfileId || undefined,
        });
        setSuccess(true);
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1500);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to save transcript');
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
        await transcriptsApi.uploadTranscript(file, title.trim() || undefined);
        setSuccess(true);
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1500);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to upload transcript');
      } finally {
        setSubmitting(false);
      }
    }
  };

  const canSubmit = mode === 'paste' ? transcript.trim().length >= 100 : !!file;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Add Transcript"
    >
      <div className="w-full max-w-lg rounded-xl bg-background p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Add Transcript</h2>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
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
                  mode === 'paste'
                    ? 'bg-background shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Clipboard className="h-4 w-4" />
                Paste
              </button>
              <button
                onClick={() => setMode('upload')}
                className={cn(
                  'flex flex-1 items-center justify-center gap-2 rounded-md py-2 text-sm font-medium transition-colors',
                  mode === 'upload'
                    ? 'bg-background shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Upload className="h-4 w-4" />
                Upload File
              </button>
            </div>

            <div className="space-y-4">
              {/* Title — shared */}
              <div>
                <Label className="mb-1">Title (optional)</Label>
                <Input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Client Discovery Call"
                />
              </div>

              {/* Speaker selector — only shown when team has multiple profiles */}
              {teamProfiles.length > 1 && (
                <div>
                  <Label className="mb-1">Speaker</Label>
                  <Select value={speakerProfileId} onValueChange={setSpeakerProfileId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Auto-detect / Default" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Auto-detect / Default</SelectItem>
                      {teamProfiles.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.full_name}
                          {p.title ? ` (${p.title})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Select who was speaking. Ideas will be assigned to this person.
                  </p>
                </div>
              )}

              {mode === 'paste' ? (
                /* Paste mode */
                <div>
                  <Label className="mb-1">Transcript *</Label>
                  <Textarea
                    value={transcript}
                    onChange={(e) => setTranscript(e.target.value)}
                    className="h-48 resize-none"
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
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragging(true);
                    }}
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
                          onClick={(e) => {
                            e.stopPropagation();
                            setFile(null);
                          }}
                          className="mt-2 text-xs text-red-500 hover:underline"
                        >
                          Remove
                        </button>
                      </>
                    ) : (
                      <>
                        <Upload className="h-8 w-8 text-muted-foreground/50" />
                        <p className="mt-2 text-sm text-muted-foreground">
                          Drop a file here, or{' '}
                          <span className="font-medium text-primary">browse</span>
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
              <Button variant="outline" className="flex-1" onClick={onClose}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={handleSubmit} disabled={submitting || !canSubmit}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save & Process'}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
