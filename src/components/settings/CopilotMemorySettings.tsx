'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Brain, Plus, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';

interface Memory {
  id: string;
  rule: string;
  category: string;
  confidence: number;
  source: string;
  active: boolean;
  created_at: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  tone: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  structure: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  vocabulary: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  content: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  general: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-900/30 dark:text-zinc-300',
};

export function CopilotMemorySettings() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newRule, setNewRule] = useState('');
  const [newCategory, setNewCategory] = useState('general');

  const loadMemories = useCallback(async () => {
    try {
      const res = await fetch('/api/copilot/memories');
      if (res.ok) {
        const data = await res.json();
        setMemories(data.memories || []);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { loadMemories(); }, [loadMemories]);

  const addMemory = async () => {
    if (!newRule.trim()) return;

    const res = await fetch('/api/copilot/memories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rule: newRule.trim(), category: newCategory }),
    });

    if (res.ok) {
      setNewRule('');
      setShowAddForm(false);
      loadMemories();
    }
  };

  const toggleMemory = async (id: string, active: boolean) => {
    await fetch(`/api/copilot/memories/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !active }),
    });
    setMemories(prev => prev.map(m => m.id === id ? { ...m, active: !active } : m));
  };

  const deleteMemory = async (id: string) => {
    await fetch(`/api/copilot/memories/${id}`, { method: 'DELETE' });
    setMemories(prev => prev.filter(m => m.id !== id));
  };

  if (loading) {
    return <div className="text-sm text-zinc-500">Loading preferences...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-violet-600" />
          <h2 className="text-lg font-semibold">Learned Preferences</h2>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-1 text-sm text-violet-600 hover:text-violet-700"
        >
          <Plus className="w-4 h-4" />
          Add Preference
        </button>
      </div>

      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        These preferences are automatically learned from your conversations with the co-pilot. You can also add them manually. Active preferences are included in every co-pilot prompt.
      </p>

      {showAddForm && (
        <div className="flex items-center gap-2 p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50">
          <input
            type="text"
            value={newRule}
            onChange={(e) => setNewRule(e.target.value)}
            placeholder="e.g., Never use bullet points in posts"
            className="flex-1 text-sm px-3 py-1.5 rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 focus:outline-none focus:ring-1 focus:ring-violet-500"
            maxLength={200}
            onKeyDown={(e) => { if (e.key === 'Enter') addMemory(); }}
          />
          <select
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            className="text-sm px-2 py-1.5 rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800"
          >
            <option value="general">General</option>
            <option value="tone">Tone</option>
            <option value="structure">Structure</option>
            <option value="vocabulary">Vocabulary</option>
            <option value="content">Content</option>
          </select>
          <button
            onClick={addMemory}
            className="px-3 py-1.5 text-sm bg-violet-600 text-white rounded hover:bg-violet-700"
          >
            Save
          </button>
        </div>
      )}

      {memories.length === 0 ? (
        <div className="text-center py-8 text-sm text-zinc-500 dark:text-zinc-400">
          No learned preferences yet. The co-pilot will learn your preferences as you interact with it, or you can add them manually above.
        </div>
      ) : (
        <div className="space-y-2">
          {memories.map(m => (
            <div
              key={m.id}
              className={`flex items-center justify-between p-3 rounded-lg border ${
                m.active
                  ? 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800'
                  : 'border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 opacity-60'
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${CATEGORY_COLORS[m.category] || CATEGORY_COLORS.general}`}>
                    {m.category}
                  </span>
                  <span className="text-xs text-zinc-400">
                    {m.source === 'manual' ? 'manual' : 'auto-learned'}
                  </span>
                </div>
                <p className="text-sm text-zinc-900 dark:text-zinc-100 truncate">{m.rule}</p>
              </div>
              <div className="flex items-center gap-1 ml-2 shrink-0">
                <button
                  onClick={() => toggleMemory(m.id, m.active)}
                  className="p-1 text-zinc-400 hover:text-zinc-600"
                  aria-label={m.active ? 'Deactivate' : 'Activate'}
                >
                  {m.active ? <ToggleRight className="w-4 h-4 text-violet-600" /> : <ToggleLeft className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => deleteMemory(m.id)}
                  className="p-1 text-zinc-400 hover:text-red-500"
                  aria-label="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
