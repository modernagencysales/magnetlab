import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ApiErrors } from '@/lib/api/errors';
import * as leadMagnetsRepo from '@/server/repositories/lead-magnets.repo';
import * as leadMagnetsService from '@/server/services/lead-magnets.service';
import type { PostWriterInput, PolishedContent, LeadMagnetConcept } from '@/lib/types/lead-magnet';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const { id } = await params;
    const userId = session.user.id;

    // Fetch lead magnet with content fields
    const lm = await leadMagnetsRepo.findLeadMagnetByOwnerFull(userId, id);
    if (!lm) return ApiErrors.notFound('Lead magnet');

    const polished = lm.polished_content as PolishedContent | null;
    const extracted = lm.extracted_content as { content?: string; summary?: string } | null;
    const concept = lm.concept as LeadMagnetConcept | null;

    if (!polished && !extracted) {
      return NextResponse.json(
        { error: 'Lead magnet has no content yet. Generate content before creating posts.' },
        { status: 400 },
      );
    }

    // Build contents string from polished sections or extracted content
    let contents = '';
    if (polished?.sections) {
      contents = polished.sections
        .map((s) => `${s.sectionName}: ${s.keyTakeaway}`)
        .join('; ');
    } else if (extracted?.content) {
      contents = extracted.content;
    }

    if (!contents.trim()) {
      return NextResponse.json(
        { error: 'Lead magnet content is empty. Ensure content has been generated.' },
        { status: 400 },
      );
    }

    // Fetch brand kit for credibility/audience info
    const brandKit = await leadMagnetsRepo.getBrandKitByUserId(userId);

    const input: PostWriterInput = {
      leadMagnetTitle: lm.title,
      format: concept?.deliveryFormat || lm.archetype || 'Guide',
      contents,
      problemSolved: concept?.painSolved || lm.title,
      credibility: (brandKit?.credibility_markers || []).join(', '),
      audience: brandKit?.business_description || 'professionals',
      audienceStyle: 'casual-direct',
      proof: polished?.heroSummary || extracted?.summary || '',
      ctaWord: 'LINK',
    };

    const result = await leadMagnetsService.startWritePost(userId, input, id);
    return NextResponse.json(result);
  } catch (error) {
    const status = leadMagnetsService.getStatusCode(error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status });
  }
}
