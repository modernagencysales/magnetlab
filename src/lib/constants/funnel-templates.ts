import type { SectionType, PageLocation } from '@/lib/types/funnel';

// ============================================
// FUNNEL TEMPLATE TYPES
// ============================================

export interface TemplateSectionDef {
  sectionType: SectionType;
  pageLocation: PageLocation;
  sortOrder: number;
  config: Record<string, unknown>;
}

export interface FunnelTemplate {
  id: string;
  name: string;
  description: string;
  sections: TemplateSectionDef[];
}

// ============================================
// TEMPLATE DEFINITIONS
// ============================================

const PLACEHOLDER_LOGOS = [
  { name: 'Company A', imageUrl: '' },
  { name: 'Company B', imageUrl: '' },
  { name: 'Company C', imageUrl: '' },
];

export const FUNNEL_TEMPLATES: FunnelTemplate[] = [
  // ------------------------------------------
  // 1. Minimal — no sections at all
  // ------------------------------------------
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Clean and simple — just your content, no extra sections',
    sections: [],
  },

  // ------------------------------------------
  // 2. Social Proof — logos + steps + testimonial
  // ------------------------------------------
  {
    id: 'social_proof',
    name: 'Social Proof',
    description: 'Build trust with logos, clear next steps, and a testimonial',
    sections: [
      // Opt-in page
      {
        sectionType: 'logo_bar',
        pageLocation: 'optin',
        sortOrder: 0,
        config: {
          logos: PLACEHOLDER_LOGOS,
        },
      },
      // Thank-you page
      {
        sectionType: 'steps',
        pageLocation: 'thankyou',
        sortOrder: 0,
        config: {
          heading: 'What Happens Next',
          steps: [
            { title: 'Check Your Email', description: 'We just sent you an email with a link to your guide.' },
            { title: 'Read the Guide', description: 'Open it up and start reading — it only takes a few minutes.' },
            { title: 'Take Action', description: 'Apply what you learn and see results fast.' },
          ],
        },
      },
      // Content page
      {
        sectionType: 'logo_bar',
        pageLocation: 'content',
        sortOrder: 0,
        config: {
          logos: PLACEHOLDER_LOGOS,
        },
      },
      {
        sectionType: 'testimonial',
        pageLocation: 'content',
        sortOrder: 50,
        config: {
          quote: 'This guide completely changed how I approach my strategy. Highly recommended.',
          author: 'Happy Reader',
          role: 'Marketing Director',
        },
      },
    ],
  },

  // ------------------------------------------
  // 3. Authority — steps + testimonials + bridge
  // ------------------------------------------
  {
    id: 'authority',
    name: 'Authority',
    description: 'Establish expertise with process steps, proof, and a strong call to action',
    sections: [
      // Opt-in page
      {
        sectionType: 'steps',
        pageLocation: 'optin',
        sortOrder: 0,
        config: {
          heading: 'How It Works',
          steps: [
            { title: 'Sign Up', description: 'Enter your email to get instant access.' },
            { title: 'Learn the Framework', description: 'Follow the step-by-step guide inside.' },
            { title: 'Get Results', description: 'Apply the framework and see measurable improvements.' },
          ],
        },
      },
      {
        sectionType: 'testimonial',
        pageLocation: 'optin',
        sortOrder: 50,
        config: {
          quote: 'I implemented this framework and saw results within the first week.',
          author: 'Satisfied Client',
          role: 'Founder & CEO',
          result: '3x increase in qualified leads',
        },
      },
      // Thank-you page
      {
        sectionType: 'steps',
        pageLocation: 'thankyou',
        sortOrder: 0,
        config: {
          heading: "What's Next",
          steps: [
            { title: 'Open Your Email', description: 'Your guide is waiting in your inbox right now.' },
            { title: 'Dive In', description: 'Read through the key sections and take notes.' },
            { title: 'Implement', description: 'Start applying the strategies today for the fastest results.' },
          ],
        },
      },
      // Content page
      {
        sectionType: 'steps',
        pageLocation: 'content',
        sortOrder: 0,
        config: {
          heading: "What You'll Learn",
          steps: [
            { title: 'The Core Framework', description: 'A proven methodology you can start using immediately.' },
            { title: 'Real-World Examples', description: 'See exactly how others have applied this successfully.' },
            { title: 'Your Action Plan', description: 'Walk away with a clear, actionable next step.' },
          ],
        },
      },
      {
        sectionType: 'testimonial',
        pageLocation: 'content',
        sortOrder: 50,
        config: {
          quote: 'The actionable insights in this guide saved me months of trial and error.',
          author: 'Grateful Reader',
          role: 'VP of Growth',
          result: 'Saved 3 months of testing',
        },
      },
      {
        sectionType: 'section_bridge',
        pageLocation: 'content',
        sortOrder: 51,
        config: {
          text: 'Ready to take the next step?',
          variant: 'accent',
        },
      },
    ],
  },

  // ------------------------------------------
  // 4. Full Suite — everything
  // ------------------------------------------
  {
    id: 'full_suite',
    name: 'Full Suite',
    description: 'Maximum impact — logos, steps, testimonials, benefits, and calls to action on every page',
    sections: [
      // Opt-in page
      {
        sectionType: 'logo_bar',
        pageLocation: 'optin',
        sortOrder: 0,
        config: {
          logos: PLACEHOLDER_LOGOS,
        },
      },
      {
        sectionType: 'steps',
        pageLocation: 'optin',
        sortOrder: 1,
        config: {
          heading: 'How It Works',
          steps: [
            { title: 'Sign Up', description: 'Enter your email below to get instant access.' },
            { title: 'Read the Guide', description: 'Follow the actionable framework inside.' },
            { title: 'See Results', description: 'Apply what you learn and track your progress.' },
          ],
        },
      },
      {
        sectionType: 'testimonial',
        pageLocation: 'optin',
        sortOrder: 50,
        config: {
          quote: 'This was the missing piece in my strategy. The results speak for themselves.',
          author: 'Impressed Client',
          role: 'Head of Marketing',
          result: '2x conversion rate in 30 days',
        },
      },
      // Thank-you page
      {
        sectionType: 'steps',
        pageLocation: 'thankyou',
        sortOrder: 0,
        config: {
          heading: 'What Happens Next',
          steps: [
            { title: 'Check Your Inbox', description: 'We just sent your guide — check your email now.' },
            { title: 'Read & Apply', description: 'Go through the guide and start implementing today.' },
            { title: 'Book a Call', description: 'Want personalized help? Schedule a free strategy session.' },
          ],
        },
      },
      {
        sectionType: 'section_bridge',
        pageLocation: 'thankyou',
        sortOrder: 50,
        config: {
          text: 'Want to accelerate your results? Book a free strategy call.',
          variant: 'gradient',
        },
      },
      // Content page
      {
        sectionType: 'logo_bar',
        pageLocation: 'content',
        sortOrder: 0,
        config: {
          logos: PLACEHOLDER_LOGOS,
        },
      },
      {
        sectionType: 'steps',
        pageLocation: 'content',
        sortOrder: 1,
        config: {
          heading: "What You'll Learn",
          steps: [
            { title: 'The Strategy', description: 'A clear, repeatable framework for success.' },
            { title: 'The Proof', description: 'Real examples and data from people who have done it.' },
            { title: 'Your Next Move', description: 'A concrete action plan you can start today.' },
          ],
        },
      },
      {
        sectionType: 'testimonial',
        pageLocation: 'content',
        sortOrder: 50,
        config: {
          quote: 'I have read dozens of guides. This is the only one that actually changed how I work.',
          author: 'Loyal Reader',
          role: 'Director of Operations',
          result: '40% efficiency improvement',
        },
      },
      {
        sectionType: 'marketing_block',
        pageLocation: 'content',
        sortOrder: 51,
        config: {
          blockType: 'benefit',
          title: 'Why This Guide Works',
          content: 'Built from real-world experience, not theory. Every strategy inside has been tested and refined across dozens of companies.',
        },
      },
      {
        sectionType: 'section_bridge',
        pageLocation: 'content',
        sortOrder: 52,
        config: {
          text: 'Ready to put this into action? Let us help you get there faster.',
          variant: 'gradient',
        },
      },
    ],
  },
];

// ============================================
// DEFAULTS & LOOKUP
// ============================================

export const DEFAULT_TEMPLATE_ID = 'social_proof';

/**
 * Look up a funnel template by ID.
 * Falls back to the default template (social_proof) if not found.
 */
export function getTemplate(id: string): FunnelTemplate {
  const template = FUNNEL_TEMPLATES.find((t) => t.id === id);
  if (template) return template;
  // Fallback to default
  return FUNNEL_TEMPLATES.find((t) => t.id === DEFAULT_TEMPLATE_ID)!;
}
