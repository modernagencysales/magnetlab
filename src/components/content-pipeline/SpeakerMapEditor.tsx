'use client';

import { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, Users, Check, Loader2 } from 'lucide-react';
import { parseSpeakerNames } from '@/lib/utils/transcript-parser';

export interface SpeakerMapEntry {
  role: 'host' | 'client' | 'guest' | 'unknown';
  company: string;
}

export type SpeakerMap = Record<string, SpeakerMapEntry>;

const ROLE_OPTIONS: { value: SpeakerMapEntry['role']; label: string }[] = [
  { value: 'host', label: 'Host' },
  { value: 'client', label: 'Client' },
  { value: 'guest', label: 'Guest' },
  { value: 'unknown', label: 'Unknown' },
];

interface SpeakerMapEditorProps {
  rawTranscript: string;
  speakerMap: SpeakerMap | null;
  onSave: (speakerMap: SpeakerMap) => Promise<void>;
}

export function SpeakerMapEditor({ rawTranscript, speakerMap, onSave }: SpeakerMapEditorProps) {
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);

  const detectedSpeakers = useMemo(() => parseSpeakerNames(rawTranscript), [rawTranscript]);

  // Initialize local state from existing speakerMap or empty
  const [localMap, setLocalMap] = useState<SpeakerMap>(() => {
    const initial: SpeakerMap = {};
    for (const name of detectedSpeakers) {
      initial[name] = speakerMap?.[name] || { role: 'unknown', company: '' };
    }
    return initial;
  });

  const handleRoleChange = (speaker: string, role: SpeakerMapEntry['role']) => {
    setLocalMap((prev) => ({
      ...prev,
      [speaker]: { ...prev[speaker], role },
    }));
  };

  const handleCompanyChange = (speaker: string, company: string) => {
    setLocalMap((prev) => ({
      ...prev,
      [speaker]: { ...prev[speaker], company },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(localMap);
    } finally {
      setSaving(false);
    }
  };

  if (detectedSpeakers.length === 0) return null;

  const hasChanges = JSON.stringify(localMap) !== JSON.stringify(
    detectedSpeakers.reduce((acc, name) => {
      acc[name] = speakerMap?.[name] || { role: 'unknown', company: '' };
      return acc;
    }, {} as SpeakerMap)
  );

  return (
    <div className="border-b">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-6 py-3 text-sm font-medium hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          Speaker Identification
          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
            {detectedSpeakers.length} speakers
          </span>
          {speakerMap && Object.values(speakerMap).some(v => v.company) && (
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700 dark:bg-green-950 dark:text-green-400">
              Configured
            </span>
          )}
        </div>
        {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {expanded && (
        <div className="border-t px-6 py-4">
          <p className="mb-3 text-xs text-muted-foreground">
            Identify each speaker&apos;s role and company. This helps the AI correctly attribute insights and write content from the right perspective.
          </p>

          <div className="space-y-3">
            {detectedSpeakers.map((speaker) => (
              <div key={speaker} className="flex items-center gap-3">
                <span className="w-40 truncate text-sm font-medium" title={speaker}>
                  {speaker}
                </span>
                <select
                  value={localMap[speaker]?.role || 'unknown'}
                  onChange={(e) => handleRoleChange(speaker, e.target.value as SpeakerMapEntry['role'])}
                  className="rounded-md border bg-background px-2 py-1.5 text-sm"
                >
                  {ROLE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <input
                  type="text"
                  value={localMap[speaker]?.company || ''}
                  onChange={(e) => handleCompanyChange(speaker, e.target.value)}
                  placeholder="Company name"
                  className="flex-1 rounded-md border bg-background px-2 py-1.5 text-sm"
                />
              </div>
            ))}
          </div>

          {hasChanges && (
            <div className="mt-4 flex justify-end">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
                Save Speaker Info
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
