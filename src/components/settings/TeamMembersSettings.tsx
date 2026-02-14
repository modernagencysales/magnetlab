'use client';

import { useState, useEffect } from 'react';
import { Users, Plus, Loader2, Trash2, CheckCircle, Clock, XCircle } from 'lucide-react';

import { logError } from '@/lib/utils/logger';

interface TeamMember {
  id: string;
  email: string;
  status: 'pending' | 'active';
  invited_at: string;
  accepted_at: string | null;
  memberName: string | null;
  memberAvatar: string | null;
}

export function TeamMembersSettings() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchMembers = async () => {
    try {
      const res = await fetch('/api/team');
      if (res.ok) {
        const data = await res.json();
        setMembers(data);
      }
    } catch (err) {
      logError('settings/team-members', err, { step: 'failed_to_fetch_team_members' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setInviting(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch('/api/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to invite');
      }

      setEmail('');
      setSuccess(data.autoLinked
        ? `${email.trim()} added to your team (existing account linked automatically)`
        : `Invitation sent to ${email.trim()}`
      );
      setTimeout(() => setSuccess(null), 5000);
      fetchMembers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to invite');
    } finally {
      setInviting(false);
    }
  };

  const handleRemove = async (memberId: string, memberEmail: string) => {
    if (!confirm(`Remove ${memberEmail} from your team?`)) return;

    setRemoving(memberId);
    try {
      const res = await fetch(`/api/team/${memberId}`, { method: 'DELETE' });
      if (!res.ok) {
        throw new Error('Failed to remove');
      }
      setMembers(prev => prev.filter(m => m.id !== memberId));
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
            Invite team members to view your lead magnet catalog
          </p>
        </div>
      </div>

      {/* Invite form */}
      <form onSubmit={handleInvite} className="mb-6 rounded-lg border p-4">
        <p className="mb-3 text-sm font-medium">Invite by Email</p>
        <div className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="teammate@example.com"
            className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
          />
          <button
            type="submit"
            disabled={inviting || !email.trim()}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {inviting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Plus className="h-4 w-4" />
                Invite
              </>
            )}
          </button>
        </div>

        {error && (
          <p className="mt-2 flex items-center gap-2 text-sm text-red-500">
            <XCircle className="h-4 w-4" />
            {error}
          </p>
        )}

        {success && (
          <p className="mt-2 flex items-center gap-2 text-sm text-green-600">
            <CheckCircle className="h-4 w-4" />
            {success}
          </p>
        )}
      </form>

      {/* Member list */}
      <div>
        <p className="mb-3 text-sm font-medium">Current Members</p>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : members.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No team members yet. Invite someone above to get started.
          </p>
        ) : (
          <div className="space-y-2">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm truncate">
                      {member.memberName || member.email}
                    </p>
                    {member.status === 'active' ? (
                      <span className="flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        <CheckCircle className="h-3 w-3" />
                        Active
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-xs text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                        <Clock className="h-3 w-3" />
                        Pending
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    {member.memberName && (
                      <span className="text-xs text-muted-foreground">{member.email}</span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      Invited {new Date(member.invited_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => handleRemove(member.id, member.email)}
                  disabled={removing === member.id}
                  className="ml-4 flex items-center gap-1 text-sm text-red-500 hover:text-red-600 transition-colors"
                >
                  {removing === member.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
