// API Route: Generate Email Sequence
// POST /api/email-sequence/generate - Generate 5-email welcome sequence

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { generateEmailSequence, generateDefaultEmailSequence } from '@/lib/ai/email-sequence-generator';
import type { EmailGenerationContext } from '@/lib/types/email';

// POST - Generate email sequence for a lead magnet
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { leadMagnetId, useAI = true } = body;

    if (!leadMagnetId) {
      return NextResponse.json(
        { error: 'leadMagnetId is required' },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();

    // Get the lead magnet
    const { data: leadMagnet, error: lmError } = await supabase
      .from('lead_magnets')
      .select('id, user_id, title, archetype, concept, extracted_content')
      .eq('id', leadMagnetId)
      .eq('user_id', session.user.id)
      .single();

    if (lmError || !leadMagnet) {
      return NextResponse.json({ error: 'Lead magnet not found' }, { status: 404 });
    }

    // Get brand kit for sender name and content links
    const { data: brandKit } = await supabase
      .from('brand_kits')
      .select('business_description, sender_name, best_video_url, best_video_title, content_links, community_url')
      .eq('user_id', session.user.id)
      .single();

    // Get user name as fallback for sender name
    const { data: user } = await supabase
      .from('users')
      .select('name')
      .eq('id', session.user.id)
      .single();

    const senderName = brandKit?.sender_name || user?.name || 'Your Friend';

    // Build generation context
    const concept = leadMagnet.concept as { contents?: string; deliveryFormat?: string } | null;
    const extractedContent = leadMagnet.extracted_content as { title?: string; format?: string } | null;

    const context: EmailGenerationContext = {
      leadMagnetTitle: leadMagnet.title,
      leadMagnetFormat: extractedContent?.format || concept?.deliveryFormat || leadMagnet.archetype,
      leadMagnetContents: concept?.contents || extractedContent?.title || '',
      senderName,
      businessDescription: brandKit?.business_description || '',
      bestVideoUrl: brandKit?.best_video_url || undefined,
      bestVideoTitle: brandKit?.best_video_title || undefined,
      contentLinks: brandKit?.content_links as Array<{ title: string; url: string }> | undefined,
      communityUrl: brandKit?.community_url || undefined,
      audienceStyle: 'casual-direct',
    };

    let emails;

    if (useAI) {
      try {
        emails = await generateEmailSequence({ context });
      } catch (aiError) {
        console.error('AI email generation failed, using fallback:', aiError);
        emails = generateDefaultEmailSequence(leadMagnet.title, senderName);
      }
    } else {
      emails = generateDefaultEmailSequence(leadMagnet.title, senderName);
    }

    // Use admin client for upsert to bypass RLS during insert
    const adminSupabase = createSupabaseAdminClient();

    // Upsert email sequence (update if exists, create if not)
    const { data: emailSequence, error: upsertError } = await adminSupabase
      .from('email_sequences')
      .upsert(
        {
          lead_magnet_id: leadMagnetId,
          user_id: session.user.id,
          emails,
          status: 'draft',
        },
        {
          onConflict: 'lead_magnet_id',
        }
      )
      .select()
      .single();

    if (upsertError) {
      console.error('Upsert email sequence error:', upsertError);
      return NextResponse.json(
        { error: 'Failed to save email sequence' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      emailSequence,
      generated: true,
    });
  } catch (error) {
    console.error('Generate email sequence error:', error);
    return NextResponse.json(
      { error: 'Failed to generate email sequence' },
      { status: 500 }
    );
  }
}
