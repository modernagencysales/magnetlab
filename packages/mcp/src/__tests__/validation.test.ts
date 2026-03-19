import { describe, it, expect } from 'vitest';
import { toolSchemas, validateToolArgs } from '../validation.js';

describe('Validation Schemas', () => {
  const schemaNames = Object.keys(toolSchemas);

  it('has exactly 62 schemas', () => {
    expect(schemaNames.length).toBe(62);
  });

  it('every schema name starts with magnetlab_', () => {
    for (const name of schemaNames) {
      expect(name).toMatch(/^magnetlab_/);
    }
  });

  // ── validateToolArgs throws on unknown tool ──────────────────

  describe('validateToolArgs', () => {
    it('throws on unknown tool name', () => {
      expect(() => validateToolArgs('not_a_real_tool', {})).toThrow(
        'Unknown tool: not_a_real_tool'
      );
    });

    it('returns parsed data on valid input', () => {
      const result = validateToolArgs('magnetlab_get_lead_magnet', { id: 'abc-123' });
      expect(result).toEqual({ id: 'abc-123' });
    });

    it('throws ZodError on invalid input', () => {
      expect(() => validateToolArgs('magnetlab_get_lead_magnet', {})).toThrow();
    });
  });

  // ── Lead Magnet schemas (5) ────────────────────────────────────

  describe('magnetlab_list_lead_magnets', () => {
    it('accepts empty args', () => {
      const result = validateToolArgs('magnetlab_list_lead_magnets', {});
      expect(result).toBeDefined();
    });

    it('accepts all optional filters', () => {
      const result = validateToolArgs('magnetlab_list_lead_magnets', {
        status: 'published',
        limit: 25,
        offset: 10,
        team_id: 'team-1',
      });
      expect(result).toMatchObject({ status: 'published', limit: 25, offset: 10 });
    });

    it('rejects invalid status', () => {
      expect(() =>
        validateToolArgs('magnetlab_list_lead_magnets', { status: 'invalid' })
      ).toThrow();
    });
  });

  describe('magnetlab_get_lead_magnet', () => {
    it('accepts valid id', () => {
      const result = validateToolArgs('magnetlab_get_lead_magnet', { id: 'abc-123' });
      expect(result).toEqual({ id: 'abc-123' });
    });

    it('rejects missing id', () => {
      expect(() => validateToolArgs('magnetlab_get_lead_magnet', {})).toThrow();
    });

    it('rejects empty id', () => {
      expect(() => validateToolArgs('magnetlab_get_lead_magnet', { id: '' })).toThrow();
    });
  });

  describe('magnetlab_create_lead_magnet', () => {
    it('accepts valid input', () => {
      const result = validateToolArgs('magnetlab_create_lead_magnet', {
        title: 'My Lead Magnet',
        archetype: 'single-breakdown',
      });
      expect(result).toMatchObject({ title: 'My Lead Magnet', archetype: 'single-breakdown' });
    });

    it('accepts optional concept', () => {
      const result = validateToolArgs('magnetlab_create_lead_magnet', {
        title: 'Test',
        archetype: 'prompt',
        concept: { topic: 'AI' },
      });
      expect(result).toMatchObject({ concept: { topic: 'AI' } });
    });

    it('rejects missing title', () => {
      expect(() =>
        validateToolArgs('magnetlab_create_lead_magnet', { archetype: 'single-breakdown' })
      ).toThrow();
    });

    it('rejects invalid archetype', () => {
      expect(() =>
        validateToolArgs('magnetlab_create_lead_magnet', {
          title: 'Test',
          archetype: 'invalid-type',
        })
      ).toThrow();
    });
  });

  describe('magnetlab_update_lead_magnet', () => {
    it('accepts valid input', () => {
      const result = validateToolArgs('magnetlab_update_lead_magnet', {
        id: 'lm-1',
        content: { title: 'Updated' },
      });
      expect(result).toMatchObject({ id: 'lm-1', content: { title: 'Updated' } });
    });

    it('accepts optional expected_version', () => {
      const result = validateToolArgs('magnetlab_update_lead_magnet', {
        id: 'lm-1',
        content: { title: 'Updated' },
        expected_version: 3,
      });
      expect(result).toMatchObject({ expected_version: 3 });
    });

    it('rejects missing content', () => {
      expect(() => validateToolArgs('magnetlab_update_lead_magnet', { id: 'lm-1' })).toThrow();
    });
  });

  describe('magnetlab_delete_lead_magnet', () => {
    it('accepts valid id', () => {
      const result = validateToolArgs('magnetlab_delete_lead_magnet', { id: 'uuid-here' });
      expect(result).toEqual({ id: 'uuid-here' });
    });

    it('rejects empty id', () => {
      expect(() => validateToolArgs('magnetlab_delete_lead_magnet', { id: '' })).toThrow();
    });
  });

  // ── Funnel schemas (7) ─────────────────────────────────────────

  describe('magnetlab_list_funnels', () => {
    it('accepts empty args', () => {
      const result = validateToolArgs('magnetlab_list_funnels', {});
      expect(result).toBeDefined();
    });
  });

  describe('magnetlab_get_funnel', () => {
    it('accepts valid id', () => {
      const result = validateToolArgs('magnetlab_get_funnel', { id: 'funnel-1' });
      expect(result).toMatchObject({ id: 'funnel-1' });
    });

    it('rejects missing id', () => {
      expect(() => validateToolArgs('magnetlab_get_funnel', {})).toThrow();
    });
  });

  describe('magnetlab_create_funnel', () => {
    it('accepts minimal input', () => {
      const result = validateToolArgs('magnetlab_create_funnel', { slug: 'my-funnel' });
      expect(result).toMatchObject({ slug: 'my-funnel' });
    });

    it('accepts full input with all optional fields', () => {
      const result = validateToolArgs('magnetlab_create_funnel', {
        slug: 'my-funnel',
        lead_magnet_id: 'lm-1',
        theme: 'dark',
        background_style: 'gradient',
        optin_headline: 'Get the Guide',
      });
      expect(result).toMatchObject({ theme: 'dark', background_style: 'gradient' });
    });

    it('rejects missing slug', () => {
      expect(() => validateToolArgs('magnetlab_create_funnel', {})).toThrow();
    });

    it('rejects invalid theme', () => {
      expect(() =>
        validateToolArgs('magnetlab_create_funnel', { slug: 'test', theme: 'neon' })
      ).toThrow();
    });
  });

  describe('magnetlab_update_funnel', () => {
    it('accepts id with optional fields', () => {
      const result = validateToolArgs('magnetlab_update_funnel', {
        id: 'f-1',
        optin_headline: 'New Headline',
        send_resource_email: true,
      });
      expect(result).toMatchObject({ id: 'f-1', send_resource_email: true });
    });

    it('accepts nullable fields set to null', () => {
      const result = validateToolArgs('magnetlab_update_funnel', {
        id: 'f-1',
        qualification_form_id: null,
        redirect_url: null,
      });
      expect(result).toMatchObject({ qualification_form_id: null, redirect_url: null });
    });

    it('rejects missing id', () => {
      expect(() => validateToolArgs('magnetlab_update_funnel', { slug: 'new-slug' })).toThrow();
    });
  });

  describe('magnetlab_delete_funnel', () => {
    it('accepts valid id', () => {
      const result = validateToolArgs('magnetlab_delete_funnel', { id: 'f-1' });
      expect(result).toMatchObject({ id: 'f-1' });
    });
  });

  describe('magnetlab_publish_funnel', () => {
    it('accepts valid id', () => {
      const result = validateToolArgs('magnetlab_publish_funnel', { id: 'f-1' });
      expect(result).toMatchObject({ id: 'f-1' });
    });
  });

  describe('magnetlab_unpublish_funnel', () => {
    it('accepts valid id', () => {
      const result = validateToolArgs('magnetlab_unpublish_funnel', { id: 'f-1' });
      expect(result).toMatchObject({ id: 'f-1' });
    });
  });

  // ── Knowledge schemas (5) ──────────────────────────────────────

  describe('magnetlab_search_knowledge', () => {
    it('accepts empty args (browse mode)', () => {
      const result = validateToolArgs('magnetlab_search_knowledge', {});
      expect(result).toBeDefined();
    });

    it('accepts all filters', () => {
      const result = validateToolArgs('magnetlab_search_knowledge', {
        query: 'pricing strategy',
        category: 'insight',
        type: 'how_to',
        topic: 'pricing',
        min_quality: 3,
        since: '2026-01-01',
      });
      expect(result).toMatchObject({ query: 'pricing strategy', category: 'insight' });
    });

    it('rejects invalid category', () => {
      expect(() => validateToolArgs('magnetlab_search_knowledge', { category: 'bad' })).toThrow();
    });

    it('rejects min_quality > 5', () => {
      expect(() => validateToolArgs('magnetlab_search_knowledge', { min_quality: 6 })).toThrow();
    });
  });

  describe('magnetlab_browse_knowledge', () => {
    it('accepts empty args', () => {
      const result = validateToolArgs('magnetlab_browse_knowledge', {});
      expect(result).toBeDefined();
    });

    it('accepts category and tag', () => {
      const result = validateToolArgs('magnetlab_browse_knowledge', {
        category: 'question',
        tag: 'pricing',
        limit: 10,
      });
      expect(result).toMatchObject({ category: 'question', tag: 'pricing' });
    });
  });

  describe('magnetlab_get_knowledge_clusters', () => {
    it('accepts empty args', () => {
      const result = validateToolArgs('magnetlab_get_knowledge_clusters', {});
      expect(result).toBeDefined();
    });
  });

  describe('magnetlab_ask_knowledge', () => {
    it('accepts valid question', () => {
      const result = validateToolArgs('magnetlab_ask_knowledge', {
        question: 'What pricing strategies work best?',
      });
      expect(result).toMatchObject({ question: 'What pricing strategies work best?' });
    });

    it('rejects question under 3 chars', () => {
      expect(() => validateToolArgs('magnetlab_ask_knowledge', { question: 'hi' })).toThrow();
    });

    it('rejects missing question', () => {
      expect(() => validateToolArgs('magnetlab_ask_knowledge', {})).toThrow();
    });
  });

  describe('magnetlab_submit_transcript', () => {
    it('accepts transcript with 100+ chars', () => {
      const result = validateToolArgs('magnetlab_submit_transcript', {
        transcript: 'A'.repeat(100),
      });
      expect(result).toBeDefined();
    });

    it('accepts optional title', () => {
      const result = validateToolArgs('magnetlab_submit_transcript', {
        transcript: 'A'.repeat(100),
        title: 'Client call Q1',
      });
      expect(result).toMatchObject({ title: 'Client call Q1' });
    });

    it('rejects short transcript', () => {
      expect(() =>
        validateToolArgs('magnetlab_submit_transcript', { transcript: 'too short' })
      ).toThrow();
    });
  });

  // ── Post schemas (6) ───────────────────────────────────────────

  describe('magnetlab_list_posts', () => {
    it('accepts empty args', () => {
      const result = validateToolArgs('magnetlab_list_posts', {});
      expect(result).toBeDefined();
    });

    it('accepts status filter', () => {
      const result = validateToolArgs('magnetlab_list_posts', { status: 'draft' });
      expect(result).toMatchObject({ status: 'draft' });
    });

    it('accepts is_buffer filter', () => {
      const result = validateToolArgs('magnetlab_list_posts', { is_buffer: true });
      expect(result).toMatchObject({ is_buffer: true });
    });

    it('rejects invalid status', () => {
      expect(() => validateToolArgs('magnetlab_list_posts', { status: 'unknown' })).toThrow();
    });
  });

  describe('magnetlab_get_post', () => {
    it('accepts valid id', () => {
      const result = validateToolArgs('magnetlab_get_post', { id: 'post-1' });
      expect(result).toMatchObject({ id: 'post-1' });
    });
  });

  describe('magnetlab_create_post', () => {
    it('accepts minimal input', () => {
      const result = validateToolArgs('magnetlab_create_post', { body: 'Post content here' });
      expect(result).toMatchObject({ body: 'Post content here' });
    });

    it('accepts all optional fields', () => {
      const result = validateToolArgs('magnetlab_create_post', {
        body: 'Post content',
        title: 'My Post',
        pillar: 'teaching_promotion',
        content_type: 'framework',
      });
      expect(result).toMatchObject({ pillar: 'teaching_promotion', content_type: 'framework' });
    });

    it('rejects empty body', () => {
      expect(() => validateToolArgs('magnetlab_create_post', { body: '' })).toThrow();
    });

    it('rejects missing body', () => {
      expect(() => validateToolArgs('magnetlab_create_post', {})).toThrow();
    });

    it('rejects invalid pillar', () => {
      expect(() =>
        validateToolArgs('magnetlab_create_post', { body: 'x', pillar: 'invalid' })
      ).toThrow();
    });
  });

  describe('magnetlab_update_post', () => {
    it('accepts id with optional fields', () => {
      const result = validateToolArgs('magnetlab_update_post', {
        id: 'post-1',
        draft_content: 'Updated draft',
        status: 'review',
      });
      expect(result).toMatchObject({ status: 'review' });
    });

    it('rejects missing id', () => {
      expect(() => validateToolArgs('magnetlab_update_post', { draft_content: 'x' })).toThrow();
    });
  });

  describe('magnetlab_delete_post', () => {
    it('accepts valid id', () => {
      const result = validateToolArgs('magnetlab_delete_post', { id: 'post-1' });
      expect(result).toMatchObject({ id: 'post-1' });
    });
  });

  describe('magnetlab_publish_post', () => {
    it('accepts valid id', () => {
      const result = validateToolArgs('magnetlab_publish_post', { id: 'post-1' });
      expect(result).toMatchObject({ id: 'post-1' });
    });
  });

  // ── Email Sequence schemas (3) ─────────────────────────────────

  describe('magnetlab_get_email_sequence', () => {
    it('accepts valid lead_magnet_id', () => {
      const result = validateToolArgs('magnetlab_get_email_sequence', {
        lead_magnet_id: 'lm-1',
      });
      expect(result).toMatchObject({ lead_magnet_id: 'lm-1' });
    });

    it('rejects missing lead_magnet_id', () => {
      expect(() => validateToolArgs('magnetlab_get_email_sequence', {})).toThrow();
    });
  });

  describe('magnetlab_save_email_sequence', () => {
    it('accepts lead_magnet_id with emails', () => {
      const result = validateToolArgs('magnetlab_save_email_sequence', {
        lead_magnet_id: 'lm-1',
        emails: [
          { day: 0, subject: 'Welcome', body: '<p>Hi!</p>' },
          { day: 3, subject: 'Follow up', body: '<p>Checking in</p>', replyTrigger: 'help' },
        ],
      });
      expect(result).toMatchObject({ lead_magnet_id: 'lm-1' });
    });

    it('accepts status without emails', () => {
      const result = validateToolArgs('magnetlab_save_email_sequence', {
        lead_magnet_id: 'lm-1',
        status: 'draft',
      });
      expect(result).toMatchObject({ status: 'draft' });
    });

    it('rejects invalid email entry (missing subject)', () => {
      expect(() =>
        validateToolArgs('magnetlab_save_email_sequence', {
          lead_magnet_id: 'lm-1',
          emails: [{ day: 0, body: 'body' }],
        })
      ).toThrow();
    });

    it('rejects invalid status', () => {
      expect(() =>
        validateToolArgs('magnetlab_save_email_sequence', {
          lead_magnet_id: 'lm-1',
          status: 'pending',
        })
      ).toThrow();
    });
  });

  describe('magnetlab_activate_email_sequence', () => {
    it('accepts valid lead_magnet_id', () => {
      const result = validateToolArgs('magnetlab_activate_email_sequence', {
        lead_magnet_id: 'lm-1',
      });
      expect(result).toMatchObject({ lead_magnet_id: 'lm-1' });
    });
  });

  // ── Lead schemas (3) ───────────────────────────────────────────

  describe('magnetlab_list_leads', () => {
    it('accepts empty args', () => {
      const result = validateToolArgs('magnetlab_list_leads', {});
      expect(result).toBeDefined();
    });

    it('accepts all optional filters', () => {
      const result = validateToolArgs('magnetlab_list_leads', {
        funnel_id: 'f-1',
        lead_magnet_id: 'lm-1',
        qualified: true,
        search: 'john',
        limit: 20,
        offset: 5,
      });
      expect(result).toMatchObject({ qualified: true, search: 'john' });
    });
  });

  describe('magnetlab_get_lead', () => {
    it('accepts valid id', () => {
      const result = validateToolArgs('magnetlab_get_lead', { id: 'lead-1' });
      expect(result).toMatchObject({ id: 'lead-1' });
    });
  });

  describe('magnetlab_export_leads', () => {
    it('accepts empty args', () => {
      const result = validateToolArgs('magnetlab_export_leads', {});
      expect(result).toBeDefined();
    });

    it('accepts filters', () => {
      const result = validateToolArgs('magnetlab_export_leads', {
        lead_magnet_id: 'lm-1',
        qualified: false,
      });
      expect(result).toMatchObject({ qualified: false });
    });
  });

  // ── Schema / Introspection schemas (3) ─────────────────────────

  describe('magnetlab_list_archetypes', () => {
    it('accepts empty args', () => {
      const result = validateToolArgs('magnetlab_list_archetypes', {});
      expect(result).toBeDefined();
    });
  });

  describe('magnetlab_get_archetype_schema', () => {
    it('accepts valid archetype', () => {
      const result = validateToolArgs('magnetlab_get_archetype_schema', {
        archetype: 'single-breakdown',
      });
      expect(result).toMatchObject({ archetype: 'single-breakdown' });
    });

    it('rejects invalid archetype', () => {
      expect(() =>
        validateToolArgs('magnetlab_get_archetype_schema', { archetype: 'bogus' })
      ).toThrow();
    });

    it('rejects missing archetype', () => {
      expect(() => validateToolArgs('magnetlab_get_archetype_schema', {})).toThrow();
    });
  });

  describe('magnetlab_get_business_context', () => {
    it('accepts empty args', () => {
      const result = validateToolArgs('magnetlab_get_business_context', {});
      expect(result).toBeDefined();
    });
  });

  // ── Compound Action schemas (2) ────────────────────────────────

  describe('magnetlab_launch_lead_magnet', () => {
    it('accepts minimal input', () => {
      const result = validateToolArgs('magnetlab_launch_lead_magnet', {
        title: 'My Guide',
        archetype: 'single-breakdown',
        content: { headline: 'Test' },
        slug: 'my-guide',
      });
      expect(result).toMatchObject({ title: 'My Guide', slug: 'my-guide' });
    });

    it('accepts all optional fields', () => {
      const result = validateToolArgs('magnetlab_launch_lead_magnet', {
        title: 'My Guide',
        archetype: 'single-breakdown',
        content: { headline: 'Test' },
        slug: 'my-guide',
        funnel_theme: 'dark',
        email_sequence: {
          emails: [{ subject: 'Welcome', body: 'Hi there', delay_days: 0 }],
        },
      });
      expect(result).toMatchObject({ funnel_theme: 'dark' });
      expect(result).toHaveProperty('email_sequence');
    });

    it('rejects missing required fields', () => {
      expect(() => validateToolArgs('magnetlab_launch_lead_magnet', {})).toThrow();
      expect(() => validateToolArgs('magnetlab_launch_lead_magnet', { title: 'Test' })).toThrow();
    });

    it('rejects invalid slug format', () => {
      expect(() =>
        validateToolArgs('magnetlab_launch_lead_magnet', {
          title: 'My Guide',
          archetype: 'single-breakdown',
          content: { headline: 'Test' },
          slug: 'INVALID SLUG',
        })
      ).toThrow();
    });
  });

  describe('magnetlab_schedule_content_week', () => {
    it('accepts minimal input with one post', () => {
      const result = validateToolArgs('magnetlab_schedule_content_week', {
        posts: [{ body: 'Hello world' }],
      });
      expect(result).toHaveProperty('posts');
    });

    it('accepts all optional fields', () => {
      const result = validateToolArgs('magnetlab_schedule_content_week', {
        posts: [
          { body: 'Post 1', pillar: 'teaching_promotion', content_type: 'tip' },
          { body: 'Post 2', title: 'Second', pillar: 'human_personal' },
        ],
        week_start: '2026-03-17',
      });
      expect(result).toMatchObject({ week_start: '2026-03-17' });
    });

    it('rejects empty posts array', () => {
      expect(() => validateToolArgs('magnetlab_schedule_content_week', { posts: [] })).toThrow();
    });

    it('rejects more than 7 posts', () => {
      const posts = Array.from({ length: 8 }, (_, i) => ({ body: `Post ${i}` }));
      expect(() => validateToolArgs('magnetlab_schedule_content_week', { posts })).toThrow();
    });

    it('rejects missing posts', () => {
      expect(() => validateToolArgs('magnetlab_schedule_content_week', {})).toThrow();
    });
  });

  // ── Feedback / Analytics schemas (2) ───────────────────────────

  describe('magnetlab_get_performance_insights', () => {
    it('accepts empty args', () => {
      const result = validateToolArgs('magnetlab_get_performance_insights', {});
      expect(result).toBeDefined();
    });

    it('accepts valid period', () => {
      const result = validateToolArgs('magnetlab_get_performance_insights', { period: '7d' });
      expect(result).toMatchObject({ period: '7d' });
    });

    it('rejects invalid period', () => {
      expect(() =>
        validateToolArgs('magnetlab_get_performance_insights', { period: '1y' })
      ).toThrow();
    });
  });

  describe('magnetlab_get_recommendations', () => {
    it('accepts empty args', () => {
      const result = validateToolArgs('magnetlab_get_recommendations', {});
      expect(result).toBeDefined();
    });
  });

  // ── Account schemas (1) ────────────────────────────────────────

  describe('magnetlab_list_teams', () => {
    it('accepts empty args', () => {
      const result = validateToolArgs('magnetlab_list_teams', {});
      expect(result).toBeDefined();
    });
  });

  // ── Asset Review schemas (3) ───────────────────────────────────────────────

  describe('magnetlab_review_lead_magnet', () => {
    it('accepts valid id and reviewed: true', () => {
      const result = validateToolArgs('magnetlab_review_lead_magnet', {
        lead_magnet_id: 'lm-uuid',
        reviewed: true,
      });
      expect(result).toMatchObject({ lead_magnet_id: 'lm-uuid', reviewed: true });
    });

    it('accepts reviewed: false', () => {
      const result = validateToolArgs('magnetlab_review_lead_magnet', {
        lead_magnet_id: 'lm-uuid',
        reviewed: false,
      });
      expect(result).toMatchObject({ reviewed: false });
    });

    it('rejects missing lead_magnet_id', () => {
      expect(() => validateToolArgs('magnetlab_review_lead_magnet', { reviewed: true })).toThrow();
    });

    it('rejects empty lead_magnet_id', () => {
      expect(() =>
        validateToolArgs('magnetlab_review_lead_magnet', { lead_magnet_id: '', reviewed: true })
      ).toThrow();
    });

    it('rejects missing reviewed', () => {
      expect(() =>
        validateToolArgs('magnetlab_review_lead_magnet', { lead_magnet_id: 'lm-uuid' })
      ).toThrow();
    });
  });

  describe('magnetlab_review_funnel', () => {
    it('accepts valid funnel_id and reviewed: true', () => {
      const result = validateToolArgs('magnetlab_review_funnel', {
        funnel_id: 'f-uuid',
        reviewed: true,
      });
      expect(result).toMatchObject({ funnel_id: 'f-uuid', reviewed: true });
    });

    it('accepts reviewed: false', () => {
      const result = validateToolArgs('magnetlab_review_funnel', {
        funnel_id: 'f-uuid',
        reviewed: false,
      });
      expect(result).toMatchObject({ reviewed: false });
    });

    it('rejects missing funnel_id', () => {
      expect(() => validateToolArgs('magnetlab_review_funnel', { reviewed: true })).toThrow();
    });

    it('rejects empty funnel_id', () => {
      expect(() =>
        validateToolArgs('magnetlab_review_funnel', { funnel_id: '', reviewed: true })
      ).toThrow();
    });

    it('rejects missing reviewed', () => {
      expect(() => validateToolArgs('magnetlab_review_funnel', { funnel_id: 'f-uuid' })).toThrow();
    });
  });

  describe('magnetlab_submit_asset_review', () => {
    it('accepts valid team_id', () => {
      const result = validateToolArgs('magnetlab_submit_asset_review', { team_id: 'team-1' });
      expect(result).toMatchObject({ team_id: 'team-1' });
    });

    it('rejects missing team_id', () => {
      expect(() => validateToolArgs('magnetlab_submit_asset_review', {})).toThrow();
    });

    it('rejects empty team_id', () => {
      expect(() => validateToolArgs('magnetlab_submit_asset_review', { team_id: '' })).toThrow();
    });
  });

  // ── Comprehensive: schemas with required fields reject empty object ──

  describe('every schema with required fields rejects empty object', () => {
    const schemasWithRequired = Object.entries(toolSchemas).filter(([, schema]) => {
      const result = (schema as { safeParse: (a: unknown) => { success: boolean } }).safeParse({});
      return !result.success;
    });

    for (const [name] of schemasWithRequired) {
      it(`${name} rejects empty object`, () => {
        expect(() => validateToolArgs(name, {})).toThrow();
      });
    }
  });
});
