'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import type { PipelinePost } from '@/lib/types/content-pipeline';
import { KanbanColumn } from './KanbanColumn';
import { BulkSelectionBar } from './BulkSelectionBar';

interface KanbanColumnDef {
  id: string;
  label: string;
  statuses: string[];
}

const COLUMNS: KanbanColumnDef[] = [
  { id: 'ideas', label: 'Ideas', statuses: ['draft'] },
  { id: 'written', label: 'Written', statuses: ['reviewing'] },
  { id: 'review', label: 'Review', statuses: ['approved'] },
  { id: 'scheduled', label: 'Scheduled', statuses: ['scheduled', 'published'] },
];

export function KanbanBoard() {
  const [posts, setPosts] = useState<PipelinePost[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const fetchPosts = useCallback(async () => {
    try {
      const response = await fetch('/api/content-pipeline/posts?limit=200');
      const data = await response.json();
      setPosts(data.posts || []);
    } catch {
      // Silent failure
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const handleStatusChange = async (postId: string, newStatus: string) => {
    try {
      await fetch(`/api/content-pipeline/posts/${postId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      await fetchPosts();
    } catch {
      // Silent failure
    }
  };

  const handleBulkMove = async (status: string) => {
    const promises = [...selectedIds].map((id) =>
      fetch(`/api/content-pipeline/posts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
    );
    await Promise.allSettled(promises);
    setSelectedIds(new Set());
    await fetchPosts();
  };

  const handleBulkDelete = async () => {
    const promises = [...selectedIds].map((id) =>
      fetch(`/api/content-pipeline/posts/${id}`, { method: 'DELETE' })
    );
    await Promise.allSettled(promises);
    setSelectedIds(new Set());
    await fetchPosts();
  };

  const toggleSelect = (postId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(postId)) next.delete(postId);
      else next.add(postId);
      return next;
    });
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
      <div className="grid grid-cols-4 gap-3">
        {COLUMNS.map((col) => {
          const columnPosts = posts.filter((p) => col.statuses.includes(p.status));
          return (
            <KanbanColumn
              key={col.id}
              label={col.label}
              posts={columnPosts}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelect}
              onStatusChange={handleStatusChange}
            />
          );
        })}
      </div>

      {selectedIds.size > 0 && (
        <BulkSelectionBar
          count={selectedIds.size}
          onMove={handleBulkMove}
          onDelete={handleBulkDelete}
          onClear={() => setSelectedIds(new Set())}
        />
      )}
    </div>
  );
}
