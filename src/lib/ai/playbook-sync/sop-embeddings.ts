import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { generateEmbedding } from '@/lib/ai/embeddings';
import { createHash } from 'crypto';
import { logger } from '@trigger.dev/sdk/v3';
import type { RepoFile } from './github-client';

export interface CachedSop {
  filePath: string;
  title: string;
  module: string;
  content: string;
  embedding: number[];
}

function contentHash(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

function extractFrontmatter(content: string): { title: string; id: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return { title: '', id: '' };
  const titleMatch = match[1].match(/title:\s*["']?(.+?)["']?\s*$/m);
  const idMatch = match[1].match(/id:\s*(.+)/);
  return {
    title: titleMatch?.[1] || '',
    id: idMatch?.[1]?.trim() || '',
  };
}

function extractModule(filePath: string): string {
  const match = filePath.match(/module-(\d+)/);
  return match ? `module-${match[1]}` : 'weekly-guide';
}

/**
 * Sync SOP embeddings: re-embed only files whose content hash changed.
 * Returns all SOPs with their embeddings for matching.
 */
export async function syncSopEmbeddings(sopFiles: RepoFile[]): Promise<CachedSop[]> {
  const supabase = createSupabaseAdminClient();

  // Fetch existing cache
  const { data: cached } = await supabase
    .from('cp_sop_embeddings')
    .select('file_path, content_hash, embedding, title, module');

  const cacheMap = new Map(
    (cached || []).map((c) => [c.file_path, c])
  );

  const results: CachedSop[] = [];
  let reembedded = 0;

  for (const file of sopFiles) {
    const hash = contentHash(file.content);
    const existing = cacheMap.get(file.path);
    const { title } = extractFrontmatter(file.content);
    const module = extractModule(file.path);

    if (existing && existing.content_hash === hash && existing.embedding) {
      // Cache hit — use existing embedding
      const embeddingArray = typeof existing.embedding === 'string'
        ? JSON.parse(existing.embedding)
        : existing.embedding;
      results.push({
        filePath: file.path,
        title: existing.title || title,
        module: existing.module || module,
        content: file.content,
        embedding: embeddingArray,
      });
      continue;
    }

    // Cache miss — re-embed
    logger.info('Re-embedding SOP', { path: file.path });
    const embeddingText = `${title}\n\n${file.content.slice(0, 8000)}`;
    const embedding = await generateEmbedding(embeddingText);
    reembedded++;

    // Upsert to cache
    await supabase
      .from('cp_sop_embeddings')
      .upsert(
        {
          file_path: file.path,
          content_hash: hash,
          embedding: JSON.stringify(embedding),
          title,
          module,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'file_path' }
      );

    results.push({ filePath: file.path, title, module, content: file.content, embedding });
  }

  logger.info('SOP embedding sync complete', {
    total: sopFiles.length,
    reembedded,
    cached: sopFiles.length - reembedded,
  });

  return results;
}
