'use client';

import { useState } from 'react';
import { Check, Loader2, AlertCircle } from 'lucide-react';
import { Button, Input, Label } from '@magnetlab/magnetui';
import * as userApi from '@/frontend/api/user';

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
      await userApi.updateUsername(username.trim());
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
          <Label>Username</Label>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sm text-muted-foreground">magnetlab.app/p/</span>
            <Input
              type="text"
              value={username}
              onChange={(e) => handleUsernameChange(e.target.value)}
              placeholder="your-username"
              minLength={3}
              maxLength={30}
              className="flex-1"
            />
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            3-30 characters. Only lowercase letters, numbers, hyphens, and underscores.
          </p>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        <Button type="submit" disabled={saving || !username.trim() || username.length < 3}>
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : saved ? (
            <Check className="h-4 w-4" />
          ) : null}
          {saved ? 'Saved!' : 'Save Username'}
        </Button>
      </form>
    </div>
  );
}
