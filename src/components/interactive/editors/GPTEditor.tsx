'use client';

import { Plus, Trash2 } from 'lucide-react';
import type { GPTConfig } from '@/lib/types/lead-magnet';

interface GPTEditorProps {
  config: GPTConfig;
  onChange: (config: GPTConfig) => void;
}

export function GPTEditor({ config, onChange }: GPTEditorProps) {
  const update = (partial: Partial<GPTConfig>) => {
    onChange({ ...config, ...partial });
  };

  const updatePrompt = (index: number, value: string) => {
    const prompts = [...config.suggestedPrompts];
    prompts[index] = value;
    update({ suggestedPrompts: prompts });
  };

  const addPrompt = () => {
    update({ suggestedPrompts: [...config.suggestedPrompts, ''] });
  };

  const removePrompt = (index: number) => {
    const prompts = config.suggestedPrompts.filter((_, i) => i !== index);
    update({ suggestedPrompts: prompts });
  };

  return (
    <div className="space-y-8">
      {/* Name & Description */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Basics</h3>
        <div>
          <label className="mb-1 block text-sm font-medium">Name</label>
          <input
            type="text"
            value={config.name}
            onChange={(e) => update({ name: e.target.value })}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Description</label>
          <textarea
            value={config.description}
            onChange={(e) => update({ description: e.target.value })}
            rows={3}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      {/* System Prompt */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          System Prompt
        </h3>
        <div>
          <label className="mb-1 block text-sm font-medium">Instructions for the AI</label>
          <textarea
            value={config.systemPrompt}
            onChange={(e) => update({ systemPrompt: e.target.value })}
            rows={8}
            className="w-full rounded-lg border bg-background px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="You are a helpful expert in... Your role is to..."
          />
          <p className="mt-1 text-xs text-muted-foreground">
            This defines the AI&apos;s personality, expertise, and behavior. Your audience won&apos;t see this directly.
          </p>
        </div>
      </div>

      {/* Welcome Message */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Welcome Message
        </h3>
        <div>
          <label className="mb-1 block text-sm font-medium">First message shown to the user</label>
          <textarea
            value={config.welcomeMessage}
            onChange={(e) => update({ welcomeMessage: e.target.value })}
            rows={4}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Welcome! I'm here to help you with..."
          />
        </div>
      </div>

      {/* Suggested Prompts */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Suggested Prompts
          </h3>
          <button
            type="button"
            onClick={addPrompt}
            className="flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium hover:bg-secondary"
          >
            <Plus className="h-3 w-3" />
            Add Prompt
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          These appear as clickable suggestions to help users get started.
        </p>

        <div className="space-y-2">
          {config.suggestedPrompts.map((prompt, index) => (
            <div key={index} className="flex items-center gap-2">
              <input
                type="text"
                value={prompt}
                onChange={(e) => updatePrompt(index, e.target.value)}
                placeholder={`Suggested prompt ${index + 1}`}
                className="flex-1 rounded-lg border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                type="button"
                onClick={() => removePrompt(index)}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}

          {config.suggestedPrompts.length === 0 && (
            <p className="py-3 text-center text-sm text-muted-foreground">
              No suggested prompts yet. Add some to help your audience get started.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
