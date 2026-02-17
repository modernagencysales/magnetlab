// API Route: Import existing lead magnet
// POST /api/lead-magnet/import - Import content and create lead magnet + funnel page

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { getDataScope, applyScope } from '@/lib/utils/team-context';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import Anthropic from '@anthropic-ai/sdk';

const getAnthropicClient = () => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');
  return new Anthropic({ apiKey, timeout: 30_000 });
};

interface ImportedContent {
  title: string;
  headline: string;
  subline: string;
  socialProof: string;
  painSolved: string;
  format: string;
}

async function extractFromContent(content: string, url?: string): Promise<ImportedContent> {
  const prompt = `You are analyzing a lead magnet or offer description to extract key marketing elements.

${url ? `URL provided: ${url}` : ''}

CONTENT TO ANALYZE:
${content}

Extract the following and return as JSON:
1. title: The name/title of the lead magnet (concise, catchy)
2. headline: A compelling opt-in page headline that makes people want to download (focus on the outcome/benefit)
3. subline: A supporting line that adds specificity or urgency (1-2 sentences)
4. socialProof: A line about who this is for or social proof element (e.g., "Join 500+ marketers" or "Perfect for coaches who...")
5. painSolved: The main pain point or problem this solves (1 sentence)
6. format: The format of the lead magnet (PDF, Checklist, Template, Guide, Video, etc.)

If any element isn't clear from the content, make a reasonable inference based on the context.

Return ONLY valid JSON in this exact format:
{
  "title": "...",
  "headline": "...",
  "subline": "...",
  "socialProof": "...",
  "painSolved": "...",
  "format": "..."
}`;

  const response = await getAnthropicClient().messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    messages: [{ role: 'user', content: prompt }],
  });

  const textContent = response.content.find((block) => block.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from Claude');
  }

  const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]) as ImportedContent;
  }
  return JSON.parse(textContent.text) as ImportedContent;
}

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 50);
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const body = await request.json();
    const { url, content } = body;

    // Validate at least one input is provided
    if (!url && !content) {
      return ApiErrors.validationError('Please provide either a URL or content to import');
    }

    const supabase = createSupabaseAdminClient();
    const scope = await getDataScope(session.user.id);

    // Combine inputs for analysis
    let analysisContent = '';
    if (url) {
      analysisContent += `URL: ${url}\n\n`;
    }
    if (content) {
      analysisContent += content;
    }

    // Extract content using AI
    const extracted = await extractFromContent(analysisContent.trim(), url);

    // Create lead magnet record
    const { data: leadMagnet, error: lmError } = await supabase
      .from('lead_magnets')
      .insert({
        user_id: session.user.id,
        team_id: scope.teamId || null,
        title: extracted.title,
        archetype: 'focused-toolkit', // Default archetype for imported
        status: 'draft',
        concept: {
          title: extracted.title,
          painSolved: extracted.painSolved,
          deliveryFormat: extracted.format,
          isImported: true,
        },
      })
      .select('id, title')
      .single();

    if (lmError) {
      logApiError('lead-magnet/import/create-lm', lmError, { userId: session.user.id });
      return ApiErrors.databaseError('Failed to create lead magnet');
    }

    // Generate unique slug
    let slug = generateSlug(extracted.title);
    let slugSuffix = 0;

    while (true) {
      let slugQuery = supabase
        .from('funnel_pages')
        .select('id')
        .eq('slug', slug);
      slugQuery = applyScope(slugQuery, scope);
      const { data: slugExists } = await slugQuery.single();

      if (!slugExists) break;
      slugSuffix++;
      slug = `${generateSlug(extracted.title)}-${slugSuffix}`;
    }

    // Create funnel page
    const funnelInsertData = {
      lead_magnet_id: leadMagnet.id,
      user_id: session.user.id,
      team_id: scope.teamId || null,
      slug,
      optin_headline: extracted.headline,
      optin_subline: extracted.subline,
      optin_button_text: 'Get Free Access',
      optin_social_proof: extracted.socialProof,
      thankyou_headline: 'Thanks! Check your email.',
      thankyou_subline: `Your ${extracted.format || 'download'} is on its way.`,
      qualification_pass_message: 'Great! Book a call below.',
      qualification_fail_message: 'Thanks for your interest!',
      theme: 'dark',
      primary_color: '#8b5cf6',
      background_style: 'solid',
    };

    let { data: funnelPage, error: fpError } = await supabase
      .from('funnel_pages')
      .insert(funnelInsertData)
      .select('id')
      .single();

    // Retry once with random suffix on unique constraint violation
    if (fpError?.code === '23505') {
      slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
      ({ data: funnelPage, error: fpError } = await supabase
        .from('funnel_pages')
        .insert({ ...funnelInsertData, slug })
        .select('id')
        .single());
    }

    if (fpError) {
      // Clean up the lead magnet if funnel page creation fails
      await supabase.from('lead_magnets').delete().eq('id', leadMagnet.id);
      logApiError('lead-magnet/import/create-fp', fpError, { userId: session.user.id });
      return ApiErrors.databaseError('Failed to create funnel page');
    }

    return NextResponse.json({
      success: true,
      leadMagnetId: leadMagnet.id,
      funnelPageId: funnelPage!.id,
      extracted,
    }, { status: 201 });
  } catch (error) {
    logApiError('lead-magnet/import', error);
    return ApiErrors.internalError('Failed to import lead magnet');
  }
}
