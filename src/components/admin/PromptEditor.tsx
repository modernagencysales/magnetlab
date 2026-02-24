'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { VersionTimeline } from './VersionTimeline';

interface Variable {
  name: string;
  description: string;
  example: string;
}

interface Prompt {
  id: string;
  slug: string;
  name: string;
  category: string;
  description: string | null;
  system_prompt: string;
  user_prompt: string;
  model: string;
  temperature: number;
  max_tokens: number;
  variables: Variable[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface Version {
  id: string;
  prompt_id: string;
  version: number;
  system_prompt: string;
  user_prompt: string;
  model: string;
  temperature: number;
  max_tokens: number;
  change_note: string | null;
  changed_by: string;
  created_at: string;
}

interface Props {
  prompt: Prompt;
  versions: Version[];
}

const MODEL_OPTIONS = [
  'claude-sonnet-4-6',
  'claude-haiku-4-5-20250514',
  'claude-opus-4-6',
];

export function PromptEditor({ prompt, versions }: Props) {
  const router = useRouter();

  // Prompt editor state
  const [systemPrompt, setSystemPrompt] = useState(prompt.system_prompt);
  const [userPrompt, setUserPrompt] = useState(prompt.user_prompt);
  const [model, setModel] = useState(prompt.model);
  const [temperature, setTemperature] = useState(prompt.temperature);
  const [maxTokens, setMaxTokens] = useState(prompt.max_tokens);
  const [isActive, setIsActive] = useState(prompt.is_active);
  const [changeNote, setChangeNote] = useState('');

  // UI state
  const [activeTab, setActiveTab] = useState<'system' | 'user'>('system');
  const [showHistory, setShowHistory] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Check if anything has been modified
  const isDirty =
    systemPrompt !== prompt.system_prompt ||
    userPrompt !== prompt.user_prompt ||
    model !== prompt.model ||
    temperature !== prompt.temperature ||
    maxTokens !== prompt.max_tokens ||
    isActive !== prompt.is_active;

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveMessage(null);
    try {
      const updates: Record<string, unknown> = {};
      if (systemPrompt !== prompt.system_prompt) updates.system_prompt = systemPrompt;
      if (userPrompt !== prompt.user_prompt) updates.user_prompt = userPrompt;
      if (model !== prompt.model) updates.model = model;
      if (temperature !== prompt.temperature) updates.temperature = temperature;
      if (maxTokens !== prompt.max_tokens) updates.max_tokens = maxTokens;
      if (isActive !== prompt.is_active) updates.is_active = isActive;

      const res = await fetch(`/api/admin/prompts/${prompt.slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updates,
          change_note: changeNote.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save');
      }

      setSaveMessage('Saved!');
      setChangeNote('');
      setTimeout(() => setSaveMessage(null), 3000);
      router.refresh();
    } catch (err) {
      setSaveMessage(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }, [
    systemPrompt,
    userPrompt,
    model,
    temperature,
    maxTokens,
    isActive,
    changeNote,
    prompt,
    router,
  ]);

  const handleTest = useCallback(async () => {
    setTesting(true);
    setTestResult(null);
    setTestError(null);
    setShowTestModal(true);

    try {
      // Build example variables from the variables array
      const exampleVars: Record<string, string> = {};
      for (const v of prompt.variables ?? []) {
        exampleVars[v.name] = v.example;
      }

      const res = await fetch(`/api/admin/prompts/${prompt.slug}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_prompt: systemPrompt,
          user_prompt: userPrompt,
          model,
          temperature,
          max_tokens: maxTokens,
          variables: exampleVars,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Test failed');
      }

      setTestResult(data.result ?? data.output ?? JSON.stringify(data, null, 2));
    } catch (err) {
      setTestError(err instanceof Error ? err.message : 'Test failed');
    } finally {
      setTesting(false);
    }
  }, [systemPrompt, userPrompt, model, temperature, maxTokens, prompt]);

  const handleRestore = useCallback(
    async (versionId: string) => {
      if (!confirm('Restore this version? This will create a new version with the restored content.')) {
        return;
      }

      try {
        const res = await fetch(`/api/admin/prompts/${prompt.slug}/restore`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ version_id: versionId }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Restore failed');
        }

        router.refresh();
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Restore failed');
      }
    },
    [prompt.slug, router]
  );

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/admin/prompts"
          className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 mb-3 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to prompts
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{prompt.name}</h1>
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
              isActive
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
            }`}
          >
            {isActive ? 'Active' : 'Inactive'}
          </span>
        </div>
        <p className="text-xs font-mono text-zinc-400 mt-1">{prompt.slug}</p>
        {prompt.description && (
          <p className="text-sm text-zinc-500 mt-1">{prompt.description}</p>
        )}
      </div>

      {/* Main content: editor + sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        {/* Left panel - Editor */}
        <div className="min-w-0">
          {/* Tab bar */}
          <div className="flex border-b border-zinc-200 dark:border-zinc-700 mb-0">
            <button
              type="button"
              onClick={() => setActiveTab('system')}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'system'
                  ? 'border-violet-500 text-violet-600 dark:text-violet-400'
                  : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
              }`}
            >
              System Prompt
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('user')}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'user'
                  ? 'border-violet-500 text-violet-600 dark:text-violet-400'
                  : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
              }`}
            >
              User Prompt
            </button>
          </div>

          {/* Variable hint */}
          <div className="bg-zinc-50 dark:bg-zinc-800/50 border border-t-0 border-zinc-200 dark:border-zinc-700 px-3 py-2 text-xs text-zinc-500">
            Use <code className="font-mono text-violet-600 dark:text-violet-400">{'{{variable_name}}'}</code> syntax
            for dynamic variables. They will be replaced at runtime.
          </div>

          {/* Textarea */}
          <textarea
            value={activeTab === 'system' ? systemPrompt : userPrompt}
            onChange={(e) =>
              activeTab === 'system'
                ? setSystemPrompt(e.target.value)
                : setUserPrompt(e.target.value)
            }
            className="w-full min-h-[400px] p-4 font-mono text-sm text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-900 border border-t-0 border-zinc-200 dark:border-zinc-700 rounded-b-lg resize-y focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-inset"
            spellCheck={false}
          />

          {/* Bottom bar */}
          <div className="mt-4 flex items-center gap-3 p-4 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
            <input
              type="text"
              placeholder="What changed? (optional)"
              value={changeNote}
              onChange={(e) => setChangeNote(e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
            <button
              type="button"
              onClick={handleTest}
              disabled={testing}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50 transition-colors"
            >
              {testing ? 'Testing...' : 'Test'}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !isDirty}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
            {saveMessage && (
              <span
                className={`text-sm font-medium ${
                  saveMessage === 'Saved!'
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                }`}
              >
                {saveMessage}
              </span>
            )}
          </div>

          {/* Version History toggle */}
          <div className="mt-6">
            <button
              type="button"
              onClick={() => setShowHistory(!showHistory)}
              className="text-sm font-medium text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 transition-colors"
            >
              {showHistory ? 'Hide Version History' : 'Show Version History'}
              {versions.length > 0 && (
                <span className="ml-1.5 text-xs text-zinc-400">({versions.length})</span>
              )}
            </button>
            {showHistory && (
              <div className="mt-4">
                <VersionTimeline
                  versions={versions}
                  currentSystemPrompt={systemPrompt}
                  currentUserPrompt={userPrompt}
                  onRestore={handleRestore}
                />
              </div>
            )}
          </div>
        </div>

        {/* Right sidebar */}
        <div className="space-y-6">
          {/* Variables Reference */}
          {prompt.variables && prompt.variables.length > 0 && (
            <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">
                Variables Reference
              </h3>
              <div className="space-y-3">
                {prompt.variables.map((v) => (
                  <div key={v.name} className="text-xs">
                    <code className="font-mono text-violet-600 dark:text-violet-400 font-medium">
                      {`{{${v.name}}}`}
                    </code>
                    <p className="text-zinc-600 dark:text-zinc-300 mt-0.5">{v.description}</p>
                    {v.example && (
                      <p className="text-zinc-400 mt-0.5 truncate" title={v.example}>
                        e.g. {v.example}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Model Configuration */}
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">
              Model Configuration
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Model</label>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  {MODEL_OPTIONS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Temperature</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="2"
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Max Tokens</label>
                <input
                  type="number"
                  step="100"
                  min="100"
                  value={maxTokens}
                  onChange={(e) => setMaxTokens(parseInt(e.target.value, 10) || 100)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
            </div>
          </div>

          {/* Status */}
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">
              Status
            </h3>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300 text-violet-600 focus:ring-violet-500"
              />
              <span className="text-sm text-zinc-700 dark:text-zinc-300">Active</span>
            </label>
            <p className="text-[11px] text-zinc-400 mt-2">
              Disabling falls back to the hardcoded default prompt.
            </p>
          </div>
        </div>
      </div>

      {/* Test Result Modal */}
      {showTestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-700">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Test Result
              </h3>
              <button
                type="button"
                onClick={() => setShowTestModal(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 text-sm"
              >
                Close
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {testing && (
                <div className="text-center py-8 text-zinc-500 text-sm">
                  Running test with example variables...
                </div>
              )}
              {testError && (
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 text-sm">
                  {testError}
                </div>
              )}
              {testResult && (
                <pre className="whitespace-pre-wrap text-sm text-zinc-800 dark:text-zinc-200 font-mono">
                  {testResult}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
