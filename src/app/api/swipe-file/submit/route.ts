// Swipe File Submit API
// POST /api/swipe-file/submit - Submit a post or lead magnet for review

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { ApiErrors, logApiError } from '@/lib/api/errors';

interface SubmitPostRequest {
  type: 'post';
  content: string;
  hook?: string;
  post_type?: string;
  niche?: string;
  topic_tags?: string[];
  likes_count?: number;
  comments_count?: number;
  leads_generated?: number;
  source_url?: string;
  notes?: string;
}

interface SubmitLeadMagnetRequest {
  type: 'lead_magnet';
  title: string;
  description?: string;
  content?: string;
  format?: string;
  niche?: string;
  topic_tags?: string[];
  downloads_count?: number;
  conversion_rate?: number;
  leads_generated?: number;
  thumbnail_url?: string;
  notes?: string;
  related_post_id?: string;
}

type SubmitRequest = SubmitPostRequest | SubmitLeadMagnetRequest;

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const body: SubmitRequest = await request.json();
    const supabase = createSupabaseAdminClient();

    if (body.type === 'post') {
      if (!body.content) {
        return ApiErrors.validationError('Content is required');
      }

      const { data, error } = await supabase
        .from('swipe_file_posts')
        .insert({
          content: body.content,
          hook: body.hook || body.content.split('\n')[0]?.slice(0, 100),
          post_type: body.post_type,
          niche: body.niche,
          topic_tags: body.topic_tags || [],
          likes_count: body.likes_count,
          comments_count: body.comments_count,
          leads_generated: body.leads_generated,
          source_url: body.source_url,
          notes: body.notes,
          submitted_by: session.user.id,
          status: 'pending',
        })
        .select()
        .single();

      if (error) {
        logApiError('swipe-file/submit/post', error);
        return ApiErrors.databaseError('Failed to submit post');
      }

      return NextResponse.json({
        submission: data,
        message: 'Post submitted for review',
      });
    }

    if (body.type === 'lead_magnet') {
      if (!body.title) {
        return ApiErrors.validationError('Title is required');
      }

      const { data, error } = await supabase
        .from('swipe_file_lead_magnets')
        .insert({
          title: body.title,
          description: body.description,
          content: body.content,
          format: body.format,
          niche: body.niche,
          topic_tags: body.topic_tags || [],
          downloads_count: body.downloads_count,
          conversion_rate: body.conversion_rate,
          leads_generated: body.leads_generated,
          thumbnail_url: body.thumbnail_url,
          notes: body.notes,
          related_post_id: body.related_post_id,
          submitted_by: session.user.id,
          status: 'pending',
        })
        .select()
        .single();

      if (error) {
        logApiError('swipe-file/submit/lead-magnet', error);
        return ApiErrors.databaseError('Failed to submit lead magnet');
      }

      return NextResponse.json({
        submission: data,
        message: 'Lead magnet submitted for review',
      });
    }

    return ApiErrors.validationError('Invalid submission type');
  } catch (error) {
    logApiError('swipe-file/submit', error);
    return ApiErrors.internalError();
  }
}
