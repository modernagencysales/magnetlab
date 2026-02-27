'use client';

import { useState, useEffect, useCallback } from 'react';
import { Bot, Plus, Play, Pause, Pencil, Trash2, Loader2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AutomationEditor } from './AutomationEditor';

// ─── Types ──────────────────────────────────────────────

export interface Automation {
  id: string;
  user_id: string;
  name: string;
  post_id: string | null;
  post_social_id: string | null;
  keywords: string[];
  dm_template: string | null;
  auto_connect: boolean;
  auto_like: boolean;
  comment_reply_template: string | null;
  enable_follow_up: boolean;
  follow_up_template: string | null;
  follow_up_delay_minutes: number;
  status: 'draft' | 'running' | 'paused';
  unipile_account_id: string | null;
  leads_captured: number;
  plusvibe_campaign_id: string | null;
  opt_in_url: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Status badge ───────────────────────────────────────

function StatusBadge({ status }: { status: Automation['status'] }) {
  const config = {
    running: { label: 'Running', className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' },
    paused: { label: 'Paused', className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' },
    draft: { label: 'Draft', className: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20' },
  };
  const { label, className } = config[status];
  return <Badge className={className}>{label}</Badge>;
}

// ─── Main list component ────────────────────────────────

export function AutomationList() {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingAutomation, setEditingAutomation] = useState<Automation | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Automation | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchAutomations = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch('/api/linkedin/automations');
      if (!res.ok) {
        throw new Error('Failed to fetch automations');
      }
      const data = await res.json();
      setAutomations(data.automations || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load automations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAutomations();
  }, [fetchAutomations]);

  // ── Toggle status ──

  async function handleToggleStatus(automation: Automation) {
    const newStatus = automation.status === 'running' ? 'paused' : 'running';
    setTogglingId(automation.id);
    try {
      const res = await fetch(`/api/linkedin/automations/${automation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error('Failed to update status');
      const data = await res.json();
      setAutomations((prev) =>
        prev.map((a) => (a.id === automation.id ? data.automation : a))
      );
    } catch {
      // Silently fail — the UI state remains unchanged
    } finally {
      setTogglingId(null);
    }
  }

  // ── Delete ──

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/linkedin/automations/${deleteTarget.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete');
      setAutomations((prev) => prev.filter((a) => a.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch {
      // Keep dialog open on error
    } finally {
      setDeleting(false);
    }
  }

  // ── Edit / Create ──

  function handleEdit(automation: Automation) {
    setEditingAutomation(automation);
    setEditorOpen(true);
  }

  function handleCreate() {
    setEditingAutomation(null);
    setEditorOpen(true);
  }

  function handleEditorClose() {
    setEditorOpen(false);
    setEditingAutomation(null);
  }

  function handleEditorSave(saved: Automation) {
    setAutomations((prev) => {
      const exists = prev.find((a) => a.id === saved.id);
      if (exists) {
        return prev.map((a) => (a.id === saved.id ? saved : a));
      }
      return [saved, ...prev];
    });
    handleEditorClose();
  }

  // ─── Render ───

  if (loading) {
    return (
      <div className="p-6 lg:p-8">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Automations</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Auto-DM LinkedIn commenters on your posts
          </p>
        </div>
        <Button onClick={handleCreate} size="sm">
          <Plus className="h-4 w-4 mr-1.5" />
          New Automation
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Empty state */}
      {!error && automations.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-12 h-12 rounded-lg bg-violet-500/10 flex items-center justify-center mb-4">
              <Bot className="h-6 w-6 text-violet-500" />
            </div>
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
              No automations yet
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm mb-6">
              Create one to auto-DM commenters on your posts. Set keywords to match, craft a DM template, and let it run.
            </p>
            <Button onClick={handleCreate} size="sm">
              <Plus className="h-4 w-4 mr-1.5" />
              Create Automation
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Automation cards */}
      <div className="grid gap-4">
        {automations.map((automation) => (
          <Card key={automation.id} className="group">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0">
                    <Bot className="h-4 w-4 text-violet-500" />
                  </div>
                  <div className="min-w-0">
                    <CardTitle className="text-sm truncate">{automation.name}</CardTitle>
                    {automation.post_social_id && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {automation.post_social_id}
                      </p>
                    )}
                  </div>
                </div>
                <StatusBadge status={automation.status} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground mb-4">
                {/* Leads captured */}
                <div className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" />
                  <span>{automation.leads_captured} lead{automation.leads_captured !== 1 ? 's' : ''} captured</span>
                </div>

                {/* Keywords */}
                {automation.keywords.length > 0 && (
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="shrink-0">Keywords:</span>
                    <span className="truncate max-w-[200px]">
                      {automation.keywords.slice(0, 5).join(', ')}
                      {automation.keywords.length > 5 && ` +${automation.keywords.length - 5} more`}
                    </span>
                  </div>
                )}

                {/* Features */}
                {automation.auto_connect && (
                  <Badge variant="outline" className="text-xs py-0">Auto-connect</Badge>
                )}
                {automation.auto_like && (
                  <Badge variant="outline" className="text-xs py-0">Auto-like</Badge>
                )}
                {automation.plusvibe_campaign_id && (
                  <Badge variant="outline" className="text-xs py-0">PlusVibe</Badge>
                )}
                {automation.enable_follow_up && (
                  <Badge variant="outline" className="text-xs py-0">Follow-up</Badge>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleToggleStatus(automation)}
                  disabled={togglingId === automation.id}
                  className="h-8"
                >
                  {togglingId === automation.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : automation.status === 'running' ? (
                    <>
                      <Pause className="h-3.5 w-3.5 mr-1" />
                      Pause
                    </>
                  ) : (
                    <>
                      <Play className="h-3.5 w-3.5 mr-1" />
                      Start
                    </>
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleEdit(automation)}
                  className="h-8"
                >
                  <Pencil className="h-3.5 w-3.5 mr-1" />
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDeleteTarget(automation)}
                  className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/20"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Editor dialog */}
      <AutomationEditor
        open={editorOpen}
        automation={editingAutomation}
        onClose={handleEditorClose}
        onSave={handleEditorSave}
      />

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Automation</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{deleteTarget?.name}&quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
