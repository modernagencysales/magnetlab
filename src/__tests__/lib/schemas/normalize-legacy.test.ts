/**
 * @jest-environment node
 *
 * Tests for normalizeLegacyContent — transforms legacy polished_content / extracted_content
 * into the new unified content shape.
 */

import { normalizeLegacyContent } from '@/lib/schemas/archetypes/normalize-legacy';
import type { PolishedContent, ExtractedContent } from '@/lib/types/lead-magnet';

// ─── Fixtures ────────────────────────────────────────────────────

const polishedContentFixture: PolishedContent = {
  version: 1,
  polishedAt: '2025-01-15T10:00:00Z',
  title: 'The 5-Step LinkedIn Lead Gen System',
  heroSummary: 'Most agencies have no repeatable system for generating consistent LinkedIn leads.',
  sections: [
    {
      id: 'section-1',
      sectionName: 'Step 1: Audit Your Pipeline',
      introduction: 'Start by auditing your current pipeline to identify where leads drop off.',
      blocks: [
        { type: 'paragraph', content: 'Look at each stage of your funnel.' },
        { type: 'callout', content: 'Most pipelines leak at stage 2.', style: 'info' },
      ],
      keyTakeaway: 'You cannot improve what you do not measure.',
    },
    {
      id: 'section-2',
      sectionName: 'Step 2: Build Your Content Engine',
      introduction: 'A content engine runs on autopilot once set up correctly.',
      blocks: [{ type: 'paragraph', content: 'Three posts per week beats ten random ones.' }],
      keyTakeaway: 'Consistency beats volume every time.',
    },
  ],
  metadata: {
    readingTimeMinutes: 8,
    wordCount: 1200,
  },
};

const extractedContentFixture: ExtractedContent = {
  title: 'Agency Lead Generation Playbook',
  format: 'Guide',
  structure: [
    {
      sectionName: 'Defining Your ICP',
      contents: ['Narrow your target market.', 'Use firmographic filters.'],
    },
    {
      sectionName: 'Content Strategy',
      contents: ['Post three times a week.', 'Focus on pain-driven hooks.'],
    },
  ],
  nonObviousInsight: 'Most agencies target too broadly — niching down triples conversion rates.',
  personalExperience: 'We tried broad targeting for two years before discovering this.',
  proof: '12 agencies doubled pipeline in 90 days using this approach.',
  commonMistakes: ['Targeting everyone', 'Skipping ICP definition'],
  differentiation: 'This playbook is built on real agency data, not theory.',
};

// ─── Test Suite ──────────────────────────────────────────────────

describe('normalizeLegacyContent', () => {
  // Case 1: polished_content → content
  describe('polished_content → content mapping', () => {
    it('maps title to headline', () => {
      const result = normalizeLegacyContent({
        content: null,
        polished_content: polishedContentFixture,
        extracted_content: null,
      });
      expect(result).not.toBeNull();
      expect(result!.headline).toBe('The 5-Step LinkedIn Lead Gen System');
    });

    it('falls back to first section name when title is missing', () => {
      const withoutTitle: PolishedContent = {
        ...polishedContentFixture,
        title: undefined,
      };
      const result = normalizeLegacyContent({
        content: null,
        polished_content: withoutTitle,
        extracted_content: null,
      });
      expect(result!.headline).toBe('Step 1: Audit Your Pipeline');
    });

    it('maps heroSummary to problem_statement', () => {
      const result = normalizeLegacyContent({
        content: null,
        polished_content: polishedContentFixture,
        extracted_content: null,
      });
      expect(result!.problem_statement).toBe(
        'Most agencies have no repeatable system for generating consistent LinkedIn leads.'
      );
    });

    it('maps last section keyTakeaway to call_to_action', () => {
      const result = normalizeLegacyContent({
        content: null,
        polished_content: polishedContentFixture,
        extracted_content: null,
      });
      expect(result!.call_to_action).toBe('Consistency beats volume every time.');
    });

    it('falls back to "Learn more" when no keyTakeaway exists on last section', () => {
      const withoutTakeaway: PolishedContent = {
        ...polishedContentFixture,
        sections: [
          { ...polishedContentFixture.sections[0], keyTakeaway: '' },
          { ...polishedContentFixture.sections[1], keyTakeaway: '' },
        ],
      };
      const result = normalizeLegacyContent({
        content: null,
        polished_content: withoutTakeaway,
        extracted_content: null,
      });
      expect(result!.call_to_action).toBe('Learn more');
    });

    it('maps sections with title, body (intro + blocks text), and key_insight', () => {
      const result = normalizeLegacyContent({
        content: null,
        polished_content: polishedContentFixture,
        extracted_content: null,
      });
      const sections = result!.sections as Array<{
        title: string;
        body: string;
        key_insight?: string;
      }>;
      expect(sections).toHaveLength(2);
      expect(sections[0].title).toBe('Step 1: Audit Your Pipeline');
      expect(sections[0].body).toContain(
        'Start by auditing your current pipeline to identify where leads drop off.'
      );
      expect(sections[0].body).toContain('Look at each stage of your funnel.');
      expect(sections[0].key_insight).toBe('You cannot improve what you do not measure.');
      expect(sections[1].title).toBe('Step 2: Build Your Content Engine');
      expect(sections[1].key_insight).toBe('Consistency beats volume every time.');
    });

    it('handles empty sections array gracefully', () => {
      const withEmptySections: PolishedContent = {
        ...polishedContentFixture,
        sections: [],
      };
      const result = normalizeLegacyContent({
        content: null,
        polished_content: withEmptySections,
        extracted_content: null,
      });
      expect(result).not.toBeNull();
      expect(result!.sections).toEqual([]);
      expect(result!.headline).toBe('The 5-Step LinkedIn Lead Gen System');
      expect(result!.call_to_action).toBe('Learn more');
    });
  });

  // Case 2: extracted_content → content
  describe('extracted_content → content mapping', () => {
    it('maps title to headline', () => {
      const result = normalizeLegacyContent({
        content: null,
        polished_content: null,
        extracted_content: extractedContentFixture,
      });
      expect(result!.headline).toBe('Agency Lead Generation Playbook');
    });

    it('maps differentiation to problem_statement', () => {
      const result = normalizeLegacyContent({
        content: null,
        polished_content: null,
        extracted_content: extractedContentFixture,
      });
      expect(result!.problem_statement).toBe(
        'This playbook is built on real agency data, not theory.'
      );
    });

    it('falls back to "See the full breakdown" when differentiation is empty', () => {
      const withoutDiff: ExtractedContent = {
        ...extractedContentFixture,
        differentiation: '',
      };
      const result = normalizeLegacyContent({
        content: null,
        polished_content: null,
        extracted_content: withoutDiff,
      });
      expect(result!.problem_statement).toBe('See the full breakdown');
    });

    it('sets call_to_action to "Get the full guide"', () => {
      const result = normalizeLegacyContent({
        content: null,
        polished_content: null,
        extracted_content: extractedContentFixture,
      });
      expect(result!.call_to_action).toBe('Get the full guide');
    });

    it('maps structure to sections with title and body', () => {
      const result = normalizeLegacyContent({
        content: null,
        polished_content: null,
        extracted_content: extractedContentFixture,
      });
      const sections = result!.sections as Array<{
        title: string;
        body: string;
        key_insight?: string;
      }>;
      expect(sections).toHaveLength(2);
      expect(sections[0].title).toBe('Defining Your ICP');
      expect(sections[0].body).toContain('Narrow your target market.');
      expect(sections[0].body).toContain('Use firmographic filters.');
    });

    it('adds nonObviousInsight as key_insight on the first section only', () => {
      const result = normalizeLegacyContent({
        content: null,
        polished_content: null,
        extracted_content: extractedContentFixture,
      });
      const sections = result!.sections as Array<{
        title: string;
        body: string;
        key_insight?: string;
      }>;
      expect(sections[0].key_insight).toBe(
        'Most agencies target too broadly — niching down triples conversion rates.'
      );
      expect(sections[1].key_insight).toBeUndefined();
    });

    it('handles empty structure array gracefully', () => {
      const withEmptyStructure: ExtractedContent = {
        ...extractedContentFixture,
        structure: [],
      };
      const result = normalizeLegacyContent({
        content: null,
        polished_content: null,
        extracted_content: withEmptyStructure,
      });
      expect(result).not.toBeNull();
      expect(result!.sections).toEqual([]);
    });
  });

  // Case 3: both null → null
  describe('both null → null', () => {
    it('returns null when both polished_content and extracted_content are null', () => {
      const result = normalizeLegacyContent({
        content: null,
        polished_content: null,
        extracted_content: null,
      });
      expect(result).toBeNull();
    });
  });

  // Case 4: content already set → passthrough
  describe('content already set → passthrough', () => {
    it('returns existing content unchanged when content field is already set', () => {
      const existingContent = {
        headline: 'Already normalized',
        problem_statement: 'Content was already set.',
        call_to_action: 'Do something',
        sections: [{ title: 'Existing', body: 'Already here.' }],
      };
      const result = normalizeLegacyContent({
        content: existingContent,
        polished_content: polishedContentFixture,
        extracted_content: extractedContentFixture,
      });
      expect(result).toEqual(existingContent);
    });

    it('passes through non-standard content shapes unchanged', () => {
      const customContent = { custom_field: 'value', another: 42 };
      const result = normalizeLegacyContent({
        content: customContent,
        polished_content: polishedContentFixture,
        extracted_content: null,
      });
      expect(result).toEqual(customContent);
    });
  });

  // Case 5: polished_content takes priority over extracted_content
  describe('priority: polished_content > extracted_content', () => {
    it('uses polished_content when both are present', () => {
      const result = normalizeLegacyContent({
        content: null,
        polished_content: polishedContentFixture,
        extracted_content: extractedContentFixture,
      });
      // polished_content headline
      expect(result!.headline).toBe('The 5-Step LinkedIn Lead Gen System');
      // NOT the extracted headline
      expect(result!.headline).not.toBe('Agency Lead Generation Playbook');
    });

    it('falls through to extracted_content when polished_content is null', () => {
      const result = normalizeLegacyContent({
        content: null,
        polished_content: null,
        extracted_content: extractedContentFixture,
      });
      expect(result!.headline).toBe('Agency Lead Generation Playbook');
    });
  });

  // Case 6: edge cases
  describe('edge cases', () => {
    it('handles polished_content as raw object (unknown type) by casting safely', () => {
      const rawPolished = {
        version: 1,
        polishedAt: '2025-01-01',
        title: 'Raw Title',
        heroSummary: 'Raw hero summary text for the lead magnet.',
        sections: [],
        metadata: { readingTimeMinutes: 5, wordCount: 600 },
      };
      const result = normalizeLegacyContent({
        content: null,
        polished_content: rawPolished,
        extracted_content: null,
      });
      expect(result!.headline).toBe('Raw Title');
    });

    it('handles extracted_content as raw object by casting safely', () => {
      const rawExtracted = {
        title: 'Raw Extracted Title',
        format: 'Guide',
        structure: [{ sectionName: 'Intro', contents: ['Content here.'] }],
        nonObviousInsight: 'Insight here',
        personalExperience: 'Experience here',
        proof: 'Proof here',
        commonMistakes: [],
        differentiation: 'Raw differentiation text.',
      };
      const result = normalizeLegacyContent({
        content: null,
        polished_content: null,
        extracted_content: rawExtracted,
      });
      expect(result!.headline).toBe('Raw Extracted Title');
    });

    it('handles section blocks concatenation — body includes intro and all block content', () => {
      const singleSection: PolishedContent = {
        ...polishedContentFixture,
        sections: [
          {
            id: 'sec-1',
            sectionName: 'Overview',
            introduction: 'Introduction text.',
            blocks: [
              { type: 'paragraph', content: 'Block one content.' },
              { type: 'callout', content: 'Block two content.', style: 'info' },
            ],
            keyTakeaway: 'Key takeaway here.',
          },
        ],
      };
      const result = normalizeLegacyContent({
        content: null,
        polished_content: singleSection,
        extracted_content: null,
      });
      const sections = result!.sections as Array<{ body: string }>;
      expect(sections[0].body).toContain('Introduction text.');
      expect(sections[0].body).toContain('Block one content.');
      expect(sections[0].body).toContain('Block two content.');
    });
  });
});
