/** Handler routing tests for MCP v2. Verifies all 51 tools route correctly through handleToolCall. */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MagnetLabClient } from '../client.js';
import { handleToolCall } from '../handlers/index.js';

// ─── Mock Client ──────────────────────────────────────────────────────────────

function createMockClient(): MagnetLabClient {
  const client = new MagnetLabClient('test-key');

  // Stub every public method to return a mock response
  const methodNames = Object.getOwnPropertyNames(MagnetLabClient.prototype).filter(
    (n) => n !== 'constructor' && n !== 'request' && n !== 'aiRequest'
  );
  for (const method of methodNames) {
    (client as unknown as Record<string, unknown>)[method] = vi.fn().mockResolvedValue({
      mocked: true,
      method,
    });
  }

  return client;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function callTool(client: MagnetLabClient, name: string, args: Record<string, unknown>) {
  const result = await handleToolCall(name, args, client);
  expect(result.content).toHaveLength(1);
  expect(result.content[0].type).toBe('text');
  return JSON.parse(result.content[0].text);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Handler Routing — All 51 Tools', () => {
  let client: MagnetLabClient;

  beforeEach(() => {
    client = createMockClient();
  });

  // ── Lead Magnets (5) ──────────────────────────────────────────────────────

  describe('Lead Magnets', () => {
    it('magnetlab_list_lead_magnets passes filter params', async () => {
      await callTool(client, 'magnetlab_list_lead_magnets', {
        status: 'published',
        limit: 10,
        offset: 5,
      });
      expect(client.listLeadMagnets).toHaveBeenCalledWith({
        status: 'published',
        limit: 10,
        offset: 5,
        teamId: undefined,
      });
    });

    it('magnetlab_get_lead_magnet passes id', async () => {
      await callTool(client, 'magnetlab_get_lead_magnet', { id: 'lm-1' });
      expect(client.getLeadMagnet).toHaveBeenCalledWith('lm-1', undefined);
    });

    it('magnetlab_create_lead_magnet passes params', async () => {
      await callTool(client, 'magnetlab_create_lead_magnet', {
        title: 'My Guide',
        archetype: 'single-breakdown',
      });
      expect(client.createLeadMagnet).toHaveBeenCalledWith({
        title: 'My Guide',
        archetype: 'single-breakdown',
        concept: undefined,
        teamId: undefined,
      });
    });

    it('magnetlab_update_lead_magnet calls updateLeadMagnetContent with content and version', async () => {
      await callTool(client, 'magnetlab_update_lead_magnet', {
        id: 'lm-1',
        content: { headline: 'New Headline' },
        expected_version: 2,
      });
      expect(client.updateLeadMagnetContent).toHaveBeenCalledWith(
        'lm-1',
        { headline: 'New Headline' },
        2,
        undefined
      );
    });

    it('magnetlab_update_lead_magnet works without expected_version', async () => {
      await callTool(client, 'magnetlab_update_lead_magnet', {
        id: 'lm-1',
        content: { headline: 'New' },
      });
      expect(client.updateLeadMagnetContent).toHaveBeenCalledWith(
        'lm-1',
        { headline: 'New' },
        undefined,
        undefined
      );
    });

    it('magnetlab_delete_lead_magnet passes id', async () => {
      await callTool(client, 'magnetlab_delete_lead_magnet', { id: 'lm-1' });
      expect(client.deleteLeadMagnet).toHaveBeenCalledWith('lm-1', undefined);
    });
  });

  // ── Funnels (7) ───────────────────────────────────────────────────────────

  describe('Funnels', () => {
    it('magnetlab_list_funnels calls client', async () => {
      await callTool(client, 'magnetlab_list_funnels', {});
      expect(client.listFunnels).toHaveBeenCalledWith(undefined);
    });

    it('magnetlab_get_funnel passes id', async () => {
      await callTool(client, 'magnetlab_get_funnel', { id: 'f-1' });
      expect(client.getFunnel).toHaveBeenCalledWith('f-1', undefined);
    });

    it('magnetlab_create_funnel transforms snake_case to camelCase', async () => {
      await callTool(client, 'magnetlab_create_funnel', {
        slug: 'my-funnel',
        lead_magnet_id: 'lm-1',
        optin_headline: 'Get it now',
        primary_color: '#8b5cf6',
        background_style: 'gradient',
      });
      expect(client.createFunnel).toHaveBeenCalledWith(
        expect.objectContaining({
          slug: 'my-funnel',
          leadMagnetId: 'lm-1',
          optinHeadline: 'Get it now',
          primaryColor: '#8b5cf6',
          backgroundStyle: 'gradient',
        })
      );
    });

    it('magnetlab_update_funnel transforms snake_case to camelCase', async () => {
      await callTool(client, 'magnetlab_update_funnel', {
        id: 'funnel-1',
        optin_headline: 'Updated headline',
        redirect_trigger: 'immediate',
        send_resource_email: true,
      });
      expect(client.updateFunnel).toHaveBeenCalledWith(
        'funnel-1',
        expect.objectContaining({
          optinHeadline: 'Updated headline',
          redirectTrigger: 'immediate',
          sendResourceEmail: true,
        })
      );
    });

    it('magnetlab_delete_funnel passes id', async () => {
      await callTool(client, 'magnetlab_delete_funnel', { id: 'f-1' });
      expect(client.deleteFunnel).toHaveBeenCalledWith('f-1', undefined);
    });

    it('magnetlab_publish_funnel passes id', async () => {
      await callTool(client, 'magnetlab_publish_funnel', { id: 'f-1' });
      expect(client.publishFunnel).toHaveBeenCalledWith('f-1', undefined);
    });

    it('magnetlab_unpublish_funnel passes id', async () => {
      await callTool(client, 'magnetlab_unpublish_funnel', { id: 'f-1' });
      expect(client.unpublishFunnel).toHaveBeenCalledWith('f-1', undefined);
    });
  });

  // ── Knowledge (5) ─────────────────────────────────────────────────────────

  describe('Knowledge', () => {
    it('magnetlab_search_knowledge passes all filter params', async () => {
      await callTool(client, 'magnetlab_search_knowledge', {
        query: 'pricing',
        category: 'insight',
        type: 'how_to',
        topic: 'sales',
        min_quality: 3,
        since: '2026-01-01',
      });
      expect(client.searchKnowledge).toHaveBeenCalledWith({
        query: 'pricing',
        category: 'insight',
        type: 'how_to',
        topic: 'sales',
        min_quality: 3,
        since: '2026-01-01',
        teamId: undefined,
      });
    });

    it('magnetlab_browse_knowledge passes filter params', async () => {
      await callTool(client, 'magnetlab_browse_knowledge', {
        category: 'question',
        tag: 'sales',
        limit: 10,
      });
      expect(client.browseKnowledge).toHaveBeenCalledWith({
        category: 'question',
        tag: 'sales',
        limit: 10,
        teamId: undefined,
      });
    });

    it('magnetlab_get_knowledge_clusters calls client', async () => {
      await callTool(client, 'magnetlab_get_knowledge_clusters', {});
      expect(client.getKnowledgeClusters).toHaveBeenCalledWith(undefined);
    });

    it('magnetlab_ask_knowledge passes question', async () => {
      await callTool(client, 'magnetlab_ask_knowledge', {
        question: 'What is our pricing strategy?',
      });
      expect(client.askKnowledge).toHaveBeenCalledWith({
        question: 'What is our pricing strategy?',
        teamId: undefined,
      });
    });

    it('magnetlab_submit_transcript passes transcript and title', async () => {
      await callTool(client, 'magnetlab_submit_transcript', {
        transcript: 'A'.repeat(100),
        title: 'Call Recording',
      });
      expect(client.submitTranscript).toHaveBeenCalledWith({
        transcript: 'A'.repeat(100),
        title: 'Call Recording',
        teamId: undefined,
      });
    });
  });

  // ── Posts (6) ──────────────────────────────────────────────────────────────

  describe('Posts', () => {
    it('magnetlab_list_posts passes filter params', async () => {
      await callTool(client, 'magnetlab_list_posts', {
        status: 'draft',
        is_buffer: true,
        limit: 25,
      });
      expect(client.listPosts).toHaveBeenCalledWith({
        status: 'draft',
        isBuffer: true,
        limit: 25,
        teamId: undefined,
      });
    });

    it('magnetlab_get_post passes id', async () => {
      await callTool(client, 'magnetlab_get_post', { id: 'post-1' });
      expect(client.getPost).toHaveBeenCalledWith('post-1', undefined);
    });

    it('magnetlab_create_post passes body and optional fields', async () => {
      await callTool(client, 'magnetlab_create_post', {
        body: 'My LinkedIn post content',
        title: 'Day 1',
        pillar: 'teaching_promotion',
        content_type: 'insight',
      });
      expect(client.createPost).toHaveBeenCalledWith({
        body: 'My LinkedIn post content',
        title: 'Day 1',
        pillar: 'teaching_promotion',
        content_type: 'insight',
        teamId: undefined,
      });
    });

    it('magnetlab_update_post passes id and update fields', async () => {
      await callTool(client, 'magnetlab_update_post', {
        id: 'post-1',
        draft_content: 'Updated draft',
        status: 'review',
      });
      expect(client.updatePost).toHaveBeenCalledWith(
        'post-1',
        {
          draft_content: 'Updated draft',
          final_content: undefined,
          status: 'review',
        },
        undefined
      );
    });

    it('magnetlab_delete_post passes id', async () => {
      await callTool(client, 'magnetlab_delete_post', { id: 'post-1' });
      expect(client.deletePost).toHaveBeenCalledWith('post-1', undefined);
    });

    it('magnetlab_publish_post passes id', async () => {
      await callTool(client, 'magnetlab_publish_post', { id: 'post-1' });
      expect(client.publishPost).toHaveBeenCalledWith('post-1', undefined, undefined);
    });
  });

  // ── Email Sequences (3) ───────────────────────────────────────────────────

  describe('Email Sequences', () => {
    it('magnetlab_get_email_sequence passes lead_magnet_id', async () => {
      await callTool(client, 'magnetlab_get_email_sequence', { lead_magnet_id: 'lm-1' });
      expect(client.getEmailSequence).toHaveBeenCalledWith('lm-1', undefined);
    });

    it('magnetlab_save_email_sequence passes lead_magnet_id and data', async () => {
      await callTool(client, 'magnetlab_save_email_sequence', {
        lead_magnet_id: 'lm-1',
        emails: [{ day: 0, subject: 'Welcome', body: '<p>Hi</p>', replyTrigger: 'welcome' }],
        status: 'draft',
      });
      expect(client.saveEmailSequence).toHaveBeenCalledWith(
        'lm-1',
        {
          emails: [{ day: 0, subject: 'Welcome', body: '<p>Hi</p>', replyTrigger: 'welcome' }],
          status: 'draft',
        },
        undefined
      );
    });

    it('magnetlab_activate_email_sequence passes lead_magnet_id', async () => {
      await callTool(client, 'magnetlab_activate_email_sequence', { lead_magnet_id: 'lm-1' });
      expect(client.activateEmailSequence).toHaveBeenCalledWith('lm-1', undefined);
    });
  });

  // ── Leads (3) ──────────────────────────────────────────────────────────────

  describe('Leads', () => {
    it('magnetlab_list_leads passes all filter params (snake_case to camelCase)', async () => {
      await callTool(client, 'magnetlab_list_leads', {
        funnel_id: 'f-1',
        lead_magnet_id: 'lm-1',
        qualified: true,
        search: 'john',
        limit: 20,
        offset: 5,
      });
      expect(client.listLeads).toHaveBeenCalledWith({
        funnelId: 'f-1',
        leadMagnetId: 'lm-1',
        qualified: true,
        search: 'john',
        limit: 20,
        offset: 5,
        teamId: undefined,
      });
    });

    it('magnetlab_get_lead passes id', async () => {
      await callTool(client, 'magnetlab_get_lead', { id: 'lead-1' });
      expect(client.getLead).toHaveBeenCalledWith('lead-1', undefined);
    });

    it('magnetlab_export_leads passes filter params (snake_case to camelCase)', async () => {
      await callTool(client, 'magnetlab_export_leads', {
        funnel_id: 'f-1',
        qualified: false,
      });
      expect(client.exportLeads).toHaveBeenCalledWith({
        funnelId: 'f-1',
        leadMagnetId: undefined,
        qualified: false,
        teamId: undefined,
      });
    });
  });

  // ── Schema / Introspection (3) ────────────────────────────────────────────

  describe('Schema / Introspection', () => {
    it('magnetlab_list_archetypes returns archetype list (no client call)', async () => {
      const result = await callTool(client, 'magnetlab_list_archetypes', {});
      // list_archetypes is handled server-side from the embedded registry, not via client
      expect(result.archetypes).toBeDefined();
      expect(result.archetypes.length).toBe(10);
    });

    it('magnetlab_get_archetype_schema returns schema for valid archetype', async () => {
      const result = await callTool(client, 'magnetlab_get_archetype_schema', {
        archetype: 'single-breakdown',
      });
      expect(result.archetype).toBe('single-breakdown');
      expect(result.content_fields).toBeDefined();
      expect(result.guidelines).toBeDefined();
    });

    it('magnetlab_get_archetype_schema includes base fields', async () => {
      const result = await callTool(client, 'magnetlab_get_archetype_schema', {
        archetype: 'prompt',
      });
      // All archetypes have base fields
      expect(result.content_fields).toHaveProperty('headline');
      expect(result.content_fields).toHaveProperty('problem_statement');
      expect(result.content_fields).toHaveProperty('call_to_action');
      // Prompt has its own field
      expect(result.content_fields).toHaveProperty('prompts');
    });

    it('magnetlab_get_business_context calls client', async () => {
      await callTool(client, 'magnetlab_get_business_context', {});
      expect(client.getBusinessContext).toHaveBeenCalledWith(undefined);
    });
  });

  // ── Compound Actions (2) ──────────────────────────────────────────────────

  describe('Compound Actions', () => {
    it('magnetlab_launch_lead_magnet passes all params', async () => {
      await callTool(client, 'magnetlab_launch_lead_magnet', {
        title: 'My Guide',
        archetype: 'single-breakdown',
        content: { headline: 'Test' },
        slug: 'my-guide',
        funnel_theme: 'dark',
        email_sequence: {
          emails: [{ subject: 'Welcome', body: 'Hi', delay_days: 0 }],
        },
      });
      expect(client.launchLeadMagnet).toHaveBeenCalledWith({
        title: 'My Guide',
        archetype: 'single-breakdown',
        content: { headline: 'Test' },
        slug: 'my-guide',
        funnel_theme: 'dark',
        email_sequence: {
          emails: [{ subject: 'Welcome', body: 'Hi', delay_days: 0 }],
        },
        teamId: undefined,
      });
    });

    it('magnetlab_schedule_content_week passes all params', async () => {
      await callTool(client, 'magnetlab_schedule_content_week', {
        posts: [
          { body: 'Post 1', pillar: 'teaching_promotion' },
          { body: 'Post 2', pillar: 'human_personal' },
        ],
        week_start: '2026-03-16',
      });
      expect(client.scheduleContentWeek).toHaveBeenCalledWith(
        {
          posts: [
            { body: 'Post 1', pillar: 'teaching_promotion' },
            { body: 'Post 2', pillar: 'human_personal' },
          ],
          week_start: '2026-03-16',
        },
        undefined
      );
    });
  });

  // ── Feedback / Analytics (2) ──────────────────────────────────────────────

  describe('Feedback / Analytics', () => {
    it('magnetlab_get_performance_insights passes period', async () => {
      await callTool(client, 'magnetlab_get_performance_insights', { period: '7d' });
      expect(client.getPerformanceInsights).toHaveBeenCalledWith('7d', undefined);
    });

    it('magnetlab_get_performance_insights works without period', async () => {
      await callTool(client, 'magnetlab_get_performance_insights', {});
      expect(client.getPerformanceInsights).toHaveBeenCalledWith(undefined, undefined);
    });

    it('magnetlab_get_recommendations calls client', async () => {
      await callTool(client, 'magnetlab_get_recommendations', {});
      expect(client.getRecommendations).toHaveBeenCalledWith(undefined);
    });
  });

  // ── Account (1) ───────────────────────────────────────────────────────────

  describe('Account', () => {
    it('magnetlab_list_teams calls client', async () => {
      await callTool(client, 'magnetlab_list_teams', {});
      expect(client.listTeams).toHaveBeenCalled();
    });
  });

  // ── Per-Archetype Schema Tests ────────────────────────────────────────────

  describe('Per-Archetype Schema Responses', () => {
    const archetypes = [
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
    ];

    for (const archetype of archetypes) {
      it(`${archetype} returns content_fields and guidelines`, async () => {
        const result = await callTool(client, 'magnetlab_get_archetype_schema', { archetype });
        expect(result.archetype).toBe(archetype);
        expect(result.content_fields).toBeDefined();
        expect(typeof result.guidelines).toBe('string');
        expect(result.guidelines.length).toBeGreaterThan(20);
      });

      it(`${archetype} includes shared base fields`, async () => {
        const result = await callTool(client, 'magnetlab_get_archetype_schema', { archetype });
        const fields = result.content_fields;
        expect(fields).toHaveProperty('headline');
        expect(fields).toHaveProperty('problem_statement');
        expect(fields).toHaveProperty('call_to_action');
        expect(fields.headline.required).toBe(true);
        expect(fields.problem_statement.required).toBe(true);
        expect(fields.call_to_action.required).toBe(true);
      });
    }

    it('single-breakdown has sections with title/body/key_insight', async () => {
      const result = await callTool(client, 'magnetlab_get_archetype_schema', {
        archetype: 'single-breakdown',
      });
      expect(result.content_fields.sections).toBeDefined();
      expect(result.content_fields.sections.type).toBe('object[]');
      expect(result.content_fields.sections.min_items).toBe(3);
      expect(result.content_fields.sections.nested_fields).toHaveProperty('title');
      expect(result.content_fields.sections.nested_fields).toHaveProperty('body');
    });

    it('single-system has sections with component_name and how_it_connects', async () => {
      const result = await callTool(client, 'magnetlab_get_archetype_schema', {
        archetype: 'single-system',
      });
      const nested = result.content_fields.sections.nested_fields;
      expect(nested).toHaveProperty('component_name');
      expect(nested).toHaveProperty('how_it_connects');
    });

    it('focused-toolkit has tools with name/description/use_case', async () => {
      const result = await callTool(client, 'magnetlab_get_archetype_schema', {
        archetype: 'focused-toolkit',
      });
      expect(result.content_fields.tools).toBeDefined();
      expect(result.content_fields.tools.nested_fields).toHaveProperty('name');
      expect(result.content_fields.tools.nested_fields).toHaveProperty('use_case');
    });

    it('single-calculator has inputs, formula_description, output_format', async () => {
      const result = await callTool(client, 'magnetlab_get_archetype_schema', {
        archetype: 'single-calculator',
      });
      expect(result.content_fields).toHaveProperty('inputs');
      expect(result.content_fields).toHaveProperty('formula_description');
      expect(result.content_fields).toHaveProperty('output_format');
    });

    it('focused-directory has resources with name/url/description/category', async () => {
      const result = await callTool(client, 'magnetlab_get_archetype_schema', {
        archetype: 'focused-directory',
      });
      expect(result.content_fields.resources).toBeDefined();
      expect(result.content_fields.resources.min_items).toBe(5);
      expect(result.content_fields.resources.nested_fields).toHaveProperty('url');
    });

    it('mini-training has lessons with objective/content/exercise', async () => {
      const result = await callTool(client, 'magnetlab_get_archetype_schema', {
        archetype: 'mini-training',
      });
      expect(result.content_fields.lessons).toBeDefined();
      expect(result.content_fields.lessons.nested_fields).toHaveProperty('objective');
      expect(result.content_fields.lessons.nested_fields).toHaveProperty('exercise');
    });

    it('one-story has story_hook/narrative/lesson/takeaway', async () => {
      const result = await callTool(client, 'magnetlab_get_archetype_schema', {
        archetype: 'one-story',
      });
      expect(result.content_fields).toHaveProperty('story_hook');
      expect(result.content_fields).toHaveProperty('narrative');
      expect(result.content_fields).toHaveProperty('lesson');
      expect(result.content_fields).toHaveProperty('takeaway');
    });

    it('prompt has prompts with title/prompt_text/example_output/when_to_use', async () => {
      const result = await callTool(client, 'magnetlab_get_archetype_schema', {
        archetype: 'prompt',
      });
      expect(result.content_fields.prompts).toBeDefined();
      expect(result.content_fields.prompts.nested_fields).toHaveProperty('prompt_text');
      expect(result.content_fields.prompts.nested_fields).toHaveProperty('example_output');
    });

    it('assessment has questions/scoring_rubric/result_ranges', async () => {
      const result = await callTool(client, 'magnetlab_get_archetype_schema', {
        archetype: 'assessment',
      });
      expect(result.content_fields).toHaveProperty('questions');
      expect(result.content_fields).toHaveProperty('scoring_rubric');
      expect(result.content_fields).toHaveProperty('result_ranges');
      expect(result.content_fields.questions.min_items).toBe(5);
    });

    it('workflow has steps with trigger/action/tool/output', async () => {
      const result = await callTool(client, 'magnetlab_get_archetype_schema', {
        archetype: 'workflow',
      });
      expect(result.content_fields.steps).toBeDefined();
      expect(result.content_fields.steps.nested_fields).toHaveProperty('trigger');
      expect(result.content_fields.steps.nested_fields).toHaveProperty('action');
      expect(result.content_fields.steps.nested_fields).toHaveProperty('tool');
      expect(result.content_fields.steps.nested_fields).toHaveProperty('output');
    });
  });

  // ── Team ID Propagation Through Handlers ──────────────────────────────────

  describe('Team ID propagation', () => {
    it('magnetlab_list_lead_magnets passes team_id to client', async () => {
      await callTool(client, 'magnetlab_list_lead_magnets', { team_id: 'team-abc' });
      expect(client.listLeadMagnets).toHaveBeenCalledWith(
        expect.objectContaining({ teamId: 'team-abc' })
      );
    });

    it('magnetlab_get_lead_magnet passes team_id to client', async () => {
      await callTool(client, 'magnetlab_get_lead_magnet', { id: 'lm-1', team_id: 'team-abc' });
      expect(client.getLeadMagnet).toHaveBeenCalledWith('lm-1', 'team-abc');
    });

    it('magnetlab_create_lead_magnet passes team_id to client', async () => {
      await callTool(client, 'magnetlab_create_lead_magnet', {
        title: 'My Guide',
        archetype: 'prompt',
        team_id: 'team-abc',
      });
      expect(client.createLeadMagnet).toHaveBeenCalledWith(
        expect.objectContaining({ teamId: 'team-abc' })
      );
    });

    it('magnetlab_update_lead_magnet passes team_id to client', async () => {
      await callTool(client, 'magnetlab_update_lead_magnet', {
        id: 'lm-1',
        content: { headline: 'New' },
        team_id: 'team-abc',
      });
      expect(client.updateLeadMagnetContent).toHaveBeenCalledWith(
        'lm-1',
        { headline: 'New' },
        undefined,
        'team-abc'
      );
    });

    it('magnetlab_delete_lead_magnet passes team_id to client', async () => {
      await callTool(client, 'magnetlab_delete_lead_magnet', { id: 'lm-1', team_id: 'team-abc' });
      expect(client.deleteLeadMagnet).toHaveBeenCalledWith('lm-1', 'team-abc');
    });

    it('magnetlab_list_funnels passes team_id to client', async () => {
      await callTool(client, 'magnetlab_list_funnels', { team_id: 'team-abc' });
      expect(client.listFunnels).toHaveBeenCalledWith('team-abc');
    });

    it('magnetlab_get_funnel passes team_id to client', async () => {
      await callTool(client, 'magnetlab_get_funnel', { id: 'f-1', team_id: 'team-abc' });
      expect(client.getFunnel).toHaveBeenCalledWith('f-1', 'team-abc');
    });

    it('magnetlab_create_funnel passes team_id to client', async () => {
      await callTool(client, 'magnetlab_create_funnel', {
        slug: 'my-funnel',
        team_id: 'team-abc',
      });
      expect(client.createFunnel).toHaveBeenCalledWith(
        expect.objectContaining({ teamId: 'team-abc' })
      );
    });

    it('magnetlab_update_funnel passes team_id to client', async () => {
      await callTool(client, 'magnetlab_update_funnel', {
        id: 'f-1',
        slug: 'new-slug',
        team_id: 'team-abc',
      });
      expect(client.updateFunnel).toHaveBeenCalledWith(
        'f-1',
        expect.objectContaining({ teamId: 'team-abc' })
      );
    });

    it('magnetlab_delete_funnel passes team_id to client', async () => {
      await callTool(client, 'magnetlab_delete_funnel', { id: 'f-1', team_id: 'team-abc' });
      expect(client.deleteFunnel).toHaveBeenCalledWith('f-1', 'team-abc');
    });

    it('magnetlab_publish_funnel passes team_id to client', async () => {
      await callTool(client, 'magnetlab_publish_funnel', { id: 'f-1', team_id: 'team-abc' });
      expect(client.publishFunnel).toHaveBeenCalledWith('f-1', 'team-abc');
    });

    it('magnetlab_unpublish_funnel passes team_id to client', async () => {
      await callTool(client, 'magnetlab_unpublish_funnel', { id: 'f-1', team_id: 'team-abc' });
      expect(client.unpublishFunnel).toHaveBeenCalledWith('f-1', 'team-abc');
    });

    it('magnetlab_search_knowledge passes team_id to client', async () => {
      await callTool(client, 'magnetlab_search_knowledge', {
        query: 'pricing',
        team_id: 'team-abc',
      });
      expect(client.searchKnowledge).toHaveBeenCalledWith(
        expect.objectContaining({ teamId: 'team-abc' })
      );
    });

    it('magnetlab_browse_knowledge passes team_id to client', async () => {
      await callTool(client, 'magnetlab_browse_knowledge', { team_id: 'team-abc' });
      expect(client.browseKnowledge).toHaveBeenCalledWith(
        expect.objectContaining({ teamId: 'team-abc' })
      );
    });

    it('magnetlab_get_knowledge_clusters passes team_id to client', async () => {
      await callTool(client, 'magnetlab_get_knowledge_clusters', { team_id: 'team-abc' });
      expect(client.getKnowledgeClusters).toHaveBeenCalledWith('team-abc');
    });

    it('magnetlab_ask_knowledge passes team_id to client', async () => {
      await callTool(client, 'magnetlab_ask_knowledge', {
        question: 'What is pricing?',
        team_id: 'team-abc',
      });
      expect(client.askKnowledge).toHaveBeenCalledWith(
        expect.objectContaining({ teamId: 'team-abc' })
      );
    });

    it('magnetlab_submit_transcript passes team_id to client', async () => {
      await callTool(client, 'magnetlab_submit_transcript', {
        transcript: 'A'.repeat(100),
        team_id: 'team-abc',
      });
      expect(client.submitTranscript).toHaveBeenCalledWith(
        expect.objectContaining({ teamId: 'team-abc' })
      );
    });

    it('magnetlab_list_posts passes team_id to client', async () => {
      await callTool(client, 'magnetlab_list_posts', { team_id: 'team-abc' });
      expect(client.listPosts).toHaveBeenCalledWith(
        expect.objectContaining({ teamId: 'team-abc' })
      );
    });

    it('magnetlab_get_post passes team_id to client', async () => {
      await callTool(client, 'magnetlab_get_post', { id: 'post-1', team_id: 'team-abc' });
      expect(client.getPost).toHaveBeenCalledWith('post-1', 'team-abc');
    });

    it('magnetlab_create_post passes team_id to client', async () => {
      await callTool(client, 'magnetlab_create_post', {
        body: 'My post',
        team_id: 'team-abc',
      });
      expect(client.createPost).toHaveBeenCalledWith(
        expect.objectContaining({ teamId: 'team-abc' })
      );
    });

    it('magnetlab_update_post passes team_id to client', async () => {
      await callTool(client, 'magnetlab_update_post', {
        id: 'post-1',
        draft_content: 'updated',
        team_id: 'team-abc',
      });
      expect(client.updatePost).toHaveBeenCalledWith('post-1', expect.any(Object), 'team-abc');
    });

    it('magnetlab_delete_post passes team_id to client', async () => {
      await callTool(client, 'magnetlab_delete_post', { id: 'post-1', team_id: 'team-abc' });
      expect(client.deletePost).toHaveBeenCalledWith('post-1', 'team-abc');
    });

    it('magnetlab_publish_post passes team_id to client', async () => {
      await callTool(client, 'magnetlab_publish_post', { id: 'post-1', team_id: 'team-abc' });
      expect(client.publishPost).toHaveBeenCalledWith('post-1', undefined, 'team-abc');
    });

    it('magnetlab_get_email_sequence passes team_id to client', async () => {
      await callTool(client, 'magnetlab_get_email_sequence', {
        lead_magnet_id: 'lm-1',
        team_id: 'team-abc',
      });
      expect(client.getEmailSequence).toHaveBeenCalledWith('lm-1', 'team-abc');
    });

    it('magnetlab_save_email_sequence passes team_id to client', async () => {
      await callTool(client, 'magnetlab_save_email_sequence', {
        lead_magnet_id: 'lm-1',
        status: 'draft',
        team_id: 'team-abc',
      });
      expect(client.saveEmailSequence).toHaveBeenCalledWith('lm-1', expect.any(Object), 'team-abc');
    });

    it('magnetlab_activate_email_sequence passes team_id to client', async () => {
      await callTool(client, 'magnetlab_activate_email_sequence', {
        lead_magnet_id: 'lm-1',
        team_id: 'team-abc',
      });
      expect(client.activateEmailSequence).toHaveBeenCalledWith('lm-1', 'team-abc');
    });

    it('magnetlab_list_leads passes team_id to client', async () => {
      await callTool(client, 'magnetlab_list_leads', { team_id: 'team-abc' });
      expect(client.listLeads).toHaveBeenCalledWith(
        expect.objectContaining({ teamId: 'team-abc' })
      );
    });

    it('magnetlab_get_lead passes team_id to client', async () => {
      await callTool(client, 'magnetlab_get_lead', { id: 'lead-1', team_id: 'team-abc' });
      expect(client.getLead).toHaveBeenCalledWith('lead-1', 'team-abc');
    });

    it('magnetlab_export_leads passes team_id to client', async () => {
      await callTool(client, 'magnetlab_export_leads', { team_id: 'team-abc' });
      expect(client.exportLeads).toHaveBeenCalledWith(
        expect.objectContaining({ teamId: 'team-abc' })
      );
    });

    it('magnetlab_get_business_context passes team_id to client', async () => {
      await callTool(client, 'magnetlab_get_business_context', { team_id: 'team-abc' });
      expect(client.getBusinessContext).toHaveBeenCalledWith('team-abc');
    });

    it('magnetlab_get_performance_insights passes team_id to client', async () => {
      await callTool(client, 'magnetlab_get_performance_insights', {
        period: '7d',
        team_id: 'team-abc',
      });
      expect(client.getPerformanceInsights).toHaveBeenCalledWith('7d', 'team-abc');
    });

    it('magnetlab_get_recommendations passes team_id to client', async () => {
      await callTool(client, 'magnetlab_get_recommendations', { team_id: 'team-abc' });
      expect(client.getRecommendations).toHaveBeenCalledWith('team-abc');
    });

    it('magnetlab_launch_lead_magnet passes team_id to client', async () => {
      await callTool(client, 'magnetlab_launch_lead_magnet', {
        title: 'My Guide',
        archetype: 'prompt',
        content: { headline: 'Test' },
        slug: 'my-guide',
        team_id: 'team-abc',
      });
      expect(client.launchLeadMagnet).toHaveBeenCalledWith(
        expect.objectContaining({ teamId: 'team-abc' })
      );
    });

    it('magnetlab_schedule_content_week passes team_id to client', async () => {
      await callTool(client, 'magnetlab_schedule_content_week', {
        posts: [{ body: 'Post 1' }],
        team_id: 'team-abc',
      });
      expect(client.scheduleContentWeek).toHaveBeenCalledWith(expect.any(Object), 'team-abc');
    });

    it('handlers pass undefined team_id when team_id not in args', async () => {
      await callTool(client, 'magnetlab_list_posts', { status: 'draft' });
      expect(client.listPosts).toHaveBeenCalledWith(expect.objectContaining({ teamId: undefined }));
    });
  });

  // ── Asset Review (3) ──────────────────────────────────────────────────────

  describe('Asset Review', () => {
    it('magnetlab_review_lead_magnet passes id and reviewed flag', async () => {
      await callTool(client, 'magnetlab_review_lead_magnet', {
        lead_magnet_id: 'lm-uuid',
        reviewed: true,
      });
      expect(client.reviewLeadMagnet).toHaveBeenCalledWith('lm-uuid', true);
    });

    it('magnetlab_review_lead_magnet passes reviewed: false', async () => {
      await callTool(client, 'magnetlab_review_lead_magnet', {
        lead_magnet_id: 'lm-uuid',
        reviewed: false,
      });
      expect(client.reviewLeadMagnet).toHaveBeenCalledWith('lm-uuid', false);
    });

    it('magnetlab_review_funnel passes id and reviewed flag', async () => {
      await callTool(client, 'magnetlab_review_funnel', {
        funnel_id: 'f-uuid',
        reviewed: true,
      });
      expect(client.reviewFunnel).toHaveBeenCalledWith('f-uuid', true);
    });

    it('magnetlab_review_funnel passes reviewed: false', async () => {
      await callTool(client, 'magnetlab_review_funnel', {
        funnel_id: 'f-uuid',
        reviewed: false,
      });
      expect(client.reviewFunnel).toHaveBeenCalledWith('f-uuid', false);
    });

    it('magnetlab_submit_asset_review passes team_id', async () => {
      await callTool(client, 'magnetlab_submit_asset_review', { team_id: 'team-1' });
      expect(client.submitAssetReview).toHaveBeenCalledWith('team-1');
    });
  });

  // ── Exploits (2) ──────────────────────────────────────────────────────────

  describe('Exploits', () => {
    it('magnetlab_list_exploits passes filter params', async () => {
      await callTool(client, 'magnetlab_list_exploits', {
        category: 'regular_post',
        creative_type: 'story',
        with_stats: true,
      });
      expect(client.listExploits).toHaveBeenCalledWith({
        category: 'regular_post',
        creativeType: 'story',
        withStats: true,
      });
    });

    it('magnetlab_list_exploits works with no params', async () => {
      await callTool(client, 'magnetlab_list_exploits', {});
      expect(client.listExploits).toHaveBeenCalledWith({
        category: undefined,
        creativeType: undefined,
        withStats: undefined,
      });
    });

    it('magnetlab_generate_post passes all primitive params', async () => {
      await callTool(client, 'magnetlab_generate_post', {
        creative_id: 'creative-1',
        exploit_id: 'exploit-1',
        knowledge_ids: ['k-1', 'k-2'],
        template_id: 'tmpl-1',
        idea_id: 'idea-1',
        style_id: 'style-1',
        hook: 'Most people get this wrong...',
        instructions: 'Make it more vulnerable',
      });
      expect(client.generatePost).toHaveBeenCalledWith({
        creativeId: 'creative-1',
        exploitId: 'exploit-1',
        knowledgeIds: ['k-1', 'k-2'],
        templateId: 'tmpl-1',
        ideaId: 'idea-1',
        styleId: 'style-1',
        hook: 'Most people get this wrong...',
        instructions: 'Make it more vulnerable',
      });
    });

    it('magnetlab_generate_post works with no params', async () => {
      await callTool(client, 'magnetlab_generate_post', {});
      expect(client.generatePost).toHaveBeenCalledWith({
        creativeId: undefined,
        exploitId: undefined,
        knowledgeIds: undefined,
        templateId: undefined,
        ideaId: undefined,
        styleId: undefined,
        hook: undefined,
        instructions: undefined,
      });
    });
  });

  // ── Creatives (6) ─────────────────────────────────────────────────────────

  describe('Creatives', () => {
    it('magnetlab_create_creative passes required content_text', async () => {
      await callTool(client, 'magnetlab_create_creative', {
        content_text: 'This is a great LinkedIn post about cold outreach.',
      });
      expect(client.createCreative).toHaveBeenCalledWith({
        contentText: 'This is a great LinkedIn post about cold outreach.',
        sourcePlatform: undefined,
        sourceUrl: undefined,
        sourceAuthor: undefined,
        imageUrl: undefined,
        teamId: undefined,
      });
    });

    it('magnetlab_create_creative passes all optional params', async () => {
      await callTool(client, 'magnetlab_create_creative', {
        content_text: 'Post content here',
        source_platform: 'linkedin',
        source_url: 'https://linkedin.com/feed/update/123',
        source_author: 'John Doe',
        image_url: 'https://example.com/image.jpg',
        team_id: 'team-abc',
      });
      expect(client.createCreative).toHaveBeenCalledWith({
        contentText: 'Post content here',
        sourcePlatform: 'linkedin',
        sourceUrl: 'https://linkedin.com/feed/update/123',
        sourceAuthor: 'John Doe',
        imageUrl: 'https://example.com/image.jpg',
        teamId: 'team-abc',
      });
    });

    it('magnetlab_list_creatives passes filter params', async () => {
      await callTool(client, 'magnetlab_list_creatives', {
        status: 'analyzed',
        source_platform: 'linkedin',
        min_score: 75,
        limit: 20,
      });
      expect(client.listCreatives).toHaveBeenCalledWith({
        status: 'analyzed',
        sourcePlatform: 'linkedin',
        minScore: 75,
        limit: 20,
      });
    });

    it('magnetlab_list_creatives works with no params', async () => {
      await callTool(client, 'magnetlab_list_creatives', {});
      expect(client.listCreatives).toHaveBeenCalledWith({
        status: undefined,
        sourcePlatform: undefined,
        minScore: undefined,
        limit: undefined,
      });
    });

    it('magnetlab_run_scanner calls runScanner with no args', async () => {
      await callTool(client, 'magnetlab_run_scanner', {});
      expect(client.runScanner).toHaveBeenCalled();
    });

    it('magnetlab_configure_scanner passes add action params', async () => {
      await callTool(client, 'magnetlab_configure_scanner', {
        action: 'add',
        source_type: 'hashtag',
        source_value: '#coldoutreach',
        priority: 2,
      });
      expect(client.configureScanner).toHaveBeenCalledWith({
        action: 'add',
        sourceType: 'hashtag',
        sourceValue: '#coldoutreach',
        priority: 2,
      });
    });

    it('magnetlab_configure_scanner passes remove action params', async () => {
      await callTool(client, 'magnetlab_configure_scanner', {
        action: 'remove',
        source_type: 'creator',
        source_value: 'johndoe',
      });
      expect(client.configureScanner).toHaveBeenCalledWith({
        action: 'remove',
        sourceType: 'creator',
        sourceValue: 'johndoe',
        priority: undefined,
      });
    });

    it('magnetlab_list_recyclable_posts returns Phase 2 stub message', async () => {
      const result = await callTool(client, 'magnetlab_list_recyclable_posts', {});
      expect(result.message).toBe('Phase 2 not yet implemented');
    });

    it('magnetlab_recycle_post returns Phase 2 stub message', async () => {
      const result = await callTool(client, 'magnetlab_recycle_post', {
        post_id: 'post-uuid',
        type: 'cousin',
      });
      expect(result.message).toBe('Phase 2 not yet implemented');
    });
  });

  // ── Error Handling ────────────────────────────────────────────────────────

  describe('Error handling', () => {
    it('unknown tool returns error', async () => {
      const result = await callTool(client, 'magnetlab_nonexistent_tool', {});
      expect(result.error).toMatch(/Unknown tool/);
    });

    it('validation failure returns error (missing required field)', async () => {
      const result = await callTool(client, 'magnetlab_get_lead_magnet', {});
      expect(result.error).toBeTruthy();
    });

    it('client method error is caught and returned', async () => {
      (client.listLeadMagnets as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Network error')
      );
      const result = await callTool(client, 'magnetlab_list_lead_magnets', {});
      expect(result.error).toBe('Network error');
    });
  });

  // ── Response Format ───────────────────────────────────────────────────────

  describe('Response format', () => {
    it('wraps result in content array with text type', async () => {
      const result = await handleToolCall('magnetlab_list_lead_magnets', {}, client);
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      expect(typeof result.content[0].text).toBe('string');

      // Should be valid JSON
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toBeDefined();
    });

    it('error responses are also valid JSON with content array', async () => {
      const result = await handleToolCall('magnetlab_not_real', {}, client);
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toBeTruthy();
    });
  });
});
