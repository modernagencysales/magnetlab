/**
 * Post Image URL Upload.
 * Accepts JSON body with image_url, downloads the image server-side, stores in Supabase Storage,
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractFilenameFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const parts = pathname.split('/');
    const last = parts[parts.length - 1];
    if (last && last.includes('.')) return last;
  } catch {
    // fall through
  }
  return 'image';
}

function extensionForMimeType(mimeType: string): string {
  const map: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif',
  };
  return map[mimeType] ?? 'bin';
}

// ─── Handler ────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const { id: postId } = await params;
    const userId = session.user.id;

    // Parse JSON body
    const body = await request.json().catch(() => null);
    const imageUrl = body?.image_url as string | undefined;

    if (!imageUrl || typeof imageUrl !== 'string') {
      return ApiErrors.validationError(
        'Missing image_url field. Send JSON body with { "image_url": "https://..." }.'
      );
    }

    // Validate URL format
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(imageUrl);
    } catch {
      return ApiErrors.validationError('image_url is not a valid URL.');
    }

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return ApiErrors.validationError('image_url must use http or https protocol.');
    }

    // Download image from URL
    let fetchResponse: Response;
    try {
      fetchResponse = await fetch(imageUrl);
    } catch (err) {
      logApiError('cp/posts/upload-image-url', err, { postId, imageUrl, step: 'fetch' });
      return ApiErrors.internalError('Failed to fetch image from URL.');
    }

    if (!fetchResponse.ok) {
      return ApiErrors.validationError(
        `Could not download image: server responded with ${fetchResponse.status}.`
      );
    }

    // Validate MIME type from Content-Type header
    const contentType = fetchResponse.headers.get('content-type') ?? '';
    const mimeType = contentType.split(';')[0].trim().toLowerCase();

    if (!ALLOWED_IMAGE_TYPES.has(mimeType)) {
      return ApiErrors.validationError(
        `Invalid file type: ${mimeType || 'unknown'}. Allowed types: png, jpg, jpeg, webp, gif.`
      );
    }

    // Download into buffer and validate size
    const arrayBuffer = await fetchResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.byteLength > MAX_FILE_SIZE_BYTES) {
      return ApiErrors.validationError(
        `File too large: ${(buffer.byteLength / 1024 / 1024).toFixed(1)}MB. Maximum size is 10MB.`
      );
    }

    // Build storage path — prefer filename from URL, fall back to mimeType extension
    const rawFilename = extractFilenameFromUrl(imageUrl);
    const filename = rawFilename.includes('.')
      ? rawFilename
      : `${rawFilename}.${extensionForMimeType(mimeType)}`;
    const storagePath = `${userId}/${postId}/${filename}`;

    const supabase = createSupabaseAdminClient();

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, buffer, {
        contentType: mimeType,
        upsert: true,
      });

    if (uploadError) {
      logApiError('cp/posts/upload-image-url', uploadError, { postId, storagePath });
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
      logApiError('cp/posts/upload-image-url', updateError, { postId, step: 'db_update' });
      return ApiErrors.internalError(`Failed to update post: ${updateError.message}`);
    }

    return NextResponse.json({
      imageUrl: urlData.publicUrl,
      storagePath,
    });
  } catch (error) {
    logApiError('cp/posts/upload-image-url', error);
    return ApiErrors.internalError('Failed to upload image from URL');
  }
}
