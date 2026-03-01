// API Route: External Knowledge Ingestion for AI Brain
// POST /api/external/ingest-knowledge
//
// Allows gtm-system to push structured knowledge (from Blueprint analysis,
// posts, client intake) directly into a magnetlab user's AI Brain
// (cp_knowledge_entries table) with embeddings. Authenticated via Bearer token.

import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import { ingestKnowledge, type IngestKnowledgeEntry } from '@/server/services/external.service';

const VALID_KNOWLEDGE_TYPES = [
  'how_to', 'insight', 'story', 'question',
  'objection', 'mistake', 'decision', 'market_intel',
] as const;

function authenticateRequest(request: Request): boolean {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;

  const token = authHeader.slice(7);
  const expectedKey = process.env.EXTERNAL_API_KEY;

  if (!expectedKey) {
    logApiError('external/ingest-knowledge/auth', new Error('EXTERNAL_API_KEY env var is not set'));
    return false;
  }

  const tokenBuf = Buffer.from(token);
  const expectedBuf = Buffer.from(expectedKey);
  if (tokenBuf.length !== expectedBuf.length) return false;
  return timingSafeEqual(tokenBuf, expectedBuf);
}

export async function POST(request: Request) {
  try {
    if (!authenticateRequest(request)) {
      return ApiErrors.unauthorized('Invalid or missing API key');
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return ApiErrors.validationError('Invalid JSON in request body');
    }

    const { user_id, entries } = body as {
      user_id?: string;
      entries?: IngestKnowledgeEntry[];
    };

    if (!user_id || typeof user_id !== 'string') {
      return ApiErrors.validationError('user_id is required');
    }
    if (!entries || !Array.isArray(entries) || entries.length === 0) {
      return ApiErrors.validationError('entries array is required and must be non-empty');
    }

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      if (!entry.content || typeof entry.content !== 'string') {
        return ApiErrors.validationError(`entries[${i}].content is required and must be a string`);
      }
      if (!entry.knowledge_type || typeof entry.knowledge_type !== 'string') {
        return ApiErrors.validationError(`entries[${i}].knowledge_type is required and must be a string`);
      }
      if (!VALID_KNOWLEDGE_TYPES.includes(entry.knowledge_type as (typeof VALID_KNOWLEDGE_TYPES)[number])) {
        return ApiErrors.validationError(
          `entries[${i}].knowledge_type must be one of: ${VALID_KNOWLEDGE_TYPES.join(', ')}`
        );
      }
    }

    const result = await ingestKnowledge({ user_id, entries });

    if (!result.success) {
      return ApiErrors.internalError('Failed to insert knowledge entries');
    }

    return NextResponse.json(
      {
        success: true,
        entries_created: result.entries_created,
      },
      { status: 201 }
    );
  } catch (error) {
    logApiError('external/ingest-knowledge', error);
    return ApiErrors.internalError('Failed to ingest knowledge');
  }
}
