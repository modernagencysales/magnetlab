'use client';

import { useState, useEffect, useCallback } from 'react';
import { Bot, Plus, Play, Pause, Pencil, Trash2, Loader2, Users, Activity } from 'lucide-react';
import {
  PageContainer,
  PageTitle,
  Button,
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  LoadingCard,
  StatusDot,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@magnetlab/magnetui';
import { AutomationEditor } from './AutomationEditor';
import { AutomationEventsDrawer } from './AutomationEventsDrawer';
import * as automationsApi from '@/frontend/api/linkedin/automations';

// ─── Types ──────────────────────────────────────────────

export type Automation = automationsApi.Automation;

// ─── Status badge ───────────────────────────────────────

function StatusBadge({ status }: { status: Automation['status'] }) {
  const config = {
    running: { label: 'Running', variant: 'green' as const, dotStatus: 'success' as const },
    paused: { label: 'Paused', variant: 'orange' as const, dotStatus: 'warning' as const },
    draft: { label: 'Draft', variant: 'gray' as const, dotStatus: 'neutral' as const },
  };
  const { label, variant, dotStatus } = config[status];
  return (
    <Badge variant={variant}>
      <StatusDot status={dotStatus} size="sm" pulse={status === 'running'} className="mr-1.5" />
      {label}
    </Badge>
  );
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
  const [activityTarget, setActivityTarget] = useState<Automation | null>(null);

  const fetchAutomations = useCallback(async () => {
    try {
      setError(null);
      const data = await automationsApi.listAutomations();
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
      const data = await automationsApi.updateAutomation(automation.id, { status: newStatus });
      setAutomations((prev) => prev.map((a) => (a.id === automation.id ? data.automation : a)));
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
      await automationsApi.deleteAutomation(deleteTarget.id);
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
      <PageContainer maxWidth="xl">
        <LoadingCard count={3} />
      </PageContainer>
    );
  }

  return (
    <PageContainer maxWidth="xl">
      <div className="space-y-6">
        <PageTitle
          title="Automations"
          description="Auto-DM LinkedIn commenters on your posts"
          actions={
            <Button onClick={handleCreate} size="sm">
              <Plus className="mr-1 h-4 w-4" />
              New Automation
            </Button>
          }
        />

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {/* Empty state */}
        {!error && automations.length === 0 && (
          <EmptyState
            icon={<Bot />}
            title="No automations yet"
            description="Create one to auto-DM commenters on your posts. Set keywords to match, craft a DM template, and let it run."
            action={
              <Button onClick={handleCreate} size="sm">
                <Plus className="mr-1 h-4 w-4" />
                Create Automation
              </Button>
            }
          />
        )}

        {/* Automation cards */}
        <div className="grid gap-4">
          {automations.map((automation) => (
            <Card key={automation.id} className="group border-border">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="text-sm truncate">{automation.name}</CardTitle>
                      {automation.post_social_id && (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {automation.post_social_id}
                        </p>
                      )}
                    </div>
                  </div>
                  <StatusBadge status={automation.status} />
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="mb-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" />
                    <span>
                      {automation.leads_captured} lead{automation.leads_captured !== 1 ? 's' : ''}{' '}
                      captured
                    </span>
                  </div>

                  {automation.keywords.length > 0 && (
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span className="shrink-0">Keywords:</span>
                      <span className="truncate max-w-[200px]">
                        {automation.keywords.slice(0, 5).join(', ')}
                        {automation.keywords.length > 5 &&
                          ` +${automation.keywords.length - 5} more`}
                      </span>
                    </div>
                  )}

                  {automation.auto_connect && <Badge variant="outline">Auto-connect</Badge>}
                  {automation.auto_like && <Badge variant="outline">Auto-like</Badge>}
                  {automation.plusvibe_campaign_id && <Badge variant="outline">PlusVibe</Badge>}
                  {automation.enable_follow_up && <Badge variant="outline">Follow-up</Badge>}
                </div>

                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleToggleStatus(automation)}
                    disabled={togglingId === automation.id}
                  >
                    {togglingId === automation.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : automation.status === 'running' ? (
                      <>
                        <Pause className="mr-1 h-3.5 w-3.5" />
                        Pause
                      </>
                    ) : (
                      <>
                        <Play className="mr-1 h-3.5 w-3.5" />
                        Start
                      </>
                    )}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setActivityTarget(automation)}>
                    <Activity className="mr-1 h-3.5 w-3.5" />
                    Activity
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleEdit(automation)}>
                    <Pencil className="mr-1 h-3.5 w-3.5" />
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteTarget(automation)}
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="mr-1 h-3.5 w-3.5" />
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

        {/* Activity drawer */}
        <AutomationEventsDrawer
          automationId={activityTarget?.id || null}
          automationName={activityTarget?.name || ''}
          optInUrl={activityTarget?.opt_in_url || null}
          open={!!activityTarget}
          onClose={() => setActivityTarget(null)}
        />

        {/* Delete confirmation dialog */}
        <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Automation</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete &quot;{deleteTarget?.name}&quot;? This action cannot
                be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
                {deleting ? (
                  <>
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
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
    </PageContainer>
  );
}
