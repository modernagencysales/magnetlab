// API Route: Generate AI Content for Funnel Page
// POST /api/funnel/generate-content

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import {
  generateOptinContent,
  generateDefaultOptinContent,
} from '@/lib/ai/funnel-content-generator';
import type { LeadMagnetConcept, ExtractedContent } from '@/lib/types/lead-magnet';

// POST - Generate opt-in page content
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

    const supabase = createSupabaseAdminClient();

    // Fetch lead magnet data
    const { data: leadMagnet, error: lmError } = await supabase
      .from('lead_magnets')
      .select('title, concept, extracted_content')
      .eq('id', leadMagnetId)
      .eq('user_id', session.user.id)
      .single();

    if (lmError || !leadMagnet) {
      return NextResponse.json({ error: 'Lead magnet not found' }, { status: 404 });
    }

    // Fetch brand kit for credibility
    const { data: brandKit } = await supabase
      .from('brand_kits')
      .select('credibility_markers')
      .eq('user_id', session.user.id)
      .single();

    const credibility = brandKit?.credibility_markers?.join('. ') || undefined;

    let content;

    if (useAI) {
      try {
        content = await generateOptinContent({
          leadMagnetTitle: leadMagnet.title,
          concept: leadMagnet.concept as LeadMagnetConcept | null,
          extractedContent: leadMagnet.extracted_content as ExtractedContent | null,
          credibility,
        });
      } catch (aiError) {
        console.error('AI generation failed, falling back to default:', aiError);
        content = generateDefaultOptinContent(
          leadMagnet.title,
          leadMagnet.concept as LeadMagnetConcept | null
        );
      }
    } else {
      content = generateDefaultOptinContent(
        leadMagnet.title,
        leadMagnet.concept as LeadMagnetConcept | null
      );
    }

    return NextResponse.json({ content });
  } catch (error) {
    console.error('Generate content error:', error);
    return NextResponse.json({ error: 'Failed to generate content' }, { status: 500 });
  }
}
