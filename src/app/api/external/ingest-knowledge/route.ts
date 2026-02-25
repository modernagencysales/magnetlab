// API Route: External Knowledge Ingestion for AI Brain
// POST /api/external/ingest-knowledge
//
// Allows gtm-system to push structured knowledge (from Blueprint analysis,
// posts, client intake) directly into a magnetlab user's AI Brain
// (cp_knowledge_entries table) with embeddings. Authenticated via Bearer token.

import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import OpenAI from 'openai';

// --- Auth ---

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

// --- Embeddings ---

const openai = new OpenAI();

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });
  return response.data[0].embedding;
}

const VALID_KNOWLEDGE_TYPES = [
  'how_to', 'insight', 'story', 'question',
  'objection', 'mistake', 'decision', 'market_intel',
] as const;

// --- Types ---

interface KnowledgeEntry {
  content: string;
  context?: string;
  knowledge_type: string;
  category?: string;
  tags?: string[];
  quality_score?: number;
  source_label?: string;
}

// --- Route handler ---

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
      entries?: KnowledgeEntry[];
    };

    // Validate user_id
    if (!user_id || typeof user_id !== 'string') {
      return ApiErrors.validationError('user_id is required');
    }

    // Validate entries array
    if (!entries || !Array.isArray(entries) || entries.length === 0) {
      return ApiErrors.validationError('entries array is required and must be non-empty');
    }

    // Validate each entry
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      if (!entry.content || typeof entry.content !== 'string') {
        return ApiErrors.validationError(`entries[${i}].content is required and must be a string`);
      }
      if (!entry.knowledge_type || typeof entry.knowledge_type !== 'string') {
        return ApiErrors.validationError(`entries[${i}].knowledge_type is required and must be a string`);
      }
      if (!VALID_KNOWLEDGE_TYPES.includes(entry.knowledge_type as typeof VALID_KNOWLEDGE_TYPES[number])) {
        return ApiErrors.validationError(
          `entries[${i}].knowledge_type must be one of: ${VALID_KNOWLEDGE_TYPES.join(', ')}`
        );
      }
    }

    // Generate embeddings in batches of 5 with 200ms delay between batches
    const BATCH_SIZE = 5;
    const embeddings: number[][] = [];

    for (let i = 0; i < entries.length; i += BATCH_SIZE) {
      const batch = entries.slice(i, i + BATCH_SIZE);
      const batchEmbeddings = await Promise.all(
        batch.map(entry => generateEmbedding(entry.content))
      );
      embeddings.push(...batchEmbeddings);

      // Delay between batches (skip delay after last batch)
      if (i + BATCH_SIZE < entries.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    // Build insert rows
    const today = new Date().toISOString().split('T')[0];
    const rows = entries.map((entry, idx) => ({
      user_id,
      content: entry.content,
      context: entry.context || null,
      knowledge_type: entry.knowledge_type,
      category: entry.category || 'insight',
      speaker: 'host',
      tags: entry.tags || [],
      quality_score: entry.quality_score ?? 3,
      specificity: true,
      actionability: 'contextual',
      embedding: JSON.stringify(embeddings[idx]),
      source_date: today,
      topics: [],
      transcript_type: entry.source_label || 'external',
    }));

    const supabase = createSupabaseAdminClient();

    const { data, error } = await supabase
      .from('cp_knowledge_entries')
      .insert(rows)
      .select('id');

    if (error) {
      logApiError('external/ingest-knowledge/insert', error);
      return ApiErrors.internalError('Failed to insert knowledge entries');
    }

    return NextResponse.json({
      success: true,
      entries_created: data.length,
    }, { status: 201 });
  } catch (error) {
    logApiError('external/ingest-knowledge', error);
    return ApiErrors.internalError('Failed to ingest knowledge');
  }
}
