/**
 * Content Pipeline Templates Service
 * List, create, update, delete, seed, bulk-import, match.
 */

import { generateEmbedding, createTemplateEmbeddingText } from '@/lib/ai/embeddings';
import { logError } from '@/lib/utils/logger';
import * as cpTemplatesRepo from '@/server/repositories/cp-templates.repo';

const SEED_TEMPLATES = [
  { name: 'Before/After Transformation', category: 'story', description: 'Show a dramatic before/after with specific results', structure: '[BOLD RESULT STATEMENT]\n\n[BEFORE SITUATION - paint the pain]\n\n[TURNING POINT - what changed]\n\n[AFTER RESULT - specific numbers]\n\n[TAKEAWAY - what the reader can learn]', use_cases: ['Case studies', 'Client wins', 'Personal growth stories'], tags: ['storytelling', 'results', 'transformation'] },
  { name: 'Contrarian Take', category: 'contrarian', description: 'Challenge conventional wisdom with evidence', structure: '[CONTROVERSIAL STATEMENT]\n\n[WHAT EVERYONE BELIEVES]\n\n[WHY IT\'S WRONG - evidence/experience]\n\n[WHAT TO DO INSTEAD]\n\n[CALL TO ACTION]', use_cases: ['Industry hot takes', 'Myth busting', 'Reframing problems'], tags: ['contrarian', 'thought-leadership', 'debate'] },
  { name: 'Step-by-Step Framework', category: 'framework', description: 'Teach a process with numbered steps', structure: '[RESULT YOU CAN ACHIEVE]\n\n[WHY THIS MATTERS]\n\nStep 1: [ACTION] - [BRIEF EXPLANATION]\nStep 2: [ACTION] - [BRIEF EXPLANATION]\nStep 3: [ACTION] - [BRIEF EXPLANATION]\n\n[SUMMARY + CTA]', use_cases: ['How-to guides', 'Process breakdowns', 'Tutorials'], tags: ['educational', 'framework', 'actionable'] },
  { name: 'Mistake I Made', category: 'story', description: 'Vulnerable confession that teaches a lesson', structure: '[CONFESSION/ADMISSION]\n\n[WHAT I DID WRONG]\n\n[THE CONSEQUENCES]\n\n[WHAT I LEARNED]\n\n[ADVICE FOR THE READER]', use_cases: ['Lessons learned', 'Vulnerability posts', 'Teaching through failure'], tags: ['vulnerability', 'lessons', 'authenticity'] },
  { name: 'Data-Driven Insight', category: 'educational', description: 'Share surprising data with analysis', structure: '[SURPRISING STATISTIC OR DATA POINT]\n\n[CONTEXT - why this matters]\n\n[ANALYSIS - what it means]\n\n[IMPLICATIONS - what to do about it]\n\n[QUESTION FOR ENGAGEMENT]', use_cases: ['Industry trends', 'Research findings', 'Market analysis'], tags: ['data', 'research', 'insights'] },
  { name: 'Unpopular Opinion', category: 'contrarian', description: 'State a strong opinion and defend it', structure: 'Unpopular opinion: [BOLD STATEMENT]\n\n[YOUR REASONING - 2-3 paragraphs]\n\n[ACKNOWLEDGE THE COUNTERARGUMENT]\n\n[WHY YOU STILL BELIEVE THIS]\n\n[ASK: agree or disagree?]', use_cases: ['Thought leadership', 'Debate starters', 'Position pieces'], tags: ['opinion', 'debate', 'engagement'] },
  { name: 'Quick Tip', category: 'educational', description: 'One actionable tip with context', structure: '[ONE-LINE TIP]\n\n[WHY IT WORKS]\n\n[EXAMPLE]\n\n[HOW TO IMPLEMENT TODAY]', use_cases: ['Daily tips', 'Quick wins', 'Productivity hacks'], tags: ['tips', 'quick', 'actionable'] },
  { name: 'Client Story', category: 'case_study', description: 'Real client example with results', structure: '[CLIENT RESULT - specific number]\n\n[THEIR SITUATION BEFORE]\n\n[WHAT WE DID - 2-3 key actions]\n\n[THE RESULTS - metrics]\n\n[LESSON FOR THE READER]', use_cases: ['Social proof', 'Service promotion', 'Credibility building'], tags: ['case-study', 'social-proof', 'results'] },
  { name: 'Observation/Trend', category: 'educational', description: 'Spot a trend and analyze implications', structure: '[TREND OBSERVATION]\n\n[HOW THINGS USED TO WORK]\n\n[WHAT\'S CHANGING]\n\n[WHY IT MATTERS]\n\n[WHAT SMART PEOPLE ARE DOING ABOUT IT]', use_cases: ['Market commentary', 'Future predictions', 'Industry analysis'], tags: ['trends', 'analysis', 'forward-looking'] },
  { name: 'Question Post', category: 'question', description: 'Spark discussion with a thought-provoking question', structure: '[SET UP THE CONTEXT - 2-3 sentences]\n\n[THE QUESTION]\n\n[YOUR TAKE - brief]\n\n[INVITE RESPONSES]', use_cases: ['Community engagement', 'Research', 'Networking'], tags: ['engagement', 'question', 'community'] },
];

export async function list(userId: string, scope: cpTemplatesRepo.TemplateScope) {
  const { data, error } = await cpTemplatesRepo.listTemplates(userId, scope);
  if (error) {
    logError('cp/templates', error, { step: 'templates_list_error' });
    return { success: false, error: 'database' as const };
  }
  return { success: true, templates: data };
}

export async function create(
  userId: string,
  payload: { name: string; category?: string; description?: string; structure: string; example_posts?: unknown; use_cases?: unknown; tags?: unknown }
) {
  let embedding: number[] | null = null;
  try {
    const embeddingText = createTemplateEmbeddingText({ name: payload.name, category: payload.category, description: payload.description, structure: payload.structure, use_cases: payload.use_cases, tags: payload.tags });
    embedding = await generateEmbedding(embeddingText);
  } catch {
    // continue without embedding
  }
  const row = {
    name: payload.name,
    category: payload.category ?? null,
    description: payload.description ?? null,
    structure: payload.structure,
    example_posts: payload.example_posts ?? null,
    use_cases: payload.use_cases ?? null,
    tags: payload.tags ?? null,
    embedding: embedding ? JSON.stringify(embedding) : undefined,
  };
  const { data, error } = await cpTemplatesRepo.createTemplate(userId, row);
  if (error) {
    logError('cp/templates', error, { step: 'template_create_error' });
    return { success: false, error: 'database' as const };
  }
  return { success: true, template: data };
}

export async function getById(userId: string, id: string) {
  const { data, error } = await cpTemplatesRepo.getTemplateById(id, userId);
  if (error || !data) return { success: false, error: 'not_found' as const };
  return { success: true, template: data };
}

const ALLOWED_UPDATE_FIELDS = ['name', 'category', 'description', 'structure', 'example_posts', 'use_cases', 'tags', 'is_active'];

export async function update(userId: string, id: string, body: Record<string, unknown>) {
  const updates: Record<string, unknown> = {};
  for (const field of ALLOWED_UPDATE_FIELDS) {
    if (field in body) updates[field] = body[field];
  }
  if (Object.keys(updates).length === 0) return { success: false, error: 'validation' as const, message: 'No valid fields to update' };

  const { data, error } = await cpTemplatesRepo.updateTemplate(id, userId, updates);
  if (error) {
    logError('cp/templates', error, { step: 'template_update_error' });
    return { success: false, error: 'database' as const };
  }
  return { success: true, template: data };
}

export async function deleteTemplate(userId: string, id: string) {
  const { error } = await cpTemplatesRepo.deleteTemplate(id, userId);
  if (error) {
    logError('cp/templates', error, { step: 'template_delete_error' });
    return { success: false, error: 'database' as const };
  }
  return { success: true };
}

export async function seed(userId: string) {
  const count = await cpTemplatesRepo.countTemplatesByUser(userId);
  if (count >= 10) return { success: true, message: 'Templates already seeded', seeded: 0 };

  const rows: Array<Record<string, unknown>> = [];
  for (const template of SEED_TEMPLATES) {
    let embedding: number[] | null = null;
    try {
      const embeddingText = createTemplateEmbeddingText(template);
      embedding = await generateEmbedding(embeddingText);
    } catch {
      // continue without embedding
    }
    const row: Record<string, unknown> = { user_id: userId, ...template };
    if (embedding) row.embedding = JSON.stringify(embedding);
    rows.push(row);
  }

  const { data, error } = await cpTemplatesRepo.insertTemplates(userId, rows);
  if (error) {
    logError('cp/templates', error, { step: 'template_seed_error' });
    return { success: false, error: 'database' as const };
  }
  return { success: true, message: 'Templates seeded successfully', seeded: data.length };
}

export async function bulkImport(userId: string, templates: Array<{ name: string; structure: string; category?: string; description?: string; example_posts?: unknown; use_cases?: unknown; tags?: unknown }>) {
  if (templates.length > 50) return { success: false, error: 'validation' as const, message: 'Maximum 50 templates per import' };

  const rows: Array<Record<string, unknown>> = [];
  for (const template of templates) {
    let embedding: number[] | null = null;
    try {
      const embeddingText = createTemplateEmbeddingText(template);
      embedding = await generateEmbedding(embeddingText);
    } catch {
      // continue without embedding
    }
    const row: Record<string, unknown> = {
      user_id: userId,
      name: template.name,
      category: template.category ?? null,
      description: template.description ?? null,
      structure: template.structure,
      example_posts: template.example_posts ?? null,
      use_cases: template.use_cases ?? null,
      tags: template.tags ?? null,
    };
    if (embedding) row.embedding = JSON.stringify(embedding);
    rows.push(row);
  }

  const { data, error } = await cpTemplatesRepo.insertTemplates(userId, rows);
  if (error) {
    logError('cp/templates', error, { step: 'template_bulk_import_error' });
    return { success: false, error: 'database' as const };
  }
  return { success: true, imported: data.length, templates: data };
}

export async function match(userId: string, topicText: string, count: number, minSimilarity: number) {
  const embedding = await generateEmbedding(topicText);
  const { data, error } = await cpTemplatesRepo.matchTemplatesRpc(
    userId,
    JSON.stringify(embedding),
    count,
    minSimilarity
  );
  if (error) {
    logError('cp/templates', error, { step: 'template_match_error' });
    return { success: false, error: 'database' as const };
  }
  return { success: true, matches: data };
}
