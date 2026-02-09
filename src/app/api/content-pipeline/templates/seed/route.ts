import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { generateEmbedding, createTemplateEmbeddingText } from '@/lib/ai/embeddings';

const SEED_TEMPLATES = [
  {
    name: 'Before/After Transformation',
    category: 'story',
    description: 'Show a dramatic before/after with specific results',
    structure: '[BOLD RESULT STATEMENT]\n\n[BEFORE SITUATION - paint the pain]\n\n[TURNING POINT - what changed]\n\n[AFTER RESULT - specific numbers]\n\n[TAKEAWAY - what the reader can learn]',
    use_cases: ['Case studies', 'Client wins', 'Personal growth stories'],
    tags: ['storytelling', 'results', 'transformation'],
  },
  {
    name: 'Contrarian Take',
    category: 'contrarian',
    description: 'Challenge conventional wisdom with evidence',
    structure: '[CONTROVERSIAL STATEMENT]\n\n[WHAT EVERYONE BELIEVES]\n\n[WHY IT\'S WRONG - evidence/experience]\n\n[WHAT TO DO INSTEAD]\n\n[CALL TO ACTION]',
    use_cases: ['Industry hot takes', 'Myth busting', 'Reframing problems'],
    tags: ['contrarian', 'thought-leadership', 'debate'],
  },
  {
    name: 'Step-by-Step Framework',
    category: 'framework',
    description: 'Teach a process with numbered steps',
    structure: '[RESULT YOU CAN ACHIEVE]\n\n[WHY THIS MATTERS]\n\nStep 1: [ACTION] - [BRIEF EXPLANATION]\nStep 2: [ACTION] - [BRIEF EXPLANATION]\nStep 3: [ACTION] - [BRIEF EXPLANATION]\n\n[SUMMARY + CTA]',
    use_cases: ['How-to guides', 'Process breakdowns', 'Tutorials'],
    tags: ['educational', 'framework', 'actionable'],
  },
  {
    name: 'Mistake I Made',
    category: 'story',
    description: 'Vulnerable confession that teaches a lesson',
    structure: '[CONFESSION/ADMISSION]\n\n[WHAT I DID WRONG]\n\n[THE CONSEQUENCES]\n\n[WHAT I LEARNED]\n\n[ADVICE FOR THE READER]',
    use_cases: ['Lessons learned', 'Vulnerability posts', 'Teaching through failure'],
    tags: ['vulnerability', 'lessons', 'authenticity'],
  },
  {
    name: 'Data-Driven Insight',
    category: 'educational',
    description: 'Share surprising data with analysis',
    structure: '[SURPRISING STATISTIC OR DATA POINT]\n\n[CONTEXT - why this matters]\n\n[ANALYSIS - what it means]\n\n[IMPLICATIONS - what to do about it]\n\n[QUESTION FOR ENGAGEMENT]',
    use_cases: ['Industry trends', 'Research findings', 'Market analysis'],
    tags: ['data', 'research', 'insights'],
  },
  {
    name: 'Unpopular Opinion',
    category: 'contrarian',
    description: 'State a strong opinion and defend it',
    structure: 'Unpopular opinion: [BOLD STATEMENT]\n\n[YOUR REASONING - 2-3 paragraphs]\n\n[ACKNOWLEDGE THE COUNTERARGUMENT]\n\n[WHY YOU STILL BELIEVE THIS]\n\n[ASK: agree or disagree?]',
    use_cases: ['Thought leadership', 'Debate starters', 'Position pieces'],
    tags: ['opinion', 'debate', 'engagement'],
  },
  {
    name: 'Quick Tip',
    category: 'educational',
    description: 'One actionable tip with context',
    structure: '[ONE-LINE TIP]\n\n[WHY IT WORKS]\n\n[EXAMPLE]\n\n[HOW TO IMPLEMENT TODAY]',
    use_cases: ['Daily tips', 'Quick wins', 'Productivity hacks'],
    tags: ['tips', 'quick', 'actionable'],
  },
  {
    name: 'Client Story',
    category: 'case_study',
    description: 'Real client example with results',
    structure: '[CLIENT RESULT - specific number]\n\n[THEIR SITUATION BEFORE]\n\n[WHAT WE DID - 2-3 key actions]\n\n[THE RESULTS - metrics]\n\n[LESSON FOR THE READER]',
    use_cases: ['Social proof', 'Service promotion', 'Credibility building'],
    tags: ['case-study', 'social-proof', 'results'],
  },
  {
    name: 'Observation/Trend',
    category: 'educational',
    description: 'Spot a trend and analyze implications',
    structure: '[TREND OBSERVATION]\n\n[HOW THINGS USED TO WORK]\n\n[WHAT\'S CHANGING]\n\n[WHY IT MATTERS]\n\n[WHAT SMART PEOPLE ARE DOING ABOUT IT]',
    use_cases: ['Market commentary', 'Future predictions', 'Industry analysis'],
    tags: ['trends', 'analysis', 'forward-looking'],
  },
  {
    name: 'Question Post',
    category: 'question',
    description: 'Spark discussion with a thought-provoking question',
    structure: '[SET UP THE CONTEXT - 2-3 sentences]\n\n[THE QUESTION]\n\n[YOUR TAKE - brief]\n\n[INVITE RESPONSES]',
    use_cases: ['Community engagement', 'Research', 'Networking'],
    tags: ['engagement', 'question', 'community'],
  },
];

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createSupabaseAdminClient();

    // Check if user already has templates
    const { count } = await supabase
      .from('cp_post_templates')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', session.user.id);

    if (count && count >= 10) {
      return NextResponse.json({ message: 'Templates already seeded', seeded: 0 });
    }

    // Insert templates with embeddings
    const insertData = [];
    for (const template of SEED_TEMPLATES) {
      let embedding: number[] | null = null;
      try {
        const embeddingText = createTemplateEmbeddingText(template);
        embedding = await generateEmbedding(embeddingText);
      } catch {
        // Continue without embedding
      }

      const row: Record<string, unknown> = {
        user_id: session.user.id,
        ...template,
      };
      if (embedding) {
        row.embedding = JSON.stringify(embedding);
      }
      insertData.push(row);
    }

    const { data, error } = await supabase
      .from('cp_post_templates')
      .insert(insertData)
      .select('id, name');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      message: 'Templates seeded successfully',
      seeded: data?.length || 0,
    }, { status: 201 });
  } catch (error) {
    console.error('Template seed error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
