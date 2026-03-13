/**
 * @jest-environment node
 */

import { getArchetypeSchema, listArchetypes, ARCHETYPES } from '@/lib/schemas/archetypes';
import type { Archetype } from '@/lib/schemas/archetypes';

// ─── Registry Tests ──────────────────────────────────────────────

describe('Archetype registry', () => {
  it('has a schema for every archetype', () => {
    for (const archetype of ARCHETYPES) {
      const schema = getArchetypeSchema(archetype);
      expect(schema).toBeDefined();
      expect(schema.publishSchema).toBeDefined();
      expect(schema.guidelines).toBeTruthy();
      expect(schema.description).toBeTruthy();
    }
  });

  it('listArchetypes returns all 10 archetypes', () => {
    const list = listArchetypes();
    expect(list).toHaveLength(10);
    expect(list[0]).toHaveProperty('archetype');
    expect(list[0]).toHaveProperty('description');
  });

  it('ARCHETYPES matches the canonical list in lead-magnet types', () => {
    expect(ARCHETYPES).toEqual([
      'single-breakdown',
      'single-system',
      'focused-toolkit',
      'single-calculator',
      'focused-directory',
      'mini-training',
      'one-story',
      'prompt',
      'assessment',
      'workflow',
    ]);
  });

  it('getArchetypeSchema throws for unknown archetype', () => {
    expect(() => getArchetypeSchema('nonexistent' as Archetype)).toThrow();
  });
});

// ─── Single Breakdown ────────────────────────────────────────────

describe('single-breakdown schema', () => {
  const getSchema = () => getArchetypeSchema('single-breakdown').publishSchema;

  it('validates correct content', () => {
    const result = getSchema().safeParse({
      headline: 'The 5-Step System for Agency Leads',
      problem_statement: 'Most agencies struggle to generate consistent inbound leads.',
      call_to_action: 'Get the full breakdown free',
      sections: [
        {
          title: 'Step 1: Audit',
          body: 'Start by auditing your current pipeline. Look at where leads are dropping off and identify the biggest gaps.',
        },
        {
          title: 'Step 2: Build',
          body: 'Build a content engine that runs on autopilot. The key is consistency over volume — three posts per week beats ten random ones.',
        },
        {
          title: 'Step 3: Convert',
          body: 'Set up a conversion path from content to lead magnet to call. Every post should have a clear next step for the reader.',
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects content with too few sections', () => {
    const result = getSchema().safeParse({
      headline: 'Short Guide',
      problem_statement: 'A problem statement here that is long enough.',
      call_to_action: 'Get it',
      sections: [
        {
          title: 'Only one',
          body: 'Not enough sections to make a breakdown useful for the reader.',
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('rejects content with missing headline', () => {
    const result = getSchema().safeParse({
      problem_statement: 'A problem statement here that is long enough.',
      call_to_action: 'Get it',
      sections: [
        {
          title: 'Step 1',
          body: 'Body text that is long enough to pass the minimum length validation check.',
        },
        {
          title: 'Step 2',
          body: 'Body text that is long enough to pass the minimum length validation check.',
        },
        {
          title: 'Step 3',
          body: 'Body text that is long enough to pass the minimum length validation check.',
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('rejects headline that is too short', () => {
    const result = getSchema().safeParse({
      headline: 'Short',
      problem_statement: 'A problem statement here that is long enough.',
      call_to_action: 'Get it',
      sections: [
        {
          title: 'Step 1',
          body: 'Body text that is long enough to pass the minimum length validation check.',
        },
        {
          title: 'Step 2',
          body: 'Body text that is long enough to pass the minimum length validation check.',
        },
        {
          title: 'Step 3',
          body: 'Body text that is long enough to pass the minimum length validation check.',
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('accepts optional fields', () => {
    const result = getSchema().safeParse({
      headline: 'The 5-Step System for Agency Leads',
      subheadline: 'A proven approach that works',
      problem_statement: 'Most agencies struggle to generate consistent inbound leads.',
      proof_points: ['Used by 500+ agencies', '3x pipeline growth'],
      call_to_action: 'Get the full breakdown free',
      sections: [
        {
          title: 'Step 1: Audit',
          body: 'Start by auditing your current pipeline. Look at where leads are dropping off and identify gaps.',
          key_insight: 'Most pipelines leak at stage 2',
        },
        {
          title: 'Step 2: Build',
          body: 'Build a content engine that runs on autopilot. The key is consistency over volume — three posts beats ten.',
        },
        {
          title: 'Step 3: Convert',
          body: 'Set up a conversion path from content to lead magnet to call. Every post should have a clear next step.',
        },
      ],
    });
    expect(result.success).toBe(true);
  });
});

// ─── Single System ───────────────────────────────────────────────

describe('single-system schema', () => {
  const getSchema = () => getArchetypeSchema('single-system').publishSchema;

  it('validates correct content with component_name and how_it_connects', () => {
    const result = getSchema().safeParse({
      headline: 'The Client Acquisition System',
      problem_statement: 'Most freelancers have no repeatable way to win new clients consistently.',
      call_to_action: 'Download the full system',
      sections: [
        {
          title: 'Content Engine',
          body: 'The content engine generates inbound interest by publishing three times per week on LinkedIn using a specific framework.',
          component_name: 'Content Engine',
          how_it_connects: 'Feeds the pipeline with warm leads',
        },
        {
          title: 'Pipeline Manager',
          body: 'A simple spreadsheet tracks every lead from first touch to signed contract, with automated follow-up reminders built in.',
          component_name: 'Pipeline Manager',
          how_it_connects: 'Converts content leads to booked calls',
        },
        {
          title: 'Onboarding Flow',
          body: 'Once a client says yes, the onboarding flow handles welcome email, contract signing, and first deliverable scheduling automatically.',
          component_name: 'Onboarding Flow',
          how_it_connects: 'Ensures smooth handoff from sales to delivery',
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects sections without component_name', () => {
    const result = getSchema().safeParse({
      headline: 'The Client Acquisition System',
      problem_statement: 'Most freelancers have no repeatable way to win new clients.',
      call_to_action: 'Download the full system',
      sections: [
        {
          title: 'Content Engine',
          body: 'The content engine generates inbound interest by publishing consistently on LinkedIn.',
        },
        {
          title: 'Pipeline Manager',
          body: 'A simple spreadsheet tracks every lead from first touch to signed contract.',
        },
        {
          title: 'Onboarding Flow',
          body: 'Once a client says yes, the onboarding flow handles everything automatically.',
        },
      ],
    });
    expect(result.success).toBe(false);
  });
});

// ─── Focused Toolkit ─────────────────────────────────────────────

describe('focused-toolkit schema', () => {
  const getSchema = () => getArchetypeSchema('focused-toolkit').publishSchema;

  it('validates correct content with tools array', () => {
    const result = getSchema().safeParse({
      headline: 'The Agency Proposal Toolkit',
      problem_statement: 'Agencies waste hours building proposals from scratch every time.',
      call_to_action: 'Grab the toolkit',
      tools: [
        {
          name: 'Proposal Template',
          description:
            'A fill-in-the-blank proposal template that covers scope, timeline, and pricing.',
          use_case: 'When a prospect asks for a formal proposal after a discovery call',
        },
        {
          name: 'Scope Calculator',
          description:
            'Spreadsheet that estimates hours based on deliverable type and complexity level.',
          use_case: 'During the scoping phase to set client expectations on timeline',
        },
        {
          name: 'Follow-Up Sequence',
          description:
            'Five-email sequence with subject lines and send timing for post-proposal follow-up.',
          use_case: 'After sending a proposal to keep momentum without being pushy',
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects content with fewer than 3 tools', () => {
    const result = getSchema().safeParse({
      headline: 'The Agency Proposal Toolkit',
      problem_statement: 'Agencies waste hours building proposals from scratch every time.',
      call_to_action: 'Grab the toolkit',
      tools: [
        {
          name: 'Proposal Template',
          description: 'A fill-in-the-blank proposal template.',
          use_case: 'When a prospect asks for a formal proposal',
        },
      ],
    });
    expect(result.success).toBe(false);
  });
});

// ─── Single Calculator ───────────────────────────────────────────

describe('single-calculator schema', () => {
  const getSchema = () => getArchetypeSchema('single-calculator').publishSchema;

  it('validates correct content with inputs and formula', () => {
    const result = getSchema().safeParse({
      headline: 'LinkedIn ROI Calculator',
      problem_statement:
        'Most people have no idea if their LinkedIn effort is actually worth the time investment.',
      call_to_action: 'Calculate your ROI now',
      inputs: [
        { label: 'Hours per week on LinkedIn', type: 'number', placeholder: 'e.g. 5' },
        { label: 'Average deal size', type: 'number', placeholder: 'e.g. 5000' },
      ],
      formula_description:
        'Multiplies weekly hours by your hourly rate to calculate opportunity cost, then compares against expected deal value from LinkedIn leads.',
      output_format:
        'Shows ROI as a percentage with a breakdown of time invested vs revenue generated.',
    });
    expect(result.success).toBe(true);
  });

  it('rejects content missing inputs', () => {
    const result = getSchema().safeParse({
      headline: 'LinkedIn ROI Calculator',
      problem_statement: 'Most people have no idea if their LinkedIn effort is worth it.',
      call_to_action: 'Calculate your ROI now',
      inputs: [],
      formula_description: 'Some formula',
      output_format: 'Some format',
    });
    expect(result.success).toBe(false);
  });
});

// ─── Focused Directory ───────────────────────────────────────────

describe('focused-directory schema', () => {
  const getSchema = () => getArchetypeSchema('focused-directory').publishSchema;

  it('validates correct content with resources array', () => {
    const result = getSchema().safeParse({
      headline: 'The Ultimate B2B SaaS Tools Directory',
      problem_statement:
        'B2B founders waste weeks evaluating tools that other founders already vetted and rejected.',
      call_to_action: 'Get the full directory',
      resources: [
        {
          name: 'Lemlist',
          url: 'https://lemlist.com',
          description: 'Cold email outreach tool with built-in warmup and personalization.',
          category: 'Outreach',
        },
        {
          name: 'Apollo',
          url: 'https://apollo.io',
          description: 'Lead database with enrichment and sequencing capabilities.',
          category: 'Prospecting',
        },
        {
          name: 'Loom',
          url: 'https://loom.com',
          description: 'Async video messaging for sales follow-ups and demos.',
          category: 'Communication',
        },
        {
          name: 'Notion',
          url: 'https://notion.so',
          description: 'All-in-one workspace for docs, wikis, and project management.',
          category: 'Operations',
        },
        {
          name: 'Stripe',
          url: 'https://stripe.com',
          description: 'Payment processing with subscription billing and invoicing.',
          category: 'Billing',
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects content with fewer than 5 resources', () => {
    const result = getSchema().safeParse({
      headline: 'The Ultimate B2B SaaS Tools Directory',
      problem_statement: 'Founders waste weeks evaluating tools that others already vetted.',
      call_to_action: 'Get the full directory',
      resources: [
        {
          name: 'Lemlist',
          url: 'https://lemlist.com',
          description: 'Cold email tool.',
          category: 'Outreach',
        },
        {
          name: 'Apollo',
          url: 'https://apollo.io',
          description: 'Lead database.',
          category: 'Prospecting',
        },
      ],
    });
    expect(result.success).toBe(false);
  });
});

// ─── Mini Training ───────────────────────────────────────────────

describe('mini-training schema', () => {
  const getSchema = () => getArchetypeSchema('mini-training').publishSchema;

  it('validates correct content with lessons array', () => {
    const result = getSchema().safeParse({
      headline: 'LinkedIn Content Bootcamp: 3-Day Crash Course',
      problem_statement:
        'Most people know they should post on LinkedIn but have no idea what to write or how to structure it.',
      call_to_action: 'Start the free training',
      lessons: [
        {
          title: 'Day 1: Your Content Positioning',
          objective: 'Define what you are known for on LinkedIn',
          content:
            'In this lesson you will identify your unique angle — the intersection of your expertise, your audience pain, and what competitors are NOT saying. We use the Positioning Canvas exercise.',
          exercise:
            'Complete the Positioning Canvas: fill in your expertise, audience, and gap columns.',
        },
        {
          title: 'Day 2: The Hook Framework',
          objective: 'Write scroll-stopping opening lines',
          content:
            'Today you learn the five hook types that drive engagement: Question, Contrarian, Story, Stat, and Direct. Each type works for different goals. We will write three hooks using each framework.',
          exercise: 'Write one hook of each type for your main topic. Post your best one.',
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects content with only one lesson', () => {
    const result = getSchema().safeParse({
      headline: 'LinkedIn Content Bootcamp',
      problem_statement: 'Most people know they should post but have no idea how to structure it.',
      call_to_action: 'Start the free training',
      lessons: [
        {
          title: 'Day 1',
          objective: 'Define positioning',
          content: 'In this lesson you will identify your unique angle.',
          exercise: 'Complete the canvas.',
        },
      ],
    });
    expect(result.success).toBe(false);
  });
});

// ─── One Story ───────────────────────────────────────────────────

describe('one-story schema', () => {
  const getSchema = () => getArchetypeSchema('one-story').publishSchema;

  it('validates correct content with narrative', () => {
    const result = getSchema().safeParse({
      headline: 'How I Went From Zero to 50 Clients in 6 Months',
      problem_statement:
        'Most consultants think they need years of content before landing their first client from LinkedIn.',
      call_to_action: 'Read the full story',
      story_hook:
        'I was two months from shutting down my consultancy when a single LinkedIn post changed everything.',
      narrative:
        'It was March 2024 and I had exactly zero inbound leads. My savings were running out. I had tried cold email, networking events, even a failed podcast. Nothing worked. Then I posted a raw, honest breakdown of a client project that went wrong — what I learned, what I would do differently. That post got 47,000 views. Within a week I had 12 discovery calls booked. Within a month I had signed 8 new clients. The total revenue from that single post: $127,000. Here is exactly what I did and why it worked so well.',
      lesson:
        'Vulnerability and specificity beat polished perfection. People connect with real stories, not case studies.',
      takeaway:
        'Write one post about your biggest professional mistake and what you learned. Be specific with numbers and outcomes.',
    });
    expect(result.success).toBe(true);
  });

  it('rejects content with narrative too short', () => {
    const result = getSchema().safeParse({
      headline: 'How I Went From Zero to 50 Clients',
      problem_statement: 'Most consultants think they need years of content.',
      call_to_action: 'Read the full story',
      story_hook: 'I was broke when it all changed.',
      narrative: 'Short story.',
      lesson: 'Be vulnerable.',
      takeaway: 'Post about mistakes.',
    });
    expect(result.success).toBe(false);
  });
});

// ─── Prompt ──────────────────────────────────────────────────────

describe('prompt schema', () => {
  const getSchema = () => getArchetypeSchema('prompt').publishSchema;

  it('validates correct content with prompts array', () => {
    const result = getSchema().safeParse({
      headline: 'The LinkedIn Content Prompt Pack',
      problem_statement:
        'Staring at a blank screen is the number one reason people quit posting on LinkedIn.',
      call_to_action: 'Download all 10 prompts',
      prompts: [
        {
          title: 'The Authority Builder',
          prompt_text:
            'Write a LinkedIn post about a common misconception in [your industry]. Start with "Most people think [misconception]. Here is what actually works:" Then share 3 specific things you do differently, with one concrete example for each.',
          example_output:
            'Most people think cold email is dead. Here is what actually works: 1) Personalized first lines based on recent activity...',
          when_to_use: 'When you want to establish expertise and challenge conventional wisdom',
        },
        {
          title: 'The Client Win Story',
          prompt_text:
            'Describe a recent client result. Include: the problem they came to you with, what you did (be specific), the measurable outcome, and the one thing that made the biggest difference.',
          example_output:
            'Last month a SaaS founder came to me with a 2% trial-to-paid conversion rate...',
          when_to_use: 'When you have a fresh win to share and want to attract similar clients',
        },
        {
          title: 'The Contrarian Take',
          prompt_text:
            'Name one popular piece of advice in your industry that you disagree with. Explain why it is wrong, what you do instead, and share evidence from your experience.',
          example_output: 'Everyone says you need to post daily on LinkedIn. I disagree...',
          when_to_use: 'When you want maximum engagement through debate and strong positioning',
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects content with fewer than 3 prompts', () => {
    const result = getSchema().safeParse({
      headline: 'The LinkedIn Content Prompt Pack',
      problem_statement: 'Staring at a blank screen is the top reason people quit posting.',
      call_to_action: 'Download prompts',
      prompts: [
        {
          title: 'One Prompt',
          prompt_text: 'Write something good.',
          example_output: 'Example here.',
          when_to_use: 'Whenever',
        },
      ],
    });
    expect(result.success).toBe(false);
  });
});

// ─── Assessment ──────────────────────────────────────────────────

describe('assessment schema', () => {
  const getSchema = () => getArchetypeSchema('assessment').publishSchema;

  it('validates correct content with questions, scoring_rubric, and result_ranges', () => {
    const result = getSchema().safeParse({
      headline: 'How Strong Is Your LinkedIn Presence?',
      problem_statement:
        'Most professionals have no objective way to measure whether their LinkedIn activity is actually working.',
      call_to_action: 'Take the assessment',
      questions: [
        {
          question: 'How often do you post original content on LinkedIn?',
          options: ['Never', 'Monthly', 'Weekly', '3+ times per week'],
        },
        {
          question: 'What percentage of your inbound leads come from LinkedIn?',
          options: ['0%', '1-10%', '11-25%', '25%+'],
        },
        {
          question: 'Do you have a documented LinkedIn content strategy?',
          options: ['No strategy', 'Informal ideas', 'Written plan', 'Written plan with metrics'],
        },
        {
          question: 'How many meaningful conversations do you start per week via LinkedIn?',
          options: ['0', '1-3', '4-10', '10+'],
        },
        {
          question: 'What is your average post engagement rate?',
          options: ['No idea', 'Under 1%', '1-3%', 'Over 3%'],
        },
      ],
      scoring_rubric:
        'Each answer is scored 0-3 from left to right. Total score ranges from 0 to 15.',
      result_ranges: [
        {
          min: 0,
          max: 5,
          label: 'LinkedIn Ghost',
          description:
            'You are barely visible on LinkedIn. There is a huge untapped opportunity waiting for you.',
        },
        {
          min: 6,
          max: 10,
          label: 'LinkedIn Dabbler',
          description:
            'You show up sometimes but lack consistency. A structured approach would multiply your results.',
        },
        {
          min: 11,
          max: 15,
          label: 'LinkedIn Pro',
          description:
            'You are doing most things right. Fine-tuning your strategy could unlock the next level of growth.',
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects content with fewer than 5 questions', () => {
    const result = getSchema().safeParse({
      headline: 'How Strong Is Your LinkedIn Presence?',
      problem_statement: 'No objective way to measure LinkedIn performance.',
      call_to_action: 'Take the assessment',
      questions: [
        { question: 'How often do you post?', options: ['Never', 'Sometimes'] },
        { question: 'Do you have a strategy?', options: ['No', 'Yes'] },
      ],
      scoring_rubric: 'Score 0-1 per question.',
      result_ranges: [
        { min: 0, max: 1, label: 'Beginner', description: 'Just starting out on LinkedIn.' },
      ],
    });
    expect(result.success).toBe(false);
  });
});

// ─── Workflow ────────────────────────────────────────────────────

describe('workflow schema', () => {
  const getSchema = () => getArchetypeSchema('workflow').publishSchema;

  it('validates correct content with steps array', () => {
    const result = getSchema().safeParse({
      headline: 'The Weekly Content Production Workflow',
      problem_statement:
        'Content creators spend more time deciding what to post than actually creating, leading to inconsistency and burnout.',
      call_to_action: 'Steal this workflow',
      steps: [
        {
          trigger: 'Monday morning',
          action: 'Brain dump 10 content ideas from client conversations and industry news',
          tool: 'Notion',
          output: 'Ranked list of 5 top ideas with hooks drafted',
        },
        {
          trigger: 'Tuesday morning',
          action: 'Write and edit 3 posts using the top ideas from Monday',
          tool: 'Google Docs',
          output: '3 polished posts ready to schedule',
        },
        {
          trigger: 'Wednesday through Friday',
          action: 'Schedule one post per day and engage with 10 comments on other posts',
          tool: 'Buffer + LinkedIn',
          output: '3 posts published, 30 meaningful interactions logged',
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects content with fewer than 3 steps', () => {
    const result = getSchema().safeParse({
      headline: 'The Weekly Content Workflow',
      problem_statement: 'Creators spend more time deciding what to post than creating.',
      call_to_action: 'Steal this workflow',
      steps: [{ trigger: 'Monday', action: 'Write posts', tool: 'Notion', output: 'Posts ready' }],
    });
    expect(result.success).toBe(false);
  });
});

// ─── Cross-Archetype Validation ──────────────────────────────────

describe('cross-archetype validation', () => {
  it('all archetypes require headline and problem_statement from base schema', () => {
    for (const archetype of ARCHETYPES) {
      const schema = getArchetypeSchema(archetype).publishSchema;
      const result = schema.safeParse({});
      expect(result.success).toBe(false);
    }
  });

  it('all guidelines are at least 200 characters', () => {
    for (const archetype of ARCHETYPES) {
      const def = getArchetypeSchema(archetype);
      expect(def.guidelines.length).toBeGreaterThan(200);
    }
  });

  it('all descriptions are at least 20 characters', () => {
    for (const archetype of ARCHETYPES) {
      const def = getArchetypeSchema(archetype);
      expect(def.description.length).toBeGreaterThan(20);
    }
  });
});
