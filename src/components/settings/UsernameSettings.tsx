'use client';

import { useState } from 'react';
import { Check, Loader2, AlertCircle } from 'lucide-react';

interface UsernameSettingsProps {
  currentUsername: string | null;
}

export function UsernameSettings({ currentUsername }: UsernameSettingsProps) {
  const [username, setUsername] = useState(currentUsername || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;

    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      const response = await fetch('/api/user/username', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim() }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update username');
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update username');
    } finally {
      setSaving(false);
    }
  };

  const handleUsernameChange = (value: string) => {
    // Only allow lowercase letters, numbers, hyphens, and underscores
    const sanitized = value.toLowerCase().replace(/[^a-z0-9_-]/g, '');
    setUsername(sanitized);
    setError(null);
    setSaved(false);
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Username</h3>
        <p className="text-sm text-muted-foreground">
          Your username is used for your public funnel page URLs
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1.5">
            Username
          </label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">magnetlab.app/p/</span>
            <input
              type="text"
              value={username}
              onChange={(e) => handleUsernameChange(e.target.value)}
              placeholder="your-username"
              minLength={3}
              maxLength={30}
              className="flex-1 rounded-lg border border-border bg-muted/50 dark:bg-muted/20 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
            />
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            3-30 characters. Only lowercase letters, numbers, hyphens, and underscores.
          </p>
        </div>

        {error && (
          <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={saving || !username.trim() || username.length < 3}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : saved ? (
            <Check className="h-4 w-4" />
          ) : null}
          {saved ? 'Saved!' : 'Save Username'}
        </button>
      </form>
    </div>
  );
}
