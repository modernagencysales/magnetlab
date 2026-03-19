'use client';

/**
 * ScannerSettings. Configure scanner sources (search terms, creators, subreddits).
 * Tag-style input for search terms, list for monitored sources, scan status.
 */

import { useState, type KeyboardEvent } from 'react';
import {
  Badge,
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@magnetlab/magnetui';
import { Loader2, Plus, ScanSearch, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  useScannerSources,
  useAddScannerSource,
  useDeleteScannerSource,
  useRunScanner,
} from '@/frontend/hooks/api/useScanner';
import type { ScannerSourceType } from '@/frontend/api/content-pipeline/scanner';

// ─── Priority display ─────────────────────────────────────────────────────────

function priorityLabel(p: number): string {
  if (p >= 4) return 'high';
  if (p >= 2) return 'normal';
  return 'low';
}

function priorityColor(p: number): string {
  if (p >= 4) return 'bg-emerald-500/10 text-emerald-500';
  return 'bg-muted text-muted-foreground';
}

export function ScannerSettings() {
  const { sources, isLoading, refetch } = useScannerSources();
  const { mutate: addSource, isPending: adding } = useAddScannerSource(() => refetch());
  const { mutate: deleteSource } = useDeleteScannerSource(() => refetch());
  const { mutate: runScan, isPending: scanning } = useRunScanner(() => {
    toast.success('Scan started — new creatives will appear shortly');
  });

  // ─── Tag input for search terms ─────────────────────────────────────────────

  const [termInput, setTermInput] = useState('');

  const searchTerms = sources.filter(
    (s) => s.source_type === 'search_term' || s.source_type === 'hashtag'
  );
  const otherSources = sources.filter(
    (s) => s.source_type !== 'search_term' && s.source_type !== 'hashtag'
  );

  const handleTermKeyDown = async (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter' || !termInput.trim()) return;
    e.preventDefault();
    const isHashtag = termInput.trim().startsWith('#');
    try {
      await addSource({
        source_type: isHashtag ? 'hashtag' : 'search_term',
        source_value: termInput.trim().replace(/^#/, ''),
      });
      setTermInput('');
    } catch {
      toast.error('Failed to add search term');
    }
  };

  // ─── Add source form ──────────────────────────────────────────────────────

  const [newSourceType, setNewSourceType] = useState<ScannerSourceType>('creator');
  const [newSourceValue, setNewSourceValue] = useState('');
  const [newSourcePriority, setNewSourcePriority] = useState<number>(3);

  const handleAddSource = async () => {
    if (!newSourceValue.trim()) return;
    try {
      await addSource({
        source_type: newSourceType,
        source_value: newSourceValue.trim(),
        priority: newSourcePriority,
      });
      setNewSourceValue('');
    } catch {
      toast.error('Failed to add source');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-foreground">Content Scanner</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Configure what the scanner monitors for new content inspiration
        </p>
      </div>

      {/* ─── Search Terms ─────────────────────────────────────────────────── */}
      <div>
        <Label className="text-sm font-medium">Search Terms</Label>
        <div className="mt-1.5 p-3 rounded-lg bg-card border border-border">
          <div className="flex flex-wrap gap-1.5">
            {searchTerms.map((s) => (
              <Badge key={s.id} variant="gray" className="text-xs gap-1">
                {s.source_type === 'hashtag' ? '#' : ''}
                {s.source_value}
                <button
                  type="button"
                  className="ml-0.5 hover:text-foreground"
                  onClick={() => deleteSource(s.id)}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            <Input
              className="border-0 bg-transparent h-6 w-32 text-xs p-0 focus-visible:ring-0"
              placeholder="+ Add term (Enter)"
              value={termInput}
              onChange={(e) => setTermInput(e.target.value)}
              onKeyDown={handleTermKeyDown}
            />
          </div>
        </div>
      </div>

      {/* ─── Monitored Sources ────────────────────────────────────────────── */}
      <div>
        <Label className="text-sm font-medium">Monitored Sources</Label>
        <div className="mt-1.5 rounded-lg bg-card border border-border divide-y divide-border">
          {otherSources.length === 0 && !isLoading && (
            <div className="p-4 text-sm text-muted-foreground text-center">
              No sources configured yet
            </div>
          )}
          {otherSources.map((s) => (
            <div key={s.id} className="flex items-center justify-between px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="text-sm text-foreground">{s.source_value}</span>
                <Badge variant="gray" className="text-xs">
                  {s.source_type}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="gray" className={`text-xs ${priorityColor(s.priority)}`}>
                  {priorityLabel(s.priority)}
                </Badge>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => deleteSource(s.id)}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}

          {/* Add source inline form */}
          <div className="flex items-center gap-2 p-3">
            <Select
              value={newSourceType}
              onValueChange={(v) => setNewSourceType(v as ScannerSourceType)}
            >
              <SelectTrigger className="w-[140px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="creator">Creator</SelectItem>
                <SelectItem value="competitor">Competitor</SelectItem>
                <SelectItem value="reddit_subreddit">Subreddit</SelectItem>
                <SelectItem value="reddit_search">Reddit Search</SelectItem>
              </SelectContent>
            </Select>
            <Input
              className="flex-1 h-8 text-xs"
              placeholder="Source value..."
              value={newSourceValue}
              onChange={(e) => setNewSourceValue(e.target.value)}
            />
            <Select
              value={String(newSourcePriority)}
              onValueChange={(v) => setNewSourcePriority(Number(v))}
            >
              <SelectTrigger className="w-[100px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">High</SelectItem>
                <SelectItem value="3">Normal</SelectItem>
                <SelectItem value="1">Low</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={handleAddSource} disabled={adding}>
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* ─── Scan Status ──────────────────────────────────────────────────── */}
      <div>
        <Label className="text-sm font-medium">Scan Status</Label>
        <div className="mt-1.5 p-4 rounded-lg bg-card border border-border flex items-center justify-between">
          <div className="text-sm text-muted-foreground">{sources.length} sources configured</div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => runScan().catch(() => toast.error('Failed to start scan'))}
            disabled={scanning}
          >
            {scanning ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : (
              <ScanSearch className="h-4 w-4 mr-1.5" />
            )}
            {scanning ? 'Scanning...' : 'Run Now'}
          </Button>
        </div>
      </div>
    </div>
  );
}
