import { describe, it, expect } from 'vitest'
import { toolSchemas, validateToolArgs } from '../validation.js'

describe('Validation Schemas', () => {
  const schemaNames = Object.keys(toolSchemas) as Array<keyof typeof toolSchemas>

  it('has schemas defined', () => {
    expect(schemaNames.length).toBeGreaterThan(40)
  })

  describe('tools without schemas pass through unchanged', () => {
    it('magnetlab_list_funnels (no schema) passes any args', () => {
      const result = validateToolArgs('magnetlab_list_funnels', { foo: 'bar' })
      expect(result.success).toBe(true)
      if (result.success) expect(result.data).toEqual({ foo: 'bar' })
    })

    it('magnetlab_list_email_flows (no schema) passes any args', () => {
      const result = validateToolArgs('magnetlab_list_email_flows', {})
      expect(result.success).toBe(true)
    })

    it('unknown tool name passes through', () => {
      const result = validateToolArgs('not_a_real_tool', { x: 1 })
      expect(result.success).toBe(true)
    })
  })

  // ── Lead Magnet schemas ──────────────────────────────────

  describe('magnetlab_get_lead_magnet', () => {
    it('accepts valid id', () => {
      const result = validateToolArgs('magnetlab_get_lead_magnet', { id: 'abc-123' })
      expect(result.success).toBe(true)
    })

    it('rejects missing id', () => {
      const result = validateToolArgs('magnetlab_get_lead_magnet', {})
      expect(result.success).toBe(false)
    })

    it('rejects empty id', () => {
      const result = validateToolArgs('magnetlab_get_lead_magnet', { id: '' })
      expect(result.success).toBe(false)
    })
  })

  describe('magnetlab_create_lead_magnet', () => {
    it('accepts valid input', () => {
      const result = validateToolArgs('magnetlab_create_lead_magnet', {
        title: 'My Lead Magnet',
        archetype: 'single-breakdown',
      })
      expect(result.success).toBe(true)
    })

    it('rejects missing title', () => {
      const result = validateToolArgs('magnetlab_create_lead_magnet', {
        archetype: 'single-breakdown',
      })
      expect(result.success).toBe(false)
    })

    it('rejects invalid archetype', () => {
      const result = validateToolArgs('magnetlab_create_lead_magnet', {
        title: 'Test',
        archetype: 'invalid-type',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('magnetlab_delete_lead_magnet', () => {
    it('accepts valid id', () => {
      const result = validateToolArgs('magnetlab_delete_lead_magnet', { id: 'uuid-here' })
      expect(result.success).toBe(true)
    })

    it('rejects empty id', () => {
      const result = validateToolArgs('magnetlab_delete_lead_magnet', { id: '' })
      expect(result.success).toBe(false)
    })
  })

  describe('magnetlab_get_lead_magnet_stats', () => {
    it('accepts valid lead_magnet_id', () => {
      const result = validateToolArgs('magnetlab_get_lead_magnet_stats', {
        lead_magnet_id: 'lm-123',
      })
      expect(result.success).toBe(true)
    })

    it('rejects missing lead_magnet_id', () => {
      const result = validateToolArgs('magnetlab_get_lead_magnet_stats', {})
      expect(result.success).toBe(false)
    })
  })

  describe('magnetlab_analyze_competitor', () => {
    it('accepts valid URL', () => {
      const result = validateToolArgs('magnetlab_analyze_competitor', {
        url: 'https://example.com/page',
      })
      expect(result.success).toBe(true)
    })

    it('rejects invalid URL', () => {
      const result = validateToolArgs('magnetlab_analyze_competitor', { url: 'not-a-url' })
      expect(result.success).toBe(false)
    })
  })

  describe('magnetlab_analyze_transcript', () => {
    it('accepts transcript with 50+ chars', () => {
      const result = validateToolArgs('magnetlab_analyze_transcript', {
        transcript: 'A'.repeat(50),
      })
      expect(result.success).toBe(true)
    })

    it('rejects short transcript', () => {
      const result = validateToolArgs('magnetlab_analyze_transcript', { transcript: 'short' })
      expect(result.success).toBe(false)
    })
  })

  // ── Ideation schemas ─────────────────────────────────────

  describe('magnetlab_ideate_lead_magnets', () => {
    it('accepts valid input', () => {
      const result = validateToolArgs('magnetlab_ideate_lead_magnets', {
        business_description: 'We help coaches grow',
        business_type: 'coaching',
      })
      expect(result.success).toBe(true)
    })

    it('rejects missing business_description', () => {
      const result = validateToolArgs('magnetlab_ideate_lead_magnets', {
        business_type: 'coaching',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('magnetlab_extract_content', () => {
    it('accepts valid input', () => {
      const result = validateToolArgs('magnetlab_extract_content', {
        lead_magnet_id: 'lm-1',
        archetype: 'prompt',
        concept: { topic: 'AI' },
        answers: { q1: 'answer1' },
      })
      expect(result.success).toBe(true)
    })

    it('rejects missing answers', () => {
      const result = validateToolArgs('magnetlab_extract_content', {
        lead_magnet_id: 'lm-1',
        archetype: 'prompt',
        concept: { topic: 'AI' },
      })
      expect(result.success).toBe(false)
    })
  })

  describe('magnetlab_write_linkedin_posts', () => {
    it('accepts valid input', () => {
      const result = validateToolArgs('magnetlab_write_linkedin_posts', {
        lead_magnet_id: 'lm-1',
        lead_magnet_title: 'Growth Guide',
        contents: 'Full content here',
        problem_solved: 'Scaling issues',
      })
      expect(result.success).toBe(true)
    })

    it('rejects missing problem_solved', () => {
      const result = validateToolArgs('magnetlab_write_linkedin_posts', {
        lead_magnet_id: 'lm-1',
        lead_magnet_title: 'Growth Guide',
        contents: 'Full content here',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('magnetlab_get_job_status', () => {
    it('accepts valid job_id', () => {
      const result = validateToolArgs('magnetlab_get_job_status', { job_id: 'job-xyz' })
      expect(result.success).toBe(true)
    })
  })

  // ── Funnel schemas ────────────────────────────────────────

  describe('magnetlab_get_funnel', () => {
    it('accepts valid id', () => {
      const result = validateToolArgs('magnetlab_get_funnel', { id: 'funnel-1' })
      expect(result.success).toBe(true)
    })
  })

  describe('magnetlab_create_funnel', () => {
    it('accepts valid slug', () => {
      const result = validateToolArgs('magnetlab_create_funnel', { slug: 'my-funnel' })
      expect(result.success).toBe(true)
    })

    it('rejects missing slug', () => {
      const result = validateToolArgs('magnetlab_create_funnel', {})
      expect(result.success).toBe(false)
    })
  })

  describe('magnetlab_generate_funnel_content', () => {
    it('accepts valid lead_magnet_id', () => {
      const result = validateToolArgs('magnetlab_generate_funnel_content', {
        lead_magnet_id: 'lm-1',
      })
      expect(result.success).toBe(true)
    })
  })

  // ── Email Sequence schemas ────────────────────────────────

  describe('magnetlab_get_email_sequence', () => {
    it('accepts valid lead_magnet_id', () => {
      const result = validateToolArgs('magnetlab_get_email_sequence', {
        lead_magnet_id: 'lm-1',
      })
      expect(result.success).toBe(true)
    })
  })

  // ── Content Pipeline schemas ──────────────────────────────

  describe('magnetlab_submit_transcript', () => {
    it('accepts transcript with 100+ chars', () => {
      const result = validateToolArgs('magnetlab_submit_transcript', {
        transcript: 'A'.repeat(100),
      })
      expect(result.success).toBe(true)
    })

    it('rejects short transcript', () => {
      const result = validateToolArgs('magnetlab_submit_transcript', { transcript: 'too short' })
      expect(result.success).toBe(false)
    })
  })

  describe('magnetlab_update_idea_status', () => {
    it('accepts valid status', () => {
      const result = validateToolArgs('magnetlab_update_idea_status', {
        idea_id: 'idea-1',
        status: 'selected',
      })
      expect(result.success).toBe(true)
    })

    it('rejects invalid status', () => {
      const result = validateToolArgs('magnetlab_update_idea_status', {
        idea_id: 'idea-1',
        status: 'invalid',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('magnetlab_schedule_post', () => {
    it('accepts valid input', () => {
      const result = validateToolArgs('magnetlab_schedule_post', {
        post_id: 'post-1',
        scheduled_time: '2026-03-01T10:00:00Z',
      })
      expect(result.success).toBe(true)
    })

    it('rejects missing scheduled_time', () => {
      const result = validateToolArgs('magnetlab_schedule_post', { post_id: 'post-1' })
      expect(result.success).toBe(false)
    })
  })

  describe('magnetlab_create_posting_slot', () => {
    it('accepts valid input', () => {
      const result = validateToolArgs('magnetlab_create_posting_slot', {
        day_of_week: 1,
        time: '09:00',
      })
      expect(result.success).toBe(true)
    })

    it('rejects day_of_week > 6', () => {
      const result = validateToolArgs('magnetlab_create_posting_slot', {
        day_of_week: 7,
        time: '09:00',
      })
      expect(result.success).toBe(false)
    })

    it('rejects day_of_week < 0', () => {
      const result = validateToolArgs('magnetlab_create_posting_slot', {
        day_of_week: -1,
        time: '09:00',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('magnetlab_extract_writing_style', () => {
    it('accepts valid LinkedIn URL', () => {
      const result = validateToolArgs('magnetlab_extract_writing_style', {
        linkedin_url: 'https://linkedin.com/in/someone',
      })
      expect(result.success).toBe(true)
    })

    it('rejects invalid URL', () => {
      const result = validateToolArgs('magnetlab_extract_writing_style', {
        linkedin_url: 'not-a-url',
      })
      expect(result.success).toBe(false)
    })
  })

  // ── Email System schemas ──────────────────────────────────

  describe('magnetlab_create_email_flow', () => {
    it('accepts valid input', () => {
      const result = validateToolArgs('magnetlab_create_email_flow', {
        name: 'Welcome Flow',
        trigger_type: 'lead_magnet',
      })
      expect(result.success).toBe(true)
    })

    it('rejects missing name', () => {
      const result = validateToolArgs('magnetlab_create_email_flow', {
        trigger_type: 'lead_magnet',
      })
      expect(result.success).toBe(false)
    })

    it('rejects invalid trigger_type', () => {
      const result = validateToolArgs('magnetlab_create_email_flow', {
        name: 'Test',
        trigger_type: 'auto',
      })
      expect(result.success).toBe(false)
    })

    it('rejects name longer than 200 chars', () => {
      const result = validateToolArgs('magnetlab_create_email_flow', {
        name: 'A'.repeat(201),
        trigger_type: 'manual',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('magnetlab_add_flow_step', () => {
    it('accepts valid input', () => {
      const result = validateToolArgs('magnetlab_add_flow_step', {
        flow_id: 'flow-1',
        step_number: 0,
        subject: 'Welcome!',
        body: '<p>Hello</p>',
        delay_days: 1,
      })
      expect(result.success).toBe(true)
    })

    it('rejects missing flow_id', () => {
      const result = validateToolArgs('magnetlab_add_flow_step', {
        step_number: 0,
        subject: 'Welcome!',
        body: '<p>Hello</p>',
        delay_days: 1,
      })
      expect(result.success).toBe(false)
    })

    it('rejects delay_days > 365', () => {
      const result = validateToolArgs('magnetlab_add_flow_step', {
        flow_id: 'flow-1',
        step_number: 0,
        subject: 'Welcome!',
        body: '<p>Hello</p>',
        delay_days: 366,
      })
      expect(result.success).toBe(false)
    })

    it('rejects negative step_number', () => {
      const result = validateToolArgs('magnetlab_add_flow_step', {
        flow_id: 'flow-1',
        step_number: -1,
        subject: 'Welcome!',
        body: '<p>Hello</p>',
        delay_days: 1,
      })
      expect(result.success).toBe(false)
    })
  })

  describe('magnetlab_add_subscriber', () => {
    it('accepts valid email', () => {
      const result = validateToolArgs('magnetlab_add_subscriber', {
        email: 'test@example.com',
      })
      expect(result.success).toBe(true)
    })

    it('rejects invalid email', () => {
      const result = validateToolArgs('magnetlab_add_subscriber', {
        email: 'not-an-email',
      })
      expect(result.success).toBe(false)
    })

    it('rejects missing email', () => {
      const result = validateToolArgs('magnetlab_add_subscriber', {})
      expect(result.success).toBe(false)
    })
  })

  describe('magnetlab_update_broadcast', () => {
    it('accepts valid id', () => {
      const result = validateToolArgs('magnetlab_update_broadcast', { id: 'bc-1' })
      expect(result.success).toBe(true)
    })

    it('rejects missing id', () => {
      const result = validateToolArgs('magnetlab_update_broadcast', {})
      expect(result.success).toBe(false)
    })
  })

  describe('magnetlab_send_broadcast', () => {
    it('accepts valid id', () => {
      const result = validateToolArgs('magnetlab_send_broadcast', { id: 'bc-1' })
      expect(result.success).toBe(true)
    })
  })

  describe('magnetlab_generate_flow_emails', () => {
    it('accepts valid flow_id', () => {
      const result = validateToolArgs('magnetlab_generate_flow_emails', { flow_id: 'flow-1' })
      expect(result.success).toBe(true)
    })

    it('rejects missing flow_id', () => {
      const result = validateToolArgs('magnetlab_generate_flow_emails', {})
      expect(result.success).toBe(false)
    })
  })

  // ── Brand Kit schemas ─────────────────────────────────────

  describe('magnetlab_extract_business_context', () => {
    it('accepts content with 50+ chars', () => {
      const result = validateToolArgs('magnetlab_extract_business_context', {
        content: 'A'.repeat(50),
      })
      expect(result.success).toBe(true)
    })

    it('rejects short content', () => {
      const result = validateToolArgs('magnetlab_extract_business_context', { content: 'short' })
      expect(result.success).toBe(false)
    })
  })

  // ── Swipe File schemas ────────────────────────────────────

  describe('magnetlab_submit_to_swipe_file', () => {
    it('accepts valid input', () => {
      const result = validateToolArgs('magnetlab_submit_to_swipe_file', {
        content: 'Great post about marketing',
        type: 'hook',
        niche: 'coaching',
      })
      expect(result.success).toBe(true)
    })

    it('rejects missing type', () => {
      const result = validateToolArgs('magnetlab_submit_to_swipe_file', {
        content: 'Great post',
        niche: 'coaching',
      })
      expect(result.success).toBe(false)
    })
  })

  // ── Library schemas ───────────────────────────────────────

  describe('magnetlab_create_library', () => {
    it('accepts valid name', () => {
      const result = validateToolArgs('magnetlab_create_library', { name: 'My Library' })
      expect(result.success).toBe(true)
    })

    it('rejects empty name', () => {
      const result = validateToolArgs('magnetlab_create_library', { name: '' })
      expect(result.success).toBe(false)
    })
  })

  describe('magnetlab_create_library_item', () => {
    it('accepts valid input', () => {
      const result = validateToolArgs('magnetlab_create_library_item', {
        library_id: 'lib-1',
        title: 'Item Title',
      })
      expect(result.success).toBe(true)
    })

    it('rejects missing title', () => {
      const result = validateToolArgs('magnetlab_create_library_item', { library_id: 'lib-1' })
      expect(result.success).toBe(false)
    })
  })

  // ── Qualification Form schemas ────────────────────────────

  describe('magnetlab_create_qualification_form', () => {
    it('accepts valid name', () => {
      const result = validateToolArgs('magnetlab_create_qualification_form', { name: 'Survey' })
      expect(result.success).toBe(true)
    })
  })

  describe('magnetlab_create_question', () => {
    it('accepts valid input', () => {
      const result = validateToolArgs('magnetlab_create_question', {
        form_id: 'form-1',
        question_text: 'What is your role?',
        question_type: 'single_choice',
      })
      expect(result.success).toBe(true)
    })

    it('rejects invalid question_type', () => {
      const result = validateToolArgs('magnetlab_create_question', {
        form_id: 'form-1',
        question_text: 'What is your role?',
        question_type: 'dropdown',
      })
      expect(result.success).toBe(false)
    })
  })

  // ── Comprehensive: every schema rejects empty object ──────

  describe('every schema rejects empty object when it has required fields', () => {
    const schemasWithRequired = Object.entries(toolSchemas).filter(([, schema]) => {
      const parsed = schema._def
      // Check if schema has required fields by testing empty object
      const result = schema.safeParse({})
      return !result.success
    })

    for (const [name] of schemasWithRequired) {
      it(`${name} rejects empty object`, () => {
        const result = validateToolArgs(name, {})
        expect(result.success).toBe(false)
      })
    }
  })
})
