/**
 * Content Queue Post Image Upload Route.
 * POST /api/content-queue/posts/[id]/upload-image.
 * Never contains business logic; delegates to contentQueueService.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { logError } from '@/lib/utils/logger';
import * as contentQueueService from '@/server/services/content-queue.service';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: postId } = await params;
    const formData = await request.formData();
    const file = formData.get('image') as File | null;

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: 'No image file provided. Send an "image" field in multipart/form-data.' },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await contentQueueService.uploadQueuePostImage(session.user.id, postId, {
      buffer,
      type: file.type,
      name: file.name,
    });

    return NextResponse.json(result);
  } catch (error) {
    const status = contentQueueService.getStatusCode(error);
    logError('content-queue/upload-image', error, { step: 'upload_error' });
    return NextResponse.json(
      { error: status < 500 ? (error as Error).message : 'Internal server error' },
      { status }
    );
  }
}
