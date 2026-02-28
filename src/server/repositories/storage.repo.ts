/**
 * Storage Repository (Supabase Storage)
 * Uploads and public URL for magnetlab bucket.
 */

import { createSupabaseAdminClient } from "@/lib/utils/supabase-server";

const BUCKET = "magnetlab";

/**
 * Upload thumbnail to thumbnails/{userId}/{leadMagnetId}.png and return public URL.
 */
export async function uploadThumbnail(
  userId: string,
  leadMagnetId: string,
  buffer: Buffer,
): Promise<string> {
  const supabase = createSupabaseAdminClient();
  const fileName = `thumbnails/${userId}/${leadMagnetId}.png`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(fileName, buffer, {
      contentType: "image/png",
      upsert: true,
    });

  if (uploadError) throw new Error(`storage.uploadThumbnail: ${uploadError.message}`);

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(fileName);
  return urlData.publicUrl;
}

const PUBLIC_ASSETS_BUCKET = "public-assets";

/**
 * Upload file to public-assets bucket (e.g. brand-kit logo/font).
 * Returns public URL.
 */
export async function uploadToPublicAssets(
  path: string,
  buffer: Buffer,
  contentType: string,
): Promise<string> {
  const supabase = createSupabaseAdminClient();
  const { error: uploadError } = await supabase.storage
    .from(PUBLIC_ASSETS_BUCKET)
    .upload(path, buffer, { contentType, upsert: false });
  if (uploadError) throw new Error(`storage.uploadToPublicAssets: ${uploadError.message}`);
  const { data: urlData } = supabase.storage.from(PUBLIC_ASSETS_BUCKET).getPublicUrl(path);
  return urlData.publicUrl;
}
