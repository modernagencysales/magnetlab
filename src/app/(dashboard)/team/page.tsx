'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { Team, TeamProfile, TeamVoiceProfile } from '@/lib/types/content-pipeline';

import { logError } from '@/lib/utils/logger';

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

const emptyForm: ProfileFormData = {
  full_name: '',
  email: '',
  title: '',
  linkedin_url: '',
  bio: '',
  expertise_areas: [],
  voice_profile: {},
};

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
  const [profiles, setProfiles] = useState<TeamProfile[]>([]);
  const [teamName, setTeamName] = useState('');
  const [teamIndustry, setTeamIndustry] = useState('');
  const [teamGoal, setTeamGoal] = useState('');

  // Profile modal
  const [editingProfile, setEditingProfile] = useState<TeamProfile | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileForm, setProfileForm] = useState<ProfileFormData>(emptyForm);
  const [activeTab, setActiveTab] = useState<'details' | 'voice'>('details');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/team/memberships');
      if (res.ok) {
        const data = await res.json();
        setMemberships(data);
      }
    } catch (err) {
      logError('dashboard/team', err, { step: 'failed_to_fetch_team_data' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const enterTeam = (teamId: string) => {
    document.cookie = `ml-team-context=${teamId}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
    router.push('/');
  };

  const createTeam = async () => {
    if (!newTeamName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newTeamName,
          industry: newTeamIndustry || undefined,
          shared_goal: newTeamGoal || undefined,
        }),
      });
      if (res.ok) {
        setSuccess('Team created successfully');
        setShowCreateForm(false);
        setNewTeamName('');
        setNewTeamIndustry('');
        setNewTeamGoal('');
        await fetchData();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Failed to create team');
      }
    } catch {
      setError('Failed to create team');
    } finally {
      setSaving(false);
    }
  };

  const openManage = async (teamId: string) => {
    setError(null);
    setSuccess(null);
    try {
      const [teamRes, profilesRes] = await Promise.all([
        fetch(`/api/team/${teamId}`),
        fetch('/api/teams/profiles'),
      ]);
      const teamData = await teamRes.json();
      const profilesData = await profilesRes.json();

      if (teamData.team) {
        setManagingTeam(teamData.team);
        setTeamName(teamData.team.name);
        setTeamIndustry(teamData.team.industry || '');
        setTeamGoal(teamData.team.shared_goal || '');
      }
      // Filter profiles for this team
      const teamProfiles = (profilesData.profiles || []).filter(
        (p: TeamProfile) => p.team_id === teamId
      );
      setProfiles(teamProfiles);
    } catch (err) {
      logError('dashboard/team', err, { step: 'failed_to_open_manage' });
      setError('Failed to load team details');
    }
  };

  const updateTeam = async () => {
    if (!managingTeam) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch('/api/teams', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          team_id: managingTeam.id,
          name: teamName,
          industry: teamIndustry || undefined,
          shared_goal: teamGoal || undefined,
        }),
      });
      if (res.ok) {
        setSuccess('Settings saved');
        await fetchData();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Failed to save settings');
      }
    } catch {
      setError('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

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
    setActiveTab('details');
    setShowProfileModal(true);
  };

  const saveProfile = async () => {
    if (!profileForm.full_name.trim()) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = editingProfile
        ? await fetch(`/api/teams/profiles/${editingProfile.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(profileForm),
          })
        : await fetch('/api/teams/profiles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(profileForm),
          });

      if (res.ok) {
        setSuccess(editingProfile ? 'Profile updated' : 'Profile added');
        setShowProfileModal(false);
        if (managingTeam) await openManage(managingTeam.id);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Failed to save profile');
      }
    } catch {
      setError('Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const removeProfile = async (id: string) => {
    if (!confirm('Remove this team member?')) return;
    await fetch(`/api/teams/profiles/${id}`, { method: 'DELETE' });
    if (managingTeam) await openManage(managingTeam.id);
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-48" />
          <div className="h-4 bg-muted rounded w-96" />
          <div className="grid grid-cols-3 gap-4 mt-8">
            {[1, 2, 3].map(i => <div key={i} className="h-48 bg-muted rounded-lg" />)}
          </div>
        </div>
      </div>
    );
  }

  // ── Managing a specific team ──
  if (managingTeam) {
    const isOwner = memberships.find(m => m.teamId === managingTeam.id)?.role === 'owner';

    return (
      <div className="p-8 max-w-5xl mx-auto">
        <button
          onClick={() => setManagingTeam(null)}
          className="text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          &larr; Back to all teams
        </button>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">{managingTeam.name}</h1>
            <p className="text-muted-foreground">Manage team settings and profiles.</p>
          </div>
          <button
            onClick={() => enterTeam(managingTeam.id)}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium"
          >
            Enter Team
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950 p-3 text-sm text-red-700 dark:text-red-400 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">&times;</button>
          </div>
        )}
        {success && (
          <div className="mb-4 rounded-lg border border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950 p-3 text-sm text-green-700 dark:text-green-400 flex items-center justify-between">
            <span>{success}</span>
            <button onClick={() => setSuccess(null)} className="text-green-500 hover:text-green-700">&times;</button>
          </div>
        )}

        {/* Team Settings (owner only) */}
        {isOwner && (
          <div className="border rounded-lg p-6 mb-8">
            <h2 className="text-lg font-semibold mb-4">Team Settings</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Team Name</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border rounded-lg bg-background"
                  value={teamName}
                  onChange={e => setTeamName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Industry</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border rounded-lg bg-background"
                  value={teamIndustry}
                  onChange={e => setTeamIndustry(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Shared Goal</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border rounded-lg bg-background"
                  value={teamGoal}
                  onChange={e => setTeamGoal(e.target.value)}
                />
              </div>
            </div>
            <button
              onClick={updateTeam}
              disabled={saving}
              className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        )}

        {/* Profiles */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Team Profiles</h2>
          {isOwner && (
            <button
              onClick={() => openProfileModal()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium"
            >
              + Add Profile
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {profiles.map(profile => (
            <div key={profile.id} className="border rounded-lg p-4 relative">
              {profile.is_default && (
                <span className="absolute top-2 right-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                  Default
                </span>
              )}
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                  {profile.avatar_url ? (
                    <img src={profile.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    profile.full_name.charAt(0).toUpperCase()
                  )}
                </div>
                <div>
                  <div className="font-medium">{profile.full_name}</div>
                  <div className="text-sm text-muted-foreground">{profile.title || 'No title'}</div>
                </div>
              </div>
              <div className="text-xs text-muted-foreground mb-3">
                {profile.email || 'No email'}
                <span className="mx-1.5">·</span>
                <span className={profile.status === 'active' ? 'text-green-600' : 'text-yellow-600'}>
                  {profile.status}
                </span>
              </div>
              <div className="text-xs text-muted-foreground mb-3">
                Voice: {profile.voice_profile?.tone ? profile.voice_profile.tone : 'Not configured'}
              </div>
              {isOwner && (
                <div className="flex gap-2">
                  <button
                    onClick={() => openProfileModal(profile)}
                    className="text-xs px-3 py-1.5 border rounded-md hover:bg-muted"
                  >
                    Edit
                  </button>
                  {profile.role !== 'owner' && (
                    <button
                      onClick={() => removeProfile(profile.id)}
                      className="text-xs px-3 py-1.5 border border-red-200 text-red-600 rounded-md hover:bg-red-50"
                    >
                      Remove
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Profile Editor Modal */}
        {showProfileModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-background rounded-xl shadow-xl w-full max-w-xl max-h-[85vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">
                    {editingProfile ? 'Edit Profile' : 'Add Team Member'}
                  </h3>
                  <button onClick={() => setShowProfileModal(false)} className="text-muted-foreground hover:text-foreground">
                    &times;
                  </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b mb-4">
                  <button
                    onClick={() => setActiveTab('details')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${activeTab === 'details' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`}
                  >
                    Details
                  </button>
                  <button
                    onClick={() => setActiveTab('voice')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${activeTab === 'voice' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`}
                  >
                    Voice Profile
                  </button>
                </div>

                {activeTab === 'details' ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Full Name *</label>
                      <input type="text" className="w-full px-3 py-2 border rounded-lg bg-background" value={profileForm.full_name} onChange={e => setProfileForm(f => ({ ...f, full_name: e.target.value }))} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Email</label>
                      <input type="email" className="w-full px-3 py-2 border rounded-lg bg-background" value={profileForm.email} onChange={e => setProfileForm(f => ({ ...f, email: e.target.value }))} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Title</label>
                      <input type="text" className="w-full px-3 py-2 border rounded-lg bg-background" placeholder="e.g. CEO, Head of Sales" value={profileForm.title} onChange={e => setProfileForm(f => ({ ...f, title: e.target.value }))} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">LinkedIn URL</label>
                      <input type="url" className="w-full px-3 py-2 border rounded-lg bg-background" placeholder="https://linkedin.com/in/..." value={profileForm.linkedin_url} onChange={e => setProfileForm(f => ({ ...f, linkedin_url: e.target.value }))} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Bio</label>
                      <textarea className="w-full px-3 py-2 border rounded-lg bg-background" rows={3} placeholder="Background, expertise, what they're known for..." value={profileForm.bio} onChange={e => setProfileForm(f => ({ ...f, bio: e.target.value }))} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Expertise Areas</label>
                      <input type="text" className="w-full px-3 py-2 border rounded-lg bg-background" placeholder="Comma separated: Sales, Marketing, AI" value={profileForm.expertise_areas.join(', ')} onChange={e => setProfileForm(f => ({ ...f, expertise_areas: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))} />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">First-Person Context</label>
                      <textarea className="w-full px-3 py-2 border rounded-lg bg-background" rows={3} placeholder="I'm a 15-year agency veteran who's scaled 3 businesses..." value={profileForm.voice_profile.first_person_context || ''} onChange={e => setProfileForm(f => ({ ...f, voice_profile: { ...f.voice_profile, first_person_context: e.target.value } }))} />
                      <p className="text-xs text-muted-foreground mt-1">The AI will use this as the &quot;I&quot; perspective when writing posts.</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Perspective Notes</label>
                      <textarea className="w-full px-3 py-2 border rounded-lg bg-background" rows={2} placeholder="Speaks from hands-on experience building sales teams" value={profileForm.voice_profile.perspective_notes || ''} onChange={e => setProfileForm(f => ({ ...f, voice_profile: { ...f.voice_profile, perspective_notes: e.target.value } }))} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Tone</label>
                      <input type="text" className="w-full px-3 py-2 border rounded-lg bg-background" placeholder="Direct, warm, slightly irreverent" value={profileForm.voice_profile.tone || ''} onChange={e => setProfileForm(f => ({ ...f, voice_profile: { ...f.voice_profile, tone: e.target.value } }))} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Signature Phrases</label>
                      <input type="text" className="w-full px-3 py-2 border rounded-lg bg-background" placeholder="Comma separated phrases this person naturally uses" value={(profileForm.voice_profile.signature_phrases || []).join(', ')} onChange={e => setProfileForm(f => ({ ...f, voice_profile: { ...f.voice_profile, signature_phrases: e.target.value.split(',').map(s => s.trim()).filter(Boolean) } }))} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Banned Phrases</label>
                      <input type="text" className="w-full px-3 py-2 border rounded-lg bg-background" placeholder="Phrases to avoid for this person" value={(profileForm.voice_profile.banned_phrases || []).join(', ')} onChange={e => setProfileForm(f => ({ ...f, voice_profile: { ...f.voice_profile, banned_phrases: e.target.value.split(',').map(s => s.trim()).filter(Boolean) } }))} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Industry Jargon</label>
                      <input type="text" className="w-full px-3 py-2 border rounded-lg bg-background" placeholder="Domain-specific terms they use" value={(profileForm.voice_profile.industry_jargon || []).join(', ')} onChange={e => setProfileForm(f => ({ ...f, voice_profile: { ...f.voice_profile, industry_jargon: e.target.value.split(',').map(s => s.trim()).filter(Boolean) } }))} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Storytelling Style</label>
                      <input type="text" className="w-full px-3 py-2 border rounded-lg bg-background" placeholder="e.g. Case studies from client work" value={profileForm.voice_profile.storytelling_style || ''} onChange={e => setProfileForm(f => ({ ...f, voice_profile: { ...f.voice_profile, storytelling_style: e.target.value } }))} />
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                  <button onClick={() => setShowProfileModal(false)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
                  <button onClick={saveProfile} disabled={!profileForm.full_name.trim() || saving} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium disabled:opacity-50">
                    {saving ? 'Saving...' : editingProfile ? 'Save Changes' : 'Add Member'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Team list view ──
  const ownedTeams = memberships.filter(m => m.role === 'owner');
  const memberTeams = memberships.filter(m => m.role === 'member');

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Teams</h1>
          <p className="text-muted-foreground">Manage your teams and client workspaces.</p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium"
        >
          + Create Team
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950 p-3 text-sm text-red-700 dark:text-red-400 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">&times;</button>
        </div>
      )}
      {success && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950 p-3 text-sm text-green-700 dark:text-green-400 flex items-center justify-between">
          <span>{success}</span>
          <button onClick={() => setSuccess(null)} className="text-green-500 hover:text-green-700">&times;</button>
        </div>
      )}

      {/* Create team form (modal) */}
      {showCreateForm && (
        <div className="border rounded-lg p-6 mb-8 bg-muted/30">
          <h2 className="text-lg font-semibold mb-4">Create New Team</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Team Name *</label>
              <input type="text" className="w-full px-3 py-2 border rounded-lg bg-background" placeholder="e.g. Client A" value={newTeamName} onChange={e => setNewTeamName(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Industry</label>
              <input type="text" className="w-full px-3 py-2 border rounded-lg bg-background" placeholder="e.g. B2B SaaS" value={newTeamIndustry} onChange={e => setNewTeamIndustry(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Shared Goal</label>
              <input type="text" className="w-full px-3 py-2 border rounded-lg bg-background" placeholder="e.g. Build thought leadership" value={newTeamGoal} onChange={e => setNewTeamGoal(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={createTeam} disabled={!newTeamName.trim() || saving} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium disabled:opacity-50">
              {saving ? 'Creating...' : 'Create Team'}
            </button>
            <button onClick={() => setShowCreateForm(false)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
          </div>
        </div>
      )}

      {/* Owned teams */}
      {ownedTeams.length > 0 && (
        <>
          <h2 className="text-sm font-medium text-muted-foreground mb-3">Your Teams</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {ownedTeams.map(t => (
              <div key={t.teamId} className="border rounded-lg p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-violet-500 flex items-center justify-center text-white font-medium text-sm shrink-0">
                    {t.teamName.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{t.teamName}</p>
                    <p className="text-xs text-muted-foreground">Owner</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => enterTeam(t.teamId)}
                    className="flex-1 px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-sm font-medium"
                  >
                    Enter
                  </button>
                  <button
                    onClick={() => openManage(t.teamId)}
                    className="px-3 py-1.5 border rounded-md text-sm hover:bg-muted"
                  >
                    Manage
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Member teams */}
      {memberTeams.length > 0 && (
        <>
          <h2 className="text-sm font-medium text-muted-foreground mb-3">Teams You Belong To</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {memberTeams.map(t => (
              <div key={t.teamId} className="border rounded-lg p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500 flex items-center justify-center text-white font-medium text-sm shrink-0">
                    {t.teamName.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{t.teamName}</p>
                    <p className="text-xs text-muted-foreground">Member</p>
                  </div>
                </div>
                <button
                  onClick={() => enterTeam(t.teamId)}
                  className="w-full px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-sm font-medium"
                >
                  Enter
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {memberships.length === 0 && !showCreateForm && (
        <div className="text-center py-16 text-muted-foreground">
          <p className="mb-4">No teams yet. Create your first team to get started.</p>
          <button
            onClick={() => setShowCreateForm(true)}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium"
          >
            + Create Team
          </button>
        </div>
      )}
    </div>
  );
}
