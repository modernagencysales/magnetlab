import OpenAI from 'openai';

let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not configured');
  }
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openaiClient;
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const openai = getOpenAIClient();

  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
    encoding_format: 'float',
  });

  return response.data[0].embedding;
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }

  const openai = getOpenAIClient();

  const BATCH_SIZE = 100;
  const results: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: batch,
      encoding_format: 'float',
    });

    results.push(...response.data.map((d) => d.embedding));
  }

  return results;
}

export function createTemplateEmbeddingText(template: {
  name: string;
  category?: string | null;
  description?: string | null;
  structure: string;
  use_cases?: string[] | null;
  tags?: string[] | null;
}): string {
  const parts = [
    `Template: ${template.name}`,
    template.category ? `Category: ${template.category}` : null,
    template.description ? `Description: ${template.description}` : null,
    `Structure: ${template.structure}`,
    template.use_cases?.length ? `Use cases: ${template.use_cases.join(', ')}` : null,
    template.tags?.length ? `Tags: ${template.tags.join(', ')}` : null,
  ].filter(Boolean);

  return parts.join('\n');
}

export function createIdeaEmbeddingText(idea: {
  title: string;
  core_insight?: string | null;
  full_context?: string | null;
  why_post_worthy?: string | null;
  content_type?: string | null;
  content_pillar?: string | null;
  hook?: string | null;
}): string {
  const parts = [
    `Title: ${idea.title}`,
    idea.core_insight ? `Core insight: ${idea.core_insight}` : null,
    idea.full_context ? `Context: ${idea.full_context}` : null,
    idea.why_post_worthy ? `Why post-worthy: ${idea.why_post_worthy}` : null,
    idea.content_type ? `Content type: ${idea.content_type}` : null,
    idea.content_pillar ? `Content pillar: ${idea.content_pillar}` : null,
    idea.hook ? `Hook: ${idea.hook}` : null,
  ].filter(Boolean);

  return parts.join('\n');
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;
  return dotProduct / denominator;
}

export function isEmbeddingsConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY;
}
