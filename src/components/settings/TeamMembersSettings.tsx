'use client';

import { useState, useEffect } from 'react';
import { Users, Plus, Loader2, Trash2, CheckCircle, Clock, XCircle } from 'lucide-react';
import { Button, Input, Badge } from '@magnetlab/magnetui';

import { logError } from '@/lib/utils/logger';
import * as teamApi from '@/frontend/api/team';

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
      const data = await teamApi.listTeamMembers();
      setMembers(data as TeamMember[]);
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
      const data = (await teamApi.inviteTeamMember(email.trim())) as { autoLinked?: boolean };
      setEmail('');
      setSuccess(
        data.autoLinked
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
      await teamApi.removeTeamMember(memberId);
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
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
      <form onSubmit={handleInvite} className="mb-6 rounded-lg border border-border p-4">
        <p className="mb-3 text-sm font-medium">Invite by Email</p>
        <div className="flex gap-2">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="teammate@example.com"
            className="flex-1"
          />
          <Button type="submit" disabled={inviting || !email.trim()}>
            {inviting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Plus className="h-4 w-4" />
                Invite
              </>
            )}
          </Button>
        </div>

        {error && (
          <p className="mt-2 flex items-center gap-2 text-sm text-destructive">
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
                  <div className="flex items-center gap-3 mt-1">
                    {member.memberName && (
                      <span className="text-xs text-muted-foreground">{member.email}</span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      Invited {new Date(member.invited_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => handleRemove(member.id, member.email)}
                  disabled={removing === member.id}
                  className="ml-4 text-destructive hover:opacity-80"
                >
                  {removing === member.id ? (
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
