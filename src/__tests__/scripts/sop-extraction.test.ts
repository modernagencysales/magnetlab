/**
 * @jest-environment node
 */

import { VALID_DELIVERABLE_TYPES, VALID_TOOLS, DIR_TO_MODULE } from '../../../scripts/sop-types';
import { buildExtractionPrompt, buildSystemPrompt } from '../../../scripts/sop-extraction-prompt';
import { generateSQL } from '../../../scripts/seed-sops';
import type { ExtractedSop } from '../../../scripts/sop-types';

// ─── Type & Constant Tests ────────────────────────────────

describe('SOP extraction types', () => {
  it('DIR_TO_MODULE maps all 8 module directories', () => {
    expect(Object.keys(DIR_TO_MODULE)).toHaveLength(8);
    expect(DIR_TO_MODULE['module-0-positioning']).toBe('m0');
    expect(DIR_TO_MODULE['module-7-daily-content']).toBe('m7');
  });

  it('VALID_DELIVERABLE_TYPES contains all 18 types', () => {
    expect(VALID_DELIVERABLE_TYPES).toHaveLength(18);
    expect(VALID_DELIVERABLE_TYPES).toContain('icp_definition');
    expect(VALID_DELIVERABLE_TYPES).toContain('operating_playbook');
  });

  it('VALID_TOOLS contains expected tool names', () => {
    expect(VALID_TOOLS).toContain('magnetlab_ideator');
    expect(VALID_TOOLS).toContain('clay');
    expect(VALID_TOOLS).toContain('heyreach');
    expect(VALID_TOOLS).toContain('plusvibe');
    expect(VALID_TOOLS).toContain('zapmail');
  });
});

// ─── Prompt Tests ─────────────────────────────────────────

describe('buildExtractionPrompt', () => {
  const sampleMarkdown = `---
id: sop-1-1-ideate-lead-magnet
title: "SOP 1.1: Ideate a Lead Magnet"
---
# SOP 1.1: Ideate a Lead Magnet
## Steps
1. Open Magnet Lab Ideator tool.
2. Answer questions about expertise.`;

  it('includes module_id and sop_number in prompt', () => {
    const prompt = buildExtractionPrompt('m1', '1-1', sampleMarkdown);
    expect(prompt).toContain('"m1"');
    expect(prompt).toContain('"1-1"');
  });

  it('includes valid deliverable types in prompt', () => {
    const prompt = buildExtractionPrompt('m1', '1-1', sampleMarkdown);
    expect(prompt).toContain('icp_definition');
    expect(prompt).toContain('operating_playbook');
  });

  it('includes valid tool names in prompt', () => {
    const prompt = buildExtractionPrompt('m1', '1-1', sampleMarkdown);
    expect(prompt).toContain('magnetlab_ideator');
    expect(prompt).toContain('clay');
  });

  it('embeds the raw markdown content', () => {
    const prompt = buildExtractionPrompt('m1', '1-1', sampleMarkdown);
    expect(prompt).toContain('Open Magnet Lab Ideator tool');
  });

  it('system prompt instructs JSON-only output', () => {
    const sys = buildSystemPrompt();
    expect(sys).toContain('JSON');
    expect(sys).toContain('no markdown fences');
  });
});

// ─── SQL Generation Tests ─────────────────────────────────

describe('generateSQL', () => {
  const baseSop: ExtractedSop = {
    module_id: 'm1',
    sop_number: '1-1',
    title: 'Ideate a Lead Magnet',
    content: '## Steps\n1. Open Magnet Lab Ideator tool.',
    quality_bars: [{ check: 'Addresses ICP #1 problem', severity: 'critical' }],
    deliverables: [{ type: 'lead_magnet', description: 'Lead magnet concept' }],
    tools_used: ['magnetlab_ideator'],
    dependencies: ['0-1'],
  };

  it('generates valid SQL with INSERT ON CONFLICT', () => {
    const sql = generateSQL([baseSop]);
    expect(sql).toContain('INSERT INTO program_sops');
    expect(sql).toContain('ON CONFLICT (module_id, sop_number) DO UPDATE');
    expect(sql).toContain("'m1'");
    expect(sql).toContain("'1-1'");
  });

  it('handles content with single quotes via dollar-quoting', () => {
    const sopWithQuotes: ExtractedSop = {
      ...baseSop,
      content: "Don't skip this step. It's critical for your ICP's success.",
    };
    const sql = generateSQL([sopWithQuotes]);
    // Dollar-quoting should handle quotes without escaping
    expect(sql).toContain("Don't skip this step");
    expect(sql).toContain('$body$');
  });

  it('handles empty tools_used and dependencies arrays', () => {
    const sopEmpty: ExtractedSop = {
      ...baseSop,
      tools_used: [],
      dependencies: [],
    };
    const sql = generateSQL([sopEmpty]);
    expect(sql).toContain('ARRAY[]::text[]');
  });

  it('escapes single quotes in title', () => {
    const sopQuotedTitle: ExtractedSop = {
      ...baseSop,
      title: "Define Your Client's ICP",
    };
    const sql = generateSQL([sopQuotedTitle]);
    expect(sql).toContain("Define Your Client''s ICP");
  });

  it('serializes quality_bars as JSONB', () => {
    const sql = generateSQL([baseSop]);
    expect(sql).toContain('::jsonb');
    expect(sql).toContain('Addresses ICP #1 problem');
  });

  it('cleans old dot-format data', () => {
    const sql = generateSQL([baseSop]);
    expect(sql).toContain("DELETE FROM program_sops WHERE sop_number LIKE '%.%'");
  });

  it('generates SQL for multiple SOPs', () => {
    const sop2: ExtractedSop = {
      ...baseSop,
      module_id: 'm2',
      sop_number: '2-1',
      title: 'Export Connections',
    };
    const sql = generateSQL([baseSop, sop2]);
    expect(sql).toContain("'m1'");
    expect(sql).toContain("'m2'");
    expect((sql.match(/INSERT INTO program_sops/g) || []).length).toBe(2);
  });
});
