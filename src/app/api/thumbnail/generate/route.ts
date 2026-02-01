// API Route: Generate Thumbnail
// POST /api/thumbnail/generate

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { generateBrandedThumbnail } from '@/lib/services/thumbnail';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { ApiErrors, logApiError } from '@/lib/api/errors';

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const body = await request.json();
    const { leadMagnetId, title, subtitle } = body as {
      leadMagnetId: string;
      title?: string;
      subtitle?: string;
    };

    if (!leadMagnetId) {
      return ApiErrors.validationError('leadMagnetId is required');
    }

    if (!title) {
      return ApiErrors.validationError('title must be provided');
    }

    // Generate branded thumbnail
    const thumbnail = await generateBrandedThumbnail(title, subtitle);

    // Upload to Supabase Storage
    const supabase = createSupabaseAdminClient();
    const fileName = `thumbnails/${session.user.id}/${leadMagnetId}.png`;

    const { error: uploadError } = await supabase.storage
      .from('magnetlab')
      .upload(fileName, thumbnail, {
        contentType: 'image/png',
        upsert: true,
      });

    if (uploadError) {
      logApiError('thumbnail/generate/upload', uploadError, { leadMagnetId });
      return ApiErrors.databaseError('Failed to upload thumbnail');
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('magnetlab')
      .getPublicUrl(fileName);

    const thumbnailUrl = urlData.publicUrl;

    // Update lead magnet
    await supabase
      .from('lead_magnets')
      .update({ thumbnail_url: thumbnailUrl })
      .eq('id', leadMagnetId)
      .eq('user_id', session.user.id);

    return NextResponse.json({ thumbnailUrl });
  } catch (error) {
    logApiError('thumbnail/generate', error);
    return ApiErrors.internalError('Failed to generate thumbnail');
  }
}
