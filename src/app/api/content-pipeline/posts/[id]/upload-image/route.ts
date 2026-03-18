/**
 * Post Image Upload.
 * Accepts multipart/form-data with an image file, stores in Supabase Storage,
 * and updates the post's image_storage_path.
 * Never imports business logic — delegates storage and DB update directly.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { ApiErrors, logApiError } from '@/lib/api/errors';

// ─── Constants ──────────────────────────────────────────────────────────────

const ALLOWED_IMAGE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
]);

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

const STORAGE_BUCKET = 'post-images';

// ─── Handler ────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const { id: postId } = await params;
    const userId = session.user.id;

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('image') as File | null;

    // Validate file exists
    if (!file || !(file instanceof File)) {
      return ApiErrors.validationError(
        'No image file provided. Send a "image" field in multipart/form-data.'
      );
    }

    // Validate file type
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      return ApiErrors.validationError(
        `Invalid file type: ${file.type}. Allowed types: png, jpg, jpeg, webp, gif.`
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return ApiErrors.validationError(
        `File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB. Maximum size is 10MB.`
      );
    }

    // Convert to buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Generate storage path
    const storagePath = `${userId}/${postId}/${file.name}`;

    const supabase = createSupabaseAdminClient();

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      logApiError('cp/posts/upload-image', uploadError, { postId, storagePath });
      return ApiErrors.internalError(`Failed to upload image: ${uploadError.message}`);
    }

    // Get public URL
    const { data: urlData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath);

    // Update the post's image_storage_path
    const { error: updateError } = await supabase
      .from('cp_pipeline_posts')
      .update({ image_storage_path: storagePath })
      .eq('id', postId)
      .eq('user_id', userId);

    if (updateError) {
      logApiError('cp/posts/upload-image', updateError, { postId, step: 'db_update' });
      return ApiErrors.internalError(`Failed to update post: ${updateError.message}`);
    }

    return NextResponse.json({
      imageUrl: urlData.publicUrl,
      storagePath,
    });
  } catch (error) {
    logApiError('cp/posts/upload-image', error);
    return ApiErrors.internalError('Failed to upload image');
  }
}
