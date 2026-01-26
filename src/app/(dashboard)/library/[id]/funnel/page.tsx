import { redirect, notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/utils/supabase-server';
import { FunnelBuilder } from '@/components/funnel';
import {
  funnelPageFromRow,
  qualificationQuestionFromRow,
  type FunnelPageRow,
  type QualificationQuestionRow,
} from '@/lib/types/funnel';
import type { LeadMagnet } from '@/lib/types/lead-magnet';

export const metadata = {
  title: 'Funnel Builder | MagnetLab',
  description: 'Create an opt-in page for your lead magnet',
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function FunnelBuilderPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }

  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  // Fetch lead magnet and verify ownership
  const { data: leadMagnetData, error: lmError } = await supabase
    .from('lead_magnets')
    .select('*')
    .eq('id', id)
    .eq('user_id', session.user.id)
    .single();

  if (lmError || !leadMagnetData) {
    notFound();
  }

  // Transform to camelCase
  const leadMagnet: LeadMagnet = {
    id: leadMagnetData.id,
    userId: leadMagnetData.user_id,
    title: leadMagnetData.title,
    archetype: leadMagnetData.archetype,
    concept: leadMagnetData.concept,
    extractedContent: leadMagnetData.extracted_content,
    generatedContent: leadMagnetData.generated_content,
    linkedinPost: leadMagnetData.linkedin_post,
    postVariations: leadMagnetData.post_variations,
    dmTemplate: leadMagnetData.dm_template,
    ctaWord: leadMagnetData.cta_word,
    notionPageId: leadMagnetData.notion_page_id,
    notionPageUrl: leadMagnetData.notion_page_url,
    thumbnailUrl: leadMagnetData.thumbnail_url,
    leadsharkPostId: leadMagnetData.leadshark_post_id,
    leadsharkAutomationId: leadMagnetData.leadshark_automation_id,
    scheduledTime: leadMagnetData.scheduled_time,
    status: leadMagnetData.status,
    publishedAt: leadMagnetData.published_at,
    createdAt: leadMagnetData.created_at,
    updatedAt: leadMagnetData.updated_at,
  };

  // Fetch existing funnel page (if any)
  const { data: funnelData } = await supabase
    .from('funnel_pages')
    .select('*')
    .eq('lead_magnet_id', id)
    .eq('user_id', session.user.id)
    .single();

  const existingFunnel = funnelData
    ? funnelPageFromRow(funnelData as FunnelPageRow)
    : null;

  // Fetch questions if funnel exists
  let existingQuestions: ReturnType<typeof qualificationQuestionFromRow>[] = [];
  if (existingFunnel) {
    const { data: questionsData } = await supabase
      .from('qualification_questions')
      .select('*')
      .eq('funnel_page_id', existingFunnel.id)
      .order('question_order', { ascending: true });

    if (questionsData) {
      existingQuestions = (questionsData as QualificationQuestionRow[]).map(
        qualificationQuestionFromRow
      );
    }
  }

  // Get user's username
  const { data: userData } = await supabase
    .from('users')
    .select('username')
    .eq('id', session.user.id)
    .single();

  const username = userData?.username || null;

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <FunnelBuilder
        leadMagnet={leadMagnet}
        existingFunnel={existingFunnel}
        existingQuestions={existingQuestions}
        username={username}
      />
    </div>
  );
}
