'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, ArrowLeft, Loader2, Settings, Users as UsersIcon, Link2, UserPlus } from 'lucide-react';
import type { Team, TeamProfile, TeamVoiceProfile, TeamMember, TeamLink } from '@/lib/types/content-pipeline';

import {
  PageContainer,
  PageTitle,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  EmptyState,
  FormField,
  SectionContainer,
  Avatar,
  AvatarImage,
  AvatarFallback,
  LoadingCard,
  Input,
} from '@magnetlab/magnetui';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@magnetlab/magnetui';

import { logError } from '@/lib/utils/logger';
import * as teamsApi from '@/frontend/api/teams';

// ─── Local types ──────────────────────────────────────────────────────────────

interface TeamMembership {
  id: string;
  teamId: string;
  teamName: string;
  ownerId: string;
  role: 'owner' | 'member';
}

interface ProfileFormData {
  full_name: string;
  email: string;
  title: string;
  linkedin_url: string;
  bio: string;
  expertise_areas: string[];
  voice_profile: TeamVoiceProfile;
}

interface TeamLinkWithNames extends TeamLink {
  agencyTeamName?: string;
  clientTeamName?: string;
  direction?: 'agency' | 'client';
}

type ManageTab = 'members' | 'profiles' | 'links';

// ─── Constants ────────────────────────────────────────────────────────────────

const emptyForm: ProfileFormData = {
  full_name: '',
  email: '',
  title: '',
  linkedin_url: '',
  bio: '',
  expertise_areas: [],
  voice_profile: {},
};

// ─── Page component ───────────────────────────────────────────────────────────

export default function TeamPage() {
  const router = useRouter();
  const [memberships, setMemberships] = useState<TeamMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Create team form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamIndustry, setNewTeamIndustry] = useState('');
  const [newTeamGoal, setNewTeamGoal] = useState('');

  // Manage team state
  const [managingTeam, setManagingTeam] = useState<Team | null>(null);
  const [manageTab, setManageTab] = useState<ManageTab>('members');
  const [teamName, setTeamName] = useState('');
  const [teamIndustry, setTeamIndustry] = useState('');
  const [teamGoal, setTeamGoal] = useState('');

  // Members tab state
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [showAddMemberForm, setShowAddMemberForm] = useState(false);
  const [newMemberUserId, setNewMemberUserId] = useState('');

  // Profiles tab state
  const [profiles, setProfiles] = useState<TeamProfile[]>([]);
  const [editingProfile, setEditingProfile] = useState<TeamProfile | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileForm, setProfileForm] = useState<ProfileFormData>(emptyForm);

  // Linked Teams tab state
  const [teamLinks, setTeamLinks] = useState<TeamLinkWithNames[]>([]);
  const [showAddLinkForm, setShowAddLinkForm] = useState(false);
  const [newLinkAgencyTeamId, setNewLinkAgencyTeamId] = useState('');
  const [newLinkClientTeamId, setNewLinkClientTeamId] = useState('');

  const [teamCache, setTeamCache] = useState<Record<string, Team>>({});

  // ─── Data fetching ──────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await teamsApi.listTeams();
      const allEntries = [
        ...((data as { owned?: unknown[] }).owned ?? []),
        ...((data as { member?: unknown[] }).member ?? []),
      ] as Array<{ team: Team; role: 'owner' | 'member' }>;
      const normalized: TeamMembership[] = allEntries.map((e) => ({
        id: e.team.id,
        teamId: e.team.id,
        teamName: e.team.name,
        ownerId: e.team.owner_id,
        role: e.role,
      }));
      setMemberships(normalized);
      const cache: Record<string, Team> = {};
      for (const e of allEntries) cache[e.team.id] = e.team;
      setTeamCache(cache);
    } catch (err) {
      logError('dashboard/team', err, { step: 'failed_to_fetch_team_data' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const loadManageData = useCallback(
    async (teamId: string) => {
      setError(null);
      try {
        const [profilesList, membersData, linksData] = await Promise.all([
          teamsApi.listProfiles(),
          teamsApi.listMembers(teamId),
          teamsApi.listTeamLinks(),
        ]);

        const teamProfiles = (profilesList || []).filter(
          (p: unknown) => (p as TeamProfile).team_id === teamId
        );
        setProfiles(teamProfiles as TeamProfile[]);

        const membersArr = ((membersData as { members?: TeamMember[] })?.members ?? []) as TeamMember[];
        setMembers(membersArr);

        // Annotate links with direction and team names
        const rawLinks = ((linksData as { links?: TeamLink[] })?.links ?? []) as TeamLink[];
        const annotated: TeamLinkWithNames[] = rawLinks.map((link) => {
          const agencyTeam = teamCache[link.agency_team_id];
          const clientTeam = teamCache[link.client_team_id];
          return {
            ...link,
            agencyTeamName: agencyTeam?.name ?? link.agency_team_id,
            clientTeamName: clientTeam?.name ?? link.client_team_id,
            direction: link.agency_team_id === teamId ? 'agency' : 'client',
          };
        });
        setTeamLinks(annotated);
      } catch (err) {
        logError('dashboard/team', err, { step: 'failed_to_load_manage_data' });
        setError('Failed to load team details');
      }
    },
    [teamCache]
  );

  // ─── Team CRUD ──────────────────────────────────────────────────────────────

  const enterTeam = (teamId: string) => {
    document.cookie = `ml-team-context=${teamId}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
    router.refresh();
    router.push('/');
  };

  const createTeam = async () => {
    if (!newTeamName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await teamsApi.createTeam({
        name: newTeamName,
        industry: newTeamIndustry || undefined,
        shared_goal: newTeamGoal || undefined,
      });
      setSuccess('Team created successfully');
      setShowCreateForm(false);
      setNewTeamName('');
      setNewTeamIndustry('');
      setNewTeamGoal('');
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create team');
    } finally {
      setSaving(false);
    }
  };

  const openManage = async (teamId: string) => {
    setError(null);
    setSuccess(null);
    setManageTab('members');
    const team = teamCache[teamId] ?? null;
    if (team) {
      setManagingTeam(team);
      setTeamName(team.name);
      setTeamIndustry(team.industry || '');
      setTeamGoal(team.shared_goal || '');
    }
    await loadManageData(teamId);
  };

  const updateTeam = async () => {
    if (!managingTeam) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await teamsApi.updateTeam({
        team_id: managingTeam.id,
        name: teamName,
        industry: teamIndustry || undefined,
        shared_goal: teamGoal || undefined,
      });
      setSuccess('Settings saved');
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  // ─── Members actions ────────────────────────────────────────────────────────

  const addMember = async () => {
    if (!managingTeam || !newMemberUserId.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await teamsApi.addMember(managingTeam.id, newMemberUserId.trim());
      setSuccess('Member added');
      setShowAddMemberForm(false);
      setNewMemberUserId('');
      await loadManageData(managingTeam.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add member');
    } finally {
      setSaving(false);
    }
  };

  const removeMember = async (userId: string) => {
    if (!managingTeam || !confirm('Remove this member from the team?')) return;
    try {
      await teamsApi.removeMember(managingTeam.id, userId);
      setSuccess('Member removed');
      await loadManageData(managingTeam.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove member');
    }
  };

  // ─── Profiles actions ───────────────────────────────────────────────────────

  const openProfileModal = (profile?: TeamProfile) => {
    if (profile) {
      setEditingProfile(profile);
      setProfileForm({
        full_name: profile.full_name,
        email: profile.email || '',
        title: profile.title || '',
        linkedin_url: profile.linkedin_url || '',
        bio: profile.bio || '',
        expertise_areas: profile.expertise_areas || [],
        voice_profile: profile.voice_profile || {},
      });
    } else {
      setEditingProfile(null);
      setProfileForm(emptyForm);
    }
    setShowProfileModal(true);
  };

  const saveProfile = async () => {
    if (!profileForm.full_name.trim()) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      if (editingProfile) {
        await teamsApi.updateProfile(
          editingProfile.id,
          profileForm as unknown as Record<string, unknown>
        );
      } else {
        await teamsApi.createProfile(profileForm as teamsApi.CreateProfileBody);
      }
      setSuccess(editingProfile ? 'Profile updated' : 'Profile added');
      setShowProfileModal(false);
      if (managingTeam) await loadManageData(managingTeam.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const removeProfile = async (id: string) => {
    if (!confirm('Remove this profile?')) return;
    try {
      await teamsApi.deleteProfile(id);
      if (managingTeam) await loadManageData(managingTeam.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove profile');
    }
  };

  // ─── Team Links actions ─────────────────────────────────────────────────────

  const createLink = async () => {
    if (!newLinkAgencyTeamId.trim() || !newLinkClientTeamId.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await teamsApi.createTeamLink(newLinkAgencyTeamId.trim(), newLinkClientTeamId.trim());
      setSuccess('Team link created');
      setShowAddLinkForm(false);
      setNewLinkAgencyTeamId('');
      setNewLinkClientTeamId('');
      if (managingTeam) await loadManageData(managingTeam.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create team link');
    } finally {
      setSaving(false);
    }
  };

  const severLink = async (linkId: string) => {
    if (!managingTeam || !confirm('Sever this team link?')) return;
    try {
      await teamsApi.deleteTeamLink(linkId);
      setSuccess('Team link removed');
      await loadManageData(managingTeam.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove team link');
    }
  };

  // ─── Loading state ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <PageContainer maxWidth="xl">
        <LoadingCard count={3} />
      </PageContainer>
    );
  }

  // ─── Managing a specific team ───────────────────────────────────────────────

  if (managingTeam) {
    const isOwner = memberships.find((m) => m.teamId === managingTeam.id)?.role === 'owner';

    return (
      <PageContainer maxWidth="xl">
        <Button variant="ghost" size="sm" onClick={() => setManagingTeam(null)} className="mb-2">
          <ArrowLeft className="h-3.5 w-3.5 mr-1" />
          Back to all teams
        </Button>

        <PageTitle
          title={managingTeam.name}
          description="Manage team members, profiles, and linked teams."
          actions={
            <Button onClick={() => enterTeam(managingTeam.id)} size="sm">
              Enter Team
            </Button>
          }
        />

        {error && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950 p-3 text-sm text-emerald-700 dark:text-emerald-400">
            {success}
          </div>
        )}

        <div className="space-y-6">
          {/* Team Settings (owner only) */}
          {isOwner && (
            <SectionContainer title="Team Settings">
              <Card>
                <CardContent className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField label="Team Name" htmlFor="team-name">
                      <Input
                        id="team-name"
                        value={teamName}
                        onChange={(e) => setTeamName(e.target.value)}
                      />
                    </FormField>
                    <FormField label="Industry" htmlFor="team-industry">
                      <Input
                        id="team-industry"
                        value={teamIndustry}
                        onChange={(e) => setTeamIndustry(e.target.value)}
                      />
                    </FormField>
                    <FormField label="Shared Goal" htmlFor="team-goal">
                      <Input
                        id="team-goal"
                        value={teamGoal}
                        onChange={(e) => setTeamGoal(e.target.value)}
                      />
                    </FormField>
                  </div>
                  <Button onClick={updateTeam} disabled={saving} size="sm" className="mt-4">
                    {saving ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                        Saving...
                      </>
                    ) : (
                      'Save Settings'
                    )}
                  </Button>
                </CardContent>
              </Card>
            </SectionContainer>
          )}

          {/* Tabbed sections: Members / Profiles / Linked Teams */}
          <div>
            {/* Tab bar */}
            <div className="flex gap-1 border-b border-border mb-4">
              {(['members', 'profiles', 'links'] as ManageTab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setManageTab(tab)}
                  className={`px-4 py-2 text-sm font-medium capitalize border-b-2 -mb-px transition-colors ${
                    manageTab === tab
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tab === 'links' ? 'Linked Teams' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            {/* Tab: Members */}
            {manageTab === 'members' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Users who can work in this team.
                  </p>
                  {isOwner && (
                    <Button size="sm" onClick={() => setShowAddMemberForm((v) => !v)}>
                      <UserPlus className="h-3.5 w-3.5 mr-1" />
                      Add Member
                    </Button>
                  )}
                </div>

                {showAddMemberForm && isOwner && (
                  <Card>
                    <CardContent className="p-4 space-y-3">
                      <FormField label="User ID" hint="The user's UUID from their account">
                        <Input
                          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                          value={newMemberUserId}
                          onChange={(e) => setNewMemberUserId(e.target.value)}
                        />
                      </FormField>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={addMember}
                          disabled={!newMemberUserId.trim() || saving}
                        >
                          {saving ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                              Adding...
                            </>
                          ) : (
                            'Add Member'
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setShowAddMemberForm(false);
                            setNewMemberUserId('');
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {members.length === 0 ? (
                  <EmptyState
                    icon={<UsersIcon />}
                    title="No members yet"
                    description="Add team members to collaborate on content."
                  />
                ) : (
                  <div className="space-y-2">
                    {members.map((member) => (
                      <Card key={member.id}>
                        <CardContent className="p-3 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Avatar size="sm">
                              <AvatarFallback name={member.user_id}>
                                {member.user_id.substring(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm font-medium">{member.user_id}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <Badge variant={member.role === 'owner' ? 'blue' : 'gray'}>
                                  {member.role}
                                </Badge>
                                {member.status !== 'active' && (
                                  <Badge variant="orange">{member.status}</Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          {isOwner && member.role !== 'owner' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => removeMember(member.user_id)}
                              className="text-destructive hover:bg-destructive/10"
                            >
                              Remove
                            </Button>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab: Profiles */}
            {manageTab === 'profiles' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Personas that content is published as.
                  </p>
                  {isOwner && (
                    <Button size="sm" onClick={() => openProfileModal()}>
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Add Profile
                    </Button>
                  )}
                </div>

                {profiles.length === 0 ? (
                  <EmptyState
                    icon={<UsersIcon />}
                    title="No profiles yet"
                    description="Add a profile to start publishing content under a persona."
                  />
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {profiles.map((profile) => (
                      <Card key={profile.id}>
                        <CardContent className="p-4">
                          {profile.is_default && (
                            <Badge variant="blue" className="mb-2">
                              Default
                            </Badge>
                          )}
                          <div className="flex items-center gap-3 mb-3">
                            <Avatar size="sm">
                              {profile.avatar_url ? (
                                <AvatarImage src={profile.avatar_url} alt="" />
                              ) : null}
                              <AvatarFallback name={profile.full_name}>
                                {profile.full_name.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{profile.full_name}</p>
                              <p className="text-xs text-muted-foreground">
                                {profile.title || 'No title'}
                              </p>
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground mb-3">
                            {profile.email || 'No email'}
                            <span className="mx-1.5">·</span>
                            <Badge variant={profile.status === 'active' ? 'green' : 'orange'}>
                              {profile.status}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mb-3">
                            Voice:{' '}
                            {profile.voice_profile?.tone
                              ? profile.voice_profile.tone
                              : 'Not configured'}
                          </p>
                          {profile.linkedin_url && (
                            <p className="text-xs text-muted-foreground truncate mb-3">
                              {profile.linkedin_url}
                            </p>
                          )}
                          {isOwner && (
                            <div className="flex gap-1.5">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openProfileModal(profile)}
                              >
                                Edit
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => removeProfile(profile.id)}
                                className="text-destructive hover:bg-destructive/10"
                              >
                                Remove
                              </Button>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab: Linked Teams */}
            {manageTab === 'links' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Agency-to-client relationships for shared access.
                  </p>
                  {isOwner && (
                    <Button size="sm" onClick={() => setShowAddLinkForm((v) => !v)}>
                      <Link2 className="h-3.5 w-3.5 mr-1" />
                      Link Team
                    </Button>
                  )}
                </div>

                {showAddLinkForm && isOwner && (
                  <Card>
                    <CardContent className="p-4 space-y-3">
                      <FormField label="Agency Team ID" hint="The UUID of the agency team">
                        <Input
                          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                          value={newLinkAgencyTeamId}
                          onChange={(e) => setNewLinkAgencyTeamId(e.target.value)}
                        />
                      </FormField>
                      <FormField label="Client Team ID" hint="The UUID of the client team">
                        <Input
                          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                          value={newLinkClientTeamId}
                          onChange={(e) => setNewLinkClientTeamId(e.target.value)}
                        />
                      </FormField>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={createLink}
                          disabled={
                            !newLinkAgencyTeamId.trim() || !newLinkClientTeamId.trim() || saving
                          }
                        >
                          {saving ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                              Linking...
                            </>
                          ) : (
                            'Create Link'
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setShowAddLinkForm(false);
                            setNewLinkAgencyTeamId('');
                            setNewLinkClientTeamId('');
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {teamLinks.length === 0 ? (
                  <EmptyState
                    icon={<Link2 />}
                    title="No linked teams"
                    description="Link an agency and client team to share access."
                  />
                ) : (
                  <div className="space-y-2">
                    {teamLinks.map((link) => (
                      <Card key={link.id}>
                        <CardContent className="p-3 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center">
                              <Link2 className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div>
                              <p className="text-sm font-medium">
                                {link.agencyTeamName}{' '}
                                <span className="text-muted-foreground font-normal">→</span>{' '}
                                {link.clientTeamName}
                              </p>
                              <Badge
                                variant={link.direction === 'agency' ? 'blue' : 'green'}
                                className="mt-0.5"
                              >
                                {link.direction === 'agency' ? 'You are agency' : 'You are client'}
                              </Badge>
                            </div>
                          </div>
                          {isOwner && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => severLink(link.id)}
                              className="text-destructive hover:bg-destructive/10"
                            >
                              Sever
                            </Button>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Profile Editor Modal — Details + Voice Profile tabs, no role field */}
        <Dialog
          open={showProfileModal}
          onOpenChange={(open) => !open && setShowProfileModal(false)}
        >
          <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingProfile ? 'Edit Profile' : 'Add Profile'}</DialogTitle>
            </DialogHeader>

            <Tabs defaultValue="details">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="voice">Voice Profile</TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="space-y-4 mt-4">
                <FormField label="Full Name" required>
                  <Input
                    value={profileForm.full_name}
                    onChange={(e) => setProfileForm((f) => ({ ...f, full_name: e.target.value }))}
                  />
                </FormField>
                <FormField label="Email">
                  <Input
                    type="email"
                    value={profileForm.email}
                    onChange={(e) => setProfileForm((f) => ({ ...f, email: e.target.value }))}
                  />
                </FormField>
                <FormField label="Title">
                  <Input
                    placeholder="e.g. CEO, Head of Sales"
                    value={profileForm.title}
                    onChange={(e) => setProfileForm((f) => ({ ...f, title: e.target.value }))}
                  />
                </FormField>
                <FormField label="LinkedIn URL">
                  <Input
                    type="url"
                    placeholder="https://linkedin.com/in/..."
                    value={profileForm.linkedin_url}
                    onChange={(e) =>
                      setProfileForm((f) => ({ ...f, linkedin_url: e.target.value }))
                    }
                  />
                </FormField>
                <FormField label="Bio">
                  <textarea
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    rows={3}
                    placeholder="Background, expertise, what they're known for..."
                    value={profileForm.bio}
                    onChange={(e) => setProfileForm((f) => ({ ...f, bio: e.target.value }))}
                  />
                </FormField>
                <FormField label="Expertise Areas" hint="Comma separated">
                  <Input
                    placeholder="Sales, Marketing, AI"
                    value={profileForm.expertise_areas.join(', ')}
                    onChange={(e) =>
                      setProfileForm((f) => ({
                        ...f,
                        expertise_areas: e.target.value
                          .split(',')
                          .map((s) => s.trim())
                          .filter(Boolean),
                      }))
                    }
                  />
                </FormField>
              </TabsContent>

              <TabsContent value="voice" className="space-y-4 mt-4">
                <FormField
                  label="First-Person Context"
                  hint='The AI will use this as the "I" perspective when writing posts.'
                >
                  <textarea
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    rows={3}
                    placeholder="I'm a 15-year agency veteran who's scaled 3 businesses..."
                    value={profileForm.voice_profile.first_person_context || ''}
                    onChange={(e) =>
                      setProfileForm((f) => ({
                        ...f,
                        voice_profile: { ...f.voice_profile, first_person_context: e.target.value },
                      }))
                    }
                  />
                </FormField>
                <FormField label="Perspective Notes">
                  <textarea
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    rows={2}
                    placeholder="Speaks from hands-on experience building sales teams"
                    value={profileForm.voice_profile.perspective_notes || ''}
                    onChange={(e) =>
                      setProfileForm((f) => ({
                        ...f,
                        voice_profile: { ...f.voice_profile, perspective_notes: e.target.value },
                      }))
                    }
                  />
                </FormField>
                <FormField label="Tone">
                  <Input
                    placeholder="Direct, warm, slightly irreverent"
                    value={profileForm.voice_profile.tone || ''}
                    onChange={(e) =>
                      setProfileForm((f) => ({
                        ...f,
                        voice_profile: { ...f.voice_profile, tone: e.target.value },
                      }))
                    }
                  />
                </FormField>
                <FormField label="Signature Phrases" hint="Comma separated">
                  <Input
                    placeholder="Phrases this person naturally uses"
                    value={(profileForm.voice_profile.signature_phrases || []).join(', ')}
                    onChange={(e) =>
                      setProfileForm((f) => ({
                        ...f,
                        voice_profile: {
                          ...f.voice_profile,
                          signature_phrases: e.target.value
                            .split(',')
                            .map((s) => s.trim())
                            .filter(Boolean),
                        },
                      }))
                    }
                  />
                </FormField>
                <FormField label="Banned Phrases" hint="Phrases to avoid">
                  <Input
                    placeholder="Phrases to avoid for this person"
                    value={(profileForm.voice_profile.banned_phrases || []).join(', ')}
                    onChange={(e) =>
                      setProfileForm((f) => ({
                        ...f,
                        voice_profile: {
                          ...f.voice_profile,
                          banned_phrases: e.target.value
                            .split(',')
                            .map((s) => s.trim())
                            .filter(Boolean),
                        },
                      }))
                    }
                  />
                </FormField>
                <FormField label="Industry Jargon" hint="Domain-specific terms">
                  <Input
                    placeholder="Domain-specific terms they use"
                    value={(profileForm.voice_profile.industry_jargon || []).join(', ')}
                    onChange={(e) =>
                      setProfileForm((f) => ({
                        ...f,
                        voice_profile: {
                          ...f.voice_profile,
                          industry_jargon: e.target.value
                            .split(',')
                            .map((s) => s.trim())
                            .filter(Boolean),
                        },
                      }))
                    }
                  />
                </FormField>
                <FormField label="Storytelling Style">
                  <Input
                    placeholder="e.g. Case studies from client work"
                    value={profileForm.voice_profile.storytelling_style || ''}
                    onChange={(e) =>
                      setProfileForm((f) => ({
                        ...f,
                        voice_profile: {
                          ...f.voice_profile,
                          storytelling_style: e.target.value,
                        },
                      }))
                    }
                  />
                </FormField>
              </TabsContent>
            </Tabs>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowProfileModal(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button onClick={saveProfile} disabled={!profileForm.full_name.trim() || saving}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    Saving...
                  </>
                ) : editingProfile ? (
                  'Save Changes'
                ) : (
                  'Add Profile'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageContainer>
    );
  }

  // ─── Team list view ─────────────────────────────────────────────────────────

  const ownedTeams = memberships.filter((m) => m.role === 'owner');
  const memberTeams = memberships.filter((m) => m.role === 'member');

  return (
    <PageContainer maxWidth="xl">
      <PageTitle
        title="Teams"
        description="Manage your teams and client workspaces."
        actions={
          <Button size="sm" onClick={() => setShowCreateForm(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Create Team
          </Button>
        }
      />

      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950 p-3 text-sm text-emerald-700 dark:text-emerald-400">
          {success}
        </div>
      )}

      <div className="space-y-6">
        {/* Create team form */}
        {showCreateForm && (
          <Card>
            <CardHeader>
              <CardTitle>Create New Team</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField label="Team Name" required>
                  <Input
                    placeholder="e.g. Client A"
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                  />
                </FormField>
                <FormField label="Industry">
                  <Input
                    placeholder="e.g. B2B SaaS"
                    value={newTeamIndustry}
                    onChange={(e) => setNewTeamIndustry(e.target.value)}
                  />
                </FormField>
                <FormField label="Shared Goal">
                  <Input
                    placeholder="e.g. Build thought leadership"
                    value={newTeamGoal}
                    onChange={(e) => setNewTeamGoal(e.target.value)}
                  />
                </FormField>
              </div>
              <div className="flex gap-2">
                <Button onClick={createTeam} disabled={!newTeamName.trim() || saving} size="sm">
                  {saving ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                      Creating...
                    </>
                  ) : (
                    'Create Team'
                  )}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowCreateForm(false)}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Owned teams */}
        {ownedTeams.length > 0 && (
          <SectionContainer title="Your Teams">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {ownedTeams.map((t) => (
                <Card key={t.teamId}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-medium text-xs shrink-0">
                        {t.teamName.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{t.teamName}</p>
                        <Badge variant="blue">Owner</Badge>
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      <Button size="sm" className="flex-1" onClick={() => enterTeam(t.teamId)}>
                        Enter
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => openManage(t.teamId)}>
                        <Settings className="h-3.5 w-3.5 mr-1" />
                        Manage
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </SectionContainer>
        )}

        {/* Member teams */}
        {memberTeams.length > 0 && (
          <SectionContainer title="Teams You Belong To">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {memberTeams.map((t) => (
                <Card key={t.teamId}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-9 h-9 rounded-lg bg-emerald-500 flex items-center justify-center text-white font-medium text-xs shrink-0">
                        {t.teamName.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{t.teamName}</p>
                        <Badge variant="green">Member</Badge>
                      </div>
                    </div>
                    <Button size="sm" className="w-full" onClick={() => enterTeam(t.teamId)}>
                      Enter
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </SectionContainer>
        )}

        {memberships.length === 0 && !showCreateForm && (
          <EmptyState
            icon={<UsersIcon />}
            title="No teams yet"
            description="Create your first team to get started."
            action={
              <Button size="sm" onClick={() => setShowCreateForm(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Create Team
              </Button>
            }
          />
        )}
      </div>
    </PageContainer>
  );
}
