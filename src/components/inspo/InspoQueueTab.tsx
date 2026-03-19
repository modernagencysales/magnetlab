'use client';

/**
 * InspoQueueTab. Review queue for creatives — filter, approve, dismiss, generate.
 * Uses useCreatives SWR hook for data, optimistic updates for status changes.
 */

import { useState, useCallback } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@magnetlab/magnetui';
import { toast } from 'sonner';
import { useCreatives, useUpdateCreative } from '@/frontend/hooks/api/useCreatives';
import { CreativeCard } from './CreativeCard';
import { GenerateDrawer } from './GenerateDrawer';
import type { Creative, CreativeStatus, SourcePlatform } from '@/lib/types/exploits';

export function InspoQueueTab() {
  // ─── Filters ─────────────────────────────────────────────
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [minScore, setMinScore] = useState<number>(0);

  // ─── Data ────────────────────────────────────────────────
  const { creatives, isLoading, setCreatives, refetch } = useCreatives({
    status: statusFilter !== 'all' ? (statusFilter as CreativeStatus) : undefined,
    source_platform: platformFilter !== 'all' ? (platformFilter as SourcePlatform) : undefined,
    min_score: minScore > 0 ? minScore : undefined,
    limit: 50,
  });

  // ─── Generate drawer ────────────────────────────────────
  const [generateCreative, setGenerateCreative] = useState<Creative | null>(null);

  // ─── Mutations ──────────────────────────────────────────
  const { mutate: updateCreative } = useUpdateCreative((updated) => {
    setCreatives((prev) =>
      statusFilter !== 'all' && updated.status !== statusFilter
        ? prev.filter((c) => c.id !== updated.id)
        : prev.map((c) => (c.id === updated.id ? updated : c))
    );
  });

  const handleApprove = useCallback(
    async (id: string) => {
      try {
        await updateCreative(id, { status: 'approved' });
        toast.success('Creative approved');
      } catch {
        toast.error('Failed to approve creative');
      }
    },
    [updateCreative]
  );

  const handleDismiss = useCallback(
    async (id: string) => {
      try {
        await updateCreative(id, { status: 'dismissed' });
        toast.success('Creative dismissed');
      } catch {
        toast.error('Failed to dismiss creative');
      }
    },
    [updateCreative]
  );

  // ─── Render ──────────────────────────────────────────────

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex gap-2 items-center">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px] h-8 text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="used">Used</SelectItem>
            <SelectItem value="dismissed">Dismissed</SelectItem>
          </SelectContent>
        </Select>

        <Select value={platformFilter} onValueChange={setPlatformFilter}>
          <SelectTrigger className="w-[140px] h-8 text-xs">
            <SelectValue placeholder="Platform" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Platforms</SelectItem>
            <SelectItem value="twitter">Twitter</SelectItem>
            <SelectItem value="reddit">Reddit</SelectItem>
            <SelectItem value="linkedin">LinkedIn</SelectItem>
            <SelectItem value="manual">Manual</SelectItem>
          </SelectContent>
        </Select>

        <Select value={String(minScore)} onValueChange={(v) => setMinScore(Number(v))}>
          <SelectTrigger className="w-[130px] h-8 text-xs">
            <SelectValue placeholder="Min Score" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0">Min Score: 0</SelectItem>
            <SelectItem value="3">Min Score: 3</SelectItem>
            <SelectItem value="5">Min Score: 5</SelectItem>
            <SelectItem value="7">Min Score: 7</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex-1" />
        <span className="text-xs text-muted-foreground">{creatives.length} creatives</span>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex flex-col gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : creatives.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>No creatives yet.</p>
          <p className="text-sm mt-1">
            Paste one manually or configure the scanner to find them automatically.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {creatives.map((creative) => (
            <CreativeCard
              key={creative.id}
              creative={creative}
              onApprove={handleApprove}
              onDismiss={handleDismiss}
              onGenerate={setGenerateCreative}
            />
          ))}
        </div>
      )}

      {/* Generate drawer */}
      <GenerateDrawer
        creative={generateCreative}
        open={!!generateCreative}
        onOpenChange={(open) => {
          if (!open) setGenerateCreative(null);
        }}
        onGenerated={() => refetch()}
      />
    </div>
  );
}
