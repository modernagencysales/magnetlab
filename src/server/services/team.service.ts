/**
 * Team Service (V1 team_members + activity)
 * Business logic for listing/inviting/removing members and activity log.
 */

import { checkTeamRole, hasMinimumRole } from '@/lib/auth/rbac';
import { logTeamActivity } from '@/lib/utils/activity-log';
import { sendEmail } from '@/lib/integrations/resend';
import { logError } from '@/lib/utils/logger';
import * as teamRepo from '@/server/repositories/team.repo';

export async function listMembers(ownerId: string) {
  const members = await teamRepo.listTeamMembersByOwner(ownerId);
  const memberIds = members.filter((m) => m.member_id).map((m) => m.member_id!);
  const memberMap = await teamRepo.getUsersByIds(memberIds);
  const enriched = members.map((m) => ({
    ...m,
    memberName: m.member_id ? memberMap[m.member_id]?.name ?? null : null,
    memberAvatar: m.member_id ? memberMap[m.member_id]?.avatar_url ?? null : null,
  }));
  return enriched;
}

export async function inviteMember(
  ownerId: string,
  email: string,
  ownerName: string,
): Promise<{ success: true; autoLinked: boolean } | { error: string }> {
  const ownerTeam = await teamRepo.getOwnerTeamByUserId(ownerId);
  if (ownerTeam) {
    const role = await checkTeamRole(ownerId, ownerTeam.id);
    if (!hasMinimumRole(role, 'owner')) {
      return { error: 'FORBIDDEN' };
    }
  }

  const existing = await teamRepo.getExistingInvite(ownerId, email);
  if (existing && existing.status !== 'removed') {
    return { error: 'CONFLICT' };
  }

  const existingUserId = await teamRepo.getUserIdByEmail(email);
  const status = existingUserId ? 'active' : 'pending';
  const memberId = existingUserId ?? null;
  const acceptedAt = existingUserId ? new Date().toISOString() : null;

  await teamRepo.upsertTeamMember(existing?.id ?? null, {
    owner_id: ownerId,
    email,
    status,
    member_id: memberId,
    accepted_at: acceptedAt,
  });

  sendEmail({
    to: email,
    subject: `${ownerName} invited you to their MagnetLab team`,
    html: `
      <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 500px; margin: 0 auto; padding: 32px 20px;">
        <h2 style="margin: 0 0 16px;">${ownerName} invited you to their team</h2>
        <p style="color: #666; line-height: 1.6;">
          You've been invited to view ${ownerName}'s lead magnet catalog on MagnetLab.
          ${existingUserId ? 'Log in to your existing account to get started.' : 'Create an account with this email to get started.'}
        </p>
        <a href="${process.env.NEXTAUTH_URL || 'https://magnetlab.app'}/login"
           style="display: inline-block; margin-top: 16px; padding: 12px 24px; background: #8b5cf6; color: white; text-decoration: none; border-radius: 8px; font-weight: 500;">
          ${existingUserId ? 'Log In' : 'Create Account'}
        </a>
      </div>
    `,
  }).catch((err) => logError('api/team', err, { step: 'send_invite_email' }));

  if (ownerTeam) {
    logTeamActivity({
      teamId: ownerTeam.id,
      userId: ownerId,
      action: 'member.invited',
      targetType: 'member',
      targetId: email,
      details: { email, autoLinked: !!existingUserId },
    });
  }

  return { success: true, autoLinked: !!existingUserId };
}

export async function getTeam(teamId: string, userId: string) {
  const role = await checkTeamRole(userId, teamId);
  if (!role) return null;
  const team = await teamRepo.getTeamById(teamId);
  return team ? { team } : null;
}

export async function removeMember(
  memberId: string,
  userId: string,
): Promise<{ success: true } | { error: string }> {
  const member = await teamRepo.getTeamMemberById(memberId);
  if (!member) return { error: 'NOT_FOUND' };
  if (member.owner_id !== userId) return { error: 'FORBIDDEN' };

  const ownerTeam = await teamRepo.getOwnerTeamByUserId(userId);
  if (ownerTeam) {
    const role = await checkTeamRole(userId, ownerTeam.id);
    if (!hasMinimumRole(role, 'owner')) return { error: 'FORBIDDEN' };
  }

  await teamRepo.deleteTeamMemberById(memberId);

  if (ownerTeam) {
    if (member.member_id) {
      await teamRepo.setTeamProfilesRemovedByUserId(ownerTeam.id, member.member_id);
    } else if (member.email) {
      await teamRepo.setTeamProfilesRemovedByEmail(ownerTeam.id, member.email);
    }
    logTeamActivity({
      teamId: ownerTeam.id,
      userId,
      action: 'member.removed',
      targetType: 'member',
      targetId: member.member_id || member.email,
      details: { email: member.email },
    });
  }

  return { success: true };
}

export async function getActivity(teamId: string, userId: string, limit: number, offset: number) {
  const role = await checkTeamRole(userId, teamId);
  if (!hasMinimumRole(role, 'member')) return null;
  const [activities, total] = await Promise.all([
    teamRepo.listTeamActivity(teamId, limit, offset),
    teamRepo.getTeamActivityCount(teamId),
  ]);
  return {
    activities: activities.map((a) => ({
      id: a.id,
      userId: a.user_id,
      action: a.action,
      targetType: a.target_type,
      targetId: a.target_id,
      details: a.details,
      createdAt: a.created_at,
    })),
    total,
  };
}
