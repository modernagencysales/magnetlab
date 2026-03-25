/**
 * StyleRulesSection. Admin UI for reviewing proposed style rules and managing active rules.
 * Never imports from Next.js HTTP layer. Client component only — all data via fetch.
 */

'use client';

import { useState } from 'react';
import { Check, X, Edit2, Plus, RefreshCw } from 'lucide-react';
import { Badge } from '@magnetlab/magnetui';

// ─── Types ──────────────────────────────────────────────────────────────────

interface StyleRule {
  id: string;
  pattern_name: string;
  rule_text: string;
  frequency: number;
  confidence: number;
  status: 'proposed' | 'approved' | 'rejected';
  proposed_at: string;
  reviewed_at: string | null;
}

interface StyleRulesSectionProps {
  rules: StyleRule[];
  onRefresh: () => void;
}

// ─── Root ────────────────────────────────────────────────────────────────────

export default function StyleRulesSection({ rules, onRefresh }: StyleRulesSectionProps) {
  const proposed = rules.filter((r) => r.status === 'proposed');
  const approved = rules.filter((r) => r.status === 'approved');

  return (
    <div className="space-y-8">
      {proposed.length > 0 && (
        <section>
          <h3 className="text-lg font-semibold text-foreground mb-4">
            Proposed Rules ({proposed.length})
          </h3>
          <div className="space-y-3">
            {proposed.map((rule) => (
              <ProposedRuleCard key={rule.id} rule={rule} onAction={onRefresh} />
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground">
            Active Rules ({approved.length})
          </h3>
          <div className="flex gap-2">
            <CreateRuleButton onCreated={onRefresh} />
            <CompileButton />
          </div>
        </div>
        {approved.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No active rules yet. Approve proposed rules or create one manually.
          </p>
        ) : (
          <div className="space-y-3">
            {approved.map((rule) => (
              <ActiveRuleCard key={rule.id} rule={rule} onAction={onRefresh} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ─── ProposedRuleCard ────────────────────────────────────────────────────────

function ProposedRuleCard({ rule, onAction }: { rule: StyleRule; onAction: () => void }) {
  const [editedText, setEditedText] = useState(rule.rule_text);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleApprove() {
    setApproving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/style-rules/${rule.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved', rule_text: editedText }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? `Request failed (${res.status})`);
        return;
      }
      onAction();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setApproving(false);
    }
  }

  async function handleReject() {
    setRejecting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/style-rules/${rule.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'rejected' }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? `Request failed (${res.status})`);
        return;
      }
      onAction();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setRejecting(false);
    }
  }

  const busy = approving || rejecting;

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">{rule.pattern_name}</span>
            <Badge variant="outline">freq {rule.frequency}</Badge>
            {rule.confidence > 0 && (
              <Badge variant="outline">{Math.round(rule.confidence * 100)}% conf</Badge>
            )}
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={handleApprove}
            disabled={busy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            <Check className="h-3 w-3" />
            {approving ? 'Approving…' : 'Approve'}
          </button>
          <button
            onClick={handleReject}
            disabled={busy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-destructive text-destructive-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            <X className="h-3 w-3" />
            {rejecting ? 'Rejecting…' : 'Reject'}
          </button>
        </div>
      </div>

      <textarea
        value={editedText}
        onChange={(e) => setEditedText(e.target.value)}
        rows={3}
        className="w-full text-sm rounded-md border border-border bg-muted px-3 py-2 text-foreground placeholder:text-muted-foreground resize-y focus:outline-none focus:ring-2 focus:ring-ring"
      />

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

// ─── ActiveRuleCard ──────────────────────────────────────────────────────────

function ActiveRuleCard({ rule, onAction }: { rule: StyleRule; onAction: () => void }) {
  const [editing, setEditing] = useState(false);
  const [editedText, setEditedText] = useState(rule.rule_text);
  const [saving, setSaving] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/style-rules/${rule.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rule_text: editedText }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? `Request failed (${res.status})`);
        return;
      }
      setEditing(false);
      onAction();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setSaving(false);
    }
  }

  function handleCancelEdit() {
    setEditedText(rule.rule_text);
    setEditing(false);
    setError(null);
  }

  async function handleDeactivate() {
    setDeactivating(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/style-rules/${rule.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'rejected' }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? `Request failed (${res.status})`);
        return;
      }
      onAction();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setDeactivating(false);
    }
  }

  const busy = saving || deactivating;

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-foreground">{rule.pattern_name}</span>
          <Badge variant="outline">freq {rule.frequency}</Badge>
        </div>
        <div className="flex gap-2 shrink-0">
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              disabled={busy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-border bg-card text-foreground hover:bg-muted disabled:opacity-50 transition-colors"
            >
              <Edit2 className="h-3 w-3" />
              Edit
            </button>
          )}
          {editing && (
            <>
              <button
                onClick={handleSave}
                disabled={busy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button
                onClick={handleCancelEdit}
                disabled={busy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-border bg-card text-foreground hover:bg-muted disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
            </>
          )}
          <button
            onClick={handleDeactivate}
            disabled={busy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-destructive text-destructive-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            <X className="h-3 w-3" />
            {deactivating ? 'Removing…' : 'Remove'}
          </button>
        </div>
      </div>

      {editing ? (
        <textarea
          value={editedText}
          onChange={(e) => setEditedText(e.target.value)}
          rows={3}
          className="w-full text-sm rounded-md border border-border bg-muted px-3 py-2 text-foreground placeholder:text-muted-foreground resize-y focus:outline-none focus:ring-2 focus:ring-ring"
        />
      ) : (
        <p className="text-sm text-muted-foreground">{rule.rule_text}</p>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

// ─── CreateRuleButton ────────────────────────────────────────────────────────

function CreateRuleButton({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [patternName, setPatternName] = useState('');
  const [ruleText, setRuleText] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (!patternName.trim() || !ruleText.trim()) {
      setError('Pattern name and rule text are required.');
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/style-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pattern_name: patternName.trim(),
          rule_text: ruleText.trim(),
          scope: 'global',
          status: 'approved',
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? `Request failed (${res.status})`);
        return;
      }
      setPatternName('');
      setRuleText('');
      setOpen(false);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setCreating(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-border bg-card text-foreground hover:bg-muted transition-colors"
      >
        <Plus className="h-3 w-3" />
        Add Rule
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3 w-full">
      <h4 className="text-sm font-semibold text-foreground">New Rule</h4>
      <input
        type="text"
        placeholder="Pattern name (e.g. avoid_passive_voice)"
        value={patternName}
        onChange={(e) => setPatternName(e.target.value)}
        className="w-full text-sm rounded-md border border-border bg-muted px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      />
      <textarea
        placeholder="Rule text shown to the AI…"
        value={ruleText}
        onChange={(e) => setRuleText(e.target.value)}
        rows={3}
        className="w-full text-sm rounded-md border border-border bg-muted px-3 py-2 text-foreground placeholder:text-muted-foreground resize-y focus:outline-none focus:ring-2 focus:ring-ring"
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={handleCreate}
          disabled={creating}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {creating ? 'Creating…' : 'Create'}
        </button>
        <button
          onClick={() => {
            setOpen(false);
            setError(null);
            setPatternName('');
            setRuleText('');
          }}
          disabled={creating}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-border bg-card text-foreground hover:bg-muted disabled:opacity-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── CompileButton ───────────────────────────────────────────────────────────

function CompileButton() {
  const [compiling, setCompiling] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleCompile() {
    setCompiling(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetch('/api/admin/style-rules/compile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? `Request failed (${res.status})`);
        return;
      }
      const data = await res.json();
      setResult(`Compiled ${data.ruleCount ?? '?'} rules`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setCompiling(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleCompile}
        disabled={compiling}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-border bg-card text-foreground hover:bg-muted disabled:opacity-50 transition-colors"
      >
        <RefreshCw className={`h-3 w-3 ${compiling ? 'animate-spin' : ''}`} />
        {compiling ? 'Compiling…' : 'Recompile'}
      </button>
      {result && <span className="text-xs text-muted-foreground">{result}</span>}
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}
