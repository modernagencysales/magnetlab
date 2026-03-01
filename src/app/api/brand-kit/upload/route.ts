// API Route: Brand Kit File Upload (logo or font)
// POST /api/brand-kit/upload

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ApiErrors } from '@/lib/api/errors';
import * as brandKitService from '@/server/services/brand-kit.service';

const LOGO_MIME_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'];
const FONT_MIME_TYPES = ['font/woff2', 'application/font-woff2', 'application/octet-stream'];
const MAX_LOGO_SIZE = 2 * 1024 * 1024; // 2MB
const MAX_FONT_SIZE = 5 * 1024 * 1024; // 5MB
const MIME_TO_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/svg+xml': 'svg',
  'image/webp': 'webp',
  'font/woff2': 'woff2',
  'application/font-woff2': 'woff2',
  'application/octet-stream': 'woff2',
};

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return ApiErrors.unauthorized();

  const formData = await request.formData();
  const file = formData.get('file');
  const type = formData.get('type');

  if (!file || !(file instanceof File)) return ApiErrors.validationError('file is required');
  if (type !== 'logo' && type !== 'font') return ApiErrors.validationError('type must be "logo" or "font"');

  const mimeType = file.type;
  if (type === 'logo') {
    if (!LOGO_MIME_TYPES.includes(mimeType)) {
      return ApiErrors.validationError(`Invalid logo file type: ${mimeType}. Accepted types: PNG, JPEG, SVG, WebP`);
    }
    if (file.size > MAX_LOGO_SIZE) return ApiErrors.validationError('Logo file must be under 2MB');
  }
  if (type === 'font') {
    const fileName = file.name || '';
    const isWoff2 = fileName.toLowerCase().endsWith('.woff2');
    if (!FONT_MIME_TYPES.includes(mimeType) && !isWoff2) {
      return ApiErrors.validationError(`Invalid font file type: ${mimeType}. Accepted type: .woff2`);
    }
    if (file.size > MAX_FONT_SIZE) return ApiErrors.validationError('Font file must be under 5MB');
  }

  const ext = type === 'font' ? 'woff2' : (MIME_TO_EXT[mimeType] || 'bin');
  const path = `branding/${session.user.id}/${type}-${Date.now()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const url = await brandKitService.uploadFile(session.user.id, type, path, buffer, mimeType);
    return NextResponse.json({ url });
  } catch {
    return ApiErrors.databaseError('Upload failed');
  }
}
