'use client';

import { useState, useEffect } from 'react';
import { Users, Plus, Loader2, Trash2, CheckCircle, Clock } from 'lucide-react';
import { Button, Input, Badge } from '@magnetlab/magnetui';

import { logError } from '@/lib/utils/logger';
import * as teamsApi from '@/frontend/api/teams';

interface TeamProfile {
  id: string;
  email: string | null;
  full_name: string;
  status: 'pending' | 'active';
  created_at: string;
}

export function TeamMembersSettings() {
  const [profiles, setProfiles] = useState<TeamProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchProfiles = async () => {
    try {
      const data = await teamsApi.listProfiles();
      setProfiles(data as TeamProfile[]);
    } catch (err) {
      logError('settings/team-members', err, { step: 'failed_to_fetch_profiles' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfiles();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) return;

    setAdding(true);
    setError(null);
    setSuccess(null);

    try {
      await teamsApi.createProfile({
        full_name: fullName.trim(),
        email: email.trim() || null,
      });
      setFullName('');
      setEmail('');
      setSuccess(`${fullName.trim()} added to your team`);
      setTimeout(() => setSuccess(null), 5000);
      fetchProfiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add member');
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (profileId: string, name: string) => {
    if (!confirm(`Remove ${name} from your team?`)) return;

    setRemoving(profileId);
    try {
      await teamsApi.deleteProfile(profileId);
      setProfiles((prev) => prev.filter((p) => p.id !== profileId));
    } catch (err) {
      logError('settings/team-members', err, { step: 'remove_error' });
    } finally {
      setRemoving(null);
    }
  };

  return (
    <div className="rounded-lg border bg-card p-6 transition-colors">
      <div className="mb-4 flex items-center gap-3">
        <Users className="h-5 w-5 text-primary" />
        <div>
          <h2 className="text-lg font-semibold">Team Members</h2>
          <p className="text-sm text-muted-foreground">
            Add team members to your team profile catalog
          </p>
        </div>
      </div>

      {/* Add profile form */}
      <form onSubmit={handleAdd} className="mb-6 rounded-lg border border-border p-4">
        <p className="mb-3 text-sm font-medium">Add Team Member</p>
        <div className="flex gap-2">
          <Input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Full name (required)"
            className="flex-1"
          />
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email (optional)"
            className="flex-1"
          />
          <Button type="submit" disabled={adding || !fullName.trim()}>
            {adding ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Plus className="h-4 w-4" />
                Add
              </>
            )}
          </Button>
        </div>

        {error && (
          <p className="mt-2 text-sm text-destructive">{error}</p>
        )}

        {success && (
          <p className="mt-2 flex items-center gap-2 text-sm text-green-600">
            <CheckCircle className="h-4 w-4" />
            {success}
          </p>
        )}
      </form>

      {/* Profile list */}
      <div>
        <p className="mb-3 text-sm font-medium">Current Members</p>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : profiles.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No team members yet. Add someone above to get started.
          </p>
        ) : (
          <div className="space-y-2">
            {profiles.map((profile) => (
              <div
                key={profile.id}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm truncate">{profile.full_name}</p>
                    {profile.status === 'active' ? (
                      <Badge variant="green">
                        <CheckCircle className="h-3 w-3" />
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="orange">
                        <Clock className="h-3 w-3" />
                        Pending
                      </Badge>
                    )}
                  </div>
                  {profile.email && (
                    <p className="text-xs text-muted-foreground mt-1">{profile.email}</p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => handleRemove(profile.id, profile.full_name)}
                  disabled={removing === profile.id}
                  className="ml-4 text-destructive hover:opacity-80"
                >
                  {removing === profile.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
