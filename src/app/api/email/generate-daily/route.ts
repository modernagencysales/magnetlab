// API Route: Generate Daily Newsletter Email
// POST — Generate an AI newsletter email draft and save as broadcast

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { requireTeamScope } from '@/lib/utils/team-context';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import { writeNewsletterEmail } from '@/lib/ai/content-pipeline/email-writer';
import { buildContentBrief } from '@/lib/ai/content-pipeline/briefing-agent';

export async function POST(request: Request) {
  try {
    // 1. Auth required
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const userId = session.user.id;

    // 2. Get team scope
    const supabase = createSupabaseAdminClient();
    const scope = await requireTeamScope(userId);
    if (!scope?.teamId) {
      return ApiErrors.validationError('No team found for this user');
    }

    const teamId = scope.teamId;

    // Parse optional request body
    let requestTopic: string | undefined;
    let requestProfileId: string | undefined;
    try {
      const body = await request.json();
      requestTopic = body?.topic;
      requestProfileId = body?.profileId;
    } catch {
      // Empty body is fine — all fields are optional
    }

    // 3. Get active voice profile
    const profileQuery = supabase
      .from('team_profiles')
      .select('id, voice_profile, full_name')
      .eq('team_id', teamId)
      .eq('status', 'active');

    if (requestProfileId) {
      profileQuery.eq('id', requestProfileId);
    }

    const { data: profiles } = await profileQuery.limit(1);
    const profile = profiles?.[0] ?? null;
    const voiceProfile = profile?.voice_profile ?? null;
    const authorName = profile?.full_name ?? undefined;

    // 4. Determine topic
    let topic = requestTopic;
    let todaysLinkedInTopic: string | undefined;

    if (!topic) {
      // Try to find today's approved LinkedIn post for topic consistency
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const { data: todaysPosts } = await supabase
        .from('cp_pipeline_posts')
        .select('draft_content')
        .eq('user_id', userId)
        .eq('status', 'approved')
        .gte('created_at', today)
        .limit(1);

      if (todaysPosts?.[0]?.draft_content) {
        // Extract first line as topic hint
        const postContent = todaysPosts[0].draft_content;
        todaysLinkedInTopic = postContent.split('\n')[0]?.slice(0, 200);
        topic = todaysLinkedInTopic;
      }
    }

    // If still no topic, fall back to a generic prompt
    if (!topic) {
      topic = 'B2B growth strategies and practical business advice';
    }

    // 5. Build knowledge brief from AI Brain
    const brief = await buildContentBrief(userId, topic, {
      teamId,
      profileId: profile?.id,
      voiceProfile: voiceProfile ?? undefined,
    });

    // 6. Generate the email
    const emailResult = await writeNewsletterEmail({
      topic,
      knowledgeContext: brief.compiledContext || 'No specific knowledge context available.',
      voiceProfile,
      todaysLinkedInTopic,
      authorName,
    });

    // 7. Store as draft broadcast in email_broadcasts
    const { data: broadcast, error: insertError } = await supabase
      .from('email_broadcasts')
      .insert({
        team_id: teamId,
        user_id: userId,
        subject: emailResult.subject,
        body: emailResult.body,
        status: 'draft',
        recipient_count: 0,
      })
      .select('id, team_id, user_id, subject, body, status, recipient_count, created_at, updated_at')
      .single();

    if (insertError) {
      logApiError('email/generate-daily', insertError, { teamId });
      return ApiErrors.databaseError('Failed to save email draft');
    }

    return NextResponse.json({ broadcast }, { status: 201 });
  } catch (error) {
    logApiError('email/generate-daily', error);
    return ApiErrors.internalError('Failed to generate daily email');
  }
}
