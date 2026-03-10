'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Brain, Plus, Trash2 } from 'lucide-react';
import { Button, Badge, Input, EmptyState, Skeleton } from '@magnetlab/magnetui';

interface Memory {
  id: string;
  rule: string;
  category: string;
  confidence: number;
  source: string;
  active: boolean;
  created_at: string;
}

const CATEGORY_VARIANTS: Record<string, 'blue' | 'purple' | 'orange' | 'green' | 'gray'> = {
  tone: 'blue',
  structure: 'purple',
  vocabulary: 'orange',
  content: 'green',
  general: 'gray',
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
    } catch {
      /* ignore */
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadMemories();
  }, [loadMemories]);

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
    setMemories((prev) => prev.map((m) => (m.id === id ? { ...m, active: !active } : m)));
  };

  const deleteMemory = async (id: string) => {
    await fetch(`/api/copilot/memories/${id}`, { method: 'DELETE' });
    setMemories((prev) => prev.filter((m) => m.id !== id));
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">Learned Preferences</h2>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setShowAddForm(!showAddForm)}>
          <Plus className="w-4 h-4 mr-1" />
          Add Preference
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        These preferences are automatically learned from your conversations with the co-pilot. You
        can also add them manually. Active preferences are included in every co-pilot prompt.
      </p>

      {showAddForm && (
        <div className="flex items-center gap-2 p-3 rounded-lg border bg-muted/50">
          <Input
            value={newRule}
            onChange={(e) => setNewRule(e.target.value)}
            placeholder="e.g., Never use bullet points in posts"
            maxLength={200}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addMemory();
            }}
            className="flex-1"
          />
          <select
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            className="text-sm px-2 py-1.5 rounded border border-input bg-background"
          >
            <option value="general">General</option>
            <option value="tone">Tone</option>
            <option value="structure">Structure</option>
            <option value="vocabulary">Vocabulary</option>
            <option value="content">Content</option>
          </select>
          <Button size="sm" onClick={addMemory}>
            Save
          </Button>
        </div>
      )}

      {memories.length === 0 ? (
        <EmptyState
          icon={<Brain />}
          title="No learned preferences yet"
          description="The co-pilot will learn your preferences as you interact with it, or you can add them manually above."
        />
      ) : (
        <div className="space-y-2">
          {memories.map((m) => (
            <div
              key={m.id}
              className={`flex items-center justify-between p-3 rounded-lg border ${
                m.active ? 'bg-card' : 'bg-muted/50 opacity-60'
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <Badge variant={CATEGORY_VARIANTS[m.category] || 'gray'}>{m.category}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {m.source === 'manual' ? 'manual' : 'auto-learned'}
                  </span>
                </div>
                <p className="text-sm truncate">{m.rule}</p>
              </div>
              <div className="flex items-center gap-1 ml-2 shrink-0">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => toggleMemory(m.id, m.active)}
                  aria-label={m.active ? 'Deactivate' : 'Activate'}
                  className={m.active ? 'text-primary' : 'text-muted-foreground'}
                >
                  <div
                    className={`w-8 h-4 rounded-full relative transition-colors ${m.active ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                  >
                    <div
                      className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${m.active ? 'left-4' : 'left-0.5'}`}
                    />
                  </div>
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => deleteMemory(m.id)}
                  aria-label="Delete"
                  className="text-muted-foreground hover:text-red-500"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
