import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MagnetLabClient } from '../client.js'
import { handleToolCall } from '../handlers/index.js'

// Create a mock client with all methods stubbed
function createMockClient(): MagnetLabClient {
  const client = new MagnetLabClient('test-key')

  // Stub every public method to return a mock response
  const methodNames = Object.getOwnPropertyNames(MagnetLabClient.prototype).filter(
    (n) => n !== 'constructor' && n !== 'request'
  )
  for (const method of methodNames) {
    ;(client as unknown as Record<string, unknown>)[method] = vi.fn().mockResolvedValue({
      mocked: true,
      method,
    })
  }

  return client
}

describe('Handler Routing & Arg Transformation', () => {
  let client: MagnetLabClient

  beforeEach(() => {
    client = createMockClient()
  })

  // Helper to extract the ToolResult text as parsed JSON
  async function callTool(name: string, args: Record<string, unknown>) {
    const result = await handleToolCall(name, args, client)
    expect(result.content).toHaveLength(1)
    expect(result.content[0].type).toBe('text')
    return JSON.parse(result.content[0].text)
  }

  // ── Email System (critical — the bug fix) ─────────────────

  describe('Email System — snake_case passthrough', () => {
    it('magnetlab_create_email_flow passes snake_case params', async () => {
      await callTool('magnetlab_create_email_flow', {
        name: 'Welcome',
        trigger_type: 'lead_magnet',
        description: 'Welcome flow',
        trigger_lead_magnet_id: 'lm-1',
      })

      expect(client.createEmailFlow).toHaveBeenCalledWith({
        name: 'Welcome',
        trigger_type: 'lead_magnet',
        description: 'Welcome flow',
        trigger_lead_magnet_id: 'lm-1',
      })
    })

    it('magnetlab_update_email_flow passes snake_case params', async () => {
      await callTool('magnetlab_update_email_flow', {
        id: 'flow-1',
        name: 'Updated',
        trigger_type: 'manual',
        trigger_lead_magnet_id: 'lm-2',
        status: 'active',
      })

      expect(client.updateEmailFlow).toHaveBeenCalledWith('flow-1', {
        name: 'Updated',
        trigger_type: 'manual',
        trigger_lead_magnet_id: 'lm-2',
        status: 'active',
      })
    })

    it('magnetlab_update_email_flow omits undefined params', async () => {
      await callTool('magnetlab_update_email_flow', {
        id: 'flow-1',
        name: 'Only Name',
      })

      expect(client.updateEmailFlow).toHaveBeenCalledWith('flow-1', {
        name: 'Only Name',
      })
    })

    it('magnetlab_add_flow_step passes snake_case params', async () => {
      await callTool('magnetlab_add_flow_step', {
        flow_id: 'flow-1',
        step_number: 2,
        subject: 'Day 3',
        body: '<p>Follow up</p>',
        delay_days: 3,
      })

      expect(client.addFlowStep).toHaveBeenCalledWith('flow-1', {
        step_number: 2,
        subject: 'Day 3',
        body: '<p>Follow up</p>',
        delay_days: 3,
      })
    })

    it('magnetlab_generate_flow_emails passes flow_id and optional step_count', async () => {
      await callTool('magnetlab_generate_flow_emails', {
        flow_id: 'flow-1',
        step_count: 7,
      })

      expect(client.generateFlowEmails).toHaveBeenCalledWith('flow-1', 7)
    })

    it('magnetlab_update_broadcast passes snake_case audience_filter', async () => {
      await callTool('magnetlab_update_broadcast', {
        id: 'bc-1',
        subject: 'New Subject',
        audience_filter: { engagement: 'opened_30d' },
      })

      expect(client.updateBroadcast).toHaveBeenCalledWith('bc-1', {
        subject: 'New Subject',
        audience_filter: { engagement: 'opened_30d' },
      })
    })

    it('magnetlab_add_subscriber passes snake_case name fields', async () => {
      await callTool('magnetlab_add_subscriber', {
        email: 'test@example.com',
        first_name: 'John',
        last_name: 'Doe',
      })

      expect(client.addSubscriber).toHaveBeenCalledWith({
        email: 'test@example.com',
        first_name: 'John',
        last_name: 'Doe',
      })
    })

    it('magnetlab_list_email_flows calls client method', async () => {
      await callTool('magnetlab_list_email_flows', {})
      expect(client.listEmailFlows).toHaveBeenCalled()
    })

    it('magnetlab_get_email_flow passes id', async () => {
      await callTool('magnetlab_get_email_flow', { id: 'flow-1' })
      expect(client.getEmailFlow).toHaveBeenCalledWith('flow-1')
    })

    it('magnetlab_delete_email_flow passes id', async () => {
      await callTool('magnetlab_delete_email_flow', { id: 'flow-1' })
      expect(client.deleteEmailFlow).toHaveBeenCalledWith('flow-1')
    })

    it('magnetlab_list_broadcasts calls client method', async () => {
      await callTool('magnetlab_list_broadcasts', {})
      expect(client.listBroadcasts).toHaveBeenCalled()
    })

    it('magnetlab_get_broadcast passes id', async () => {
      await callTool('magnetlab_get_broadcast', { id: 'bc-1' })
      expect(client.getBroadcast).toHaveBeenCalledWith('bc-1')
    })

    it('magnetlab_create_broadcast passes params', async () => {
      await callTool('magnetlab_create_broadcast', {
        subject: 'Launch!',
        body: '<p>Big news</p>',
      })
      expect(client.createBroadcast).toHaveBeenCalledWith({
        subject: 'Launch!',
        body: '<p>Big news</p>',
      })
    })

    it('magnetlab_send_broadcast passes id', async () => {
      await callTool('magnetlab_send_broadcast', { id: 'bc-1' })
      expect(client.sendBroadcast).toHaveBeenCalledWith('bc-1')
    })

    it('magnetlab_list_subscribers passes filter params', async () => {
      await callTool('magnetlab_list_subscribers', {
        search: 'john',
        status: 'active',
        page: 2,
        limit: 25,
      })
      expect(client.listSubscribers).toHaveBeenCalledWith({
        search: 'john',
        status: 'active',
        source: undefined,
        page: 2,
        limit: 25,
      })
    })

    it('magnetlab_unsubscribe passes id', async () => {
      await callTool('magnetlab_unsubscribe', { id: 'sub-1' })
      expect(client.unsubscribeSubscriber).toHaveBeenCalledWith('sub-1')
    })
  })

  // ── Email Sequences ───────────────────────────────────────

  describe('Email Sequences — camelCase transforms', () => {
    it('magnetlab_get_email_sequence passes lead_magnet_id', async () => {
      await callTool('magnetlab_get_email_sequence', { lead_magnet_id: 'lm-1' })
      expect(client.getEmailSequence).toHaveBeenCalledWith('lm-1')
    })

    it('magnetlab_generate_email_sequence transforms to camelCase', async () => {
      await callTool('magnetlab_generate_email_sequence', {
        lead_magnet_id: 'lm-1',
        use_ai: true,
      })
      expect(client.generateEmailSequence).toHaveBeenCalledWith({
        leadMagnetId: 'lm-1',
        useAI: true,
      })
    })

    it('magnetlab_update_email_sequence transforms reply_trigger', async () => {
      await callTool('magnetlab_update_email_sequence', {
        lead_magnet_id: 'lm-1',
        emails: [
          { day: 1, subject: 'Hi', body: 'Hello', reply_trigger: 'welcome' },
        ],
        status: 'active',
      })
      expect(client.updateEmailSequence).toHaveBeenCalledWith('lm-1', {
        emails: [
          { day: 1, subject: 'Hi', body: 'Hello', replyTrigger: 'welcome' },
        ],
        status: 'active',
      })
    })

    it('magnetlab_activate_email_sequence passes lead_magnet_id', async () => {
      await callTool('magnetlab_activate_email_sequence', { lead_magnet_id: 'lm-1' })
      expect(client.activateEmailSequence).toHaveBeenCalledWith('lm-1')
    })
  })

  // ── Funnels ───────────────────────────────────────────────

  describe('Funnels — camelCase transforms', () => {
    it('magnetlab_create_funnel transforms snake_case to camelCase', async () => {
      await callTool('magnetlab_create_funnel', {
        slug: 'my-funnel',
        lead_magnet_id: 'lm-1',
        optin_headline: 'Get it now',
        primary_color: '#8b5cf6',
        background_style: 'gradient',
      })
      expect(client.createFunnel).toHaveBeenCalledWith({
        slug: 'my-funnel',
        leadMagnetId: 'lm-1',
        libraryId: undefined,
        externalResourceId: undefined,
        targetType: undefined,
        optinHeadline: 'Get it now',
        optinSubline: undefined,
        optinButtonText: undefined,
        optinSocialProof: undefined,
        thankyouHeadline: undefined,
        thankyouSubline: undefined,
        vslUrl: undefined,
        calendlyUrl: undefined,
        theme: undefined,
        primaryColor: '#8b5cf6',
        backgroundStyle: 'gradient',
        logoUrl: undefined,
        qualificationFormId: undefined,
      })
    })

    it('magnetlab_update_funnel transforms snake_case to camelCase', async () => {
      await callTool('magnetlab_update_funnel', {
        id: 'funnel-1',
        optin_headline: 'Updated headline',
      })
      expect(client.updateFunnel).toHaveBeenCalledWith(
        'funnel-1',
        expect.objectContaining({
          optinHeadline: 'Updated headline',
        })
      )
    })

    it('magnetlab_list_funnels calls client', async () => {
      await callTool('magnetlab_list_funnels', {})
      expect(client.listFunnels).toHaveBeenCalled()
    })

    it('magnetlab_publish_funnel passes id', async () => {
      await callTool('magnetlab_publish_funnel', { id: 'funnel-1' })
      expect(client.publishFunnel).toHaveBeenCalledWith('funnel-1')
    })

    it('magnetlab_delete_funnel passes id', async () => {
      await callTool('magnetlab_delete_funnel', { id: 'funnel-1' })
      expect(client.deleteFunnel).toHaveBeenCalledWith('funnel-1')
    })

    it('magnetlab_generate_funnel_content transforms lead_magnet_id', async () => {
      await callTool('magnetlab_generate_funnel_content', { lead_magnet_id: 'lm-1' })
      expect(client.generateFunnelContent).toHaveBeenCalledWith({ leadMagnetId: 'lm-1' })
    })
  })

  // ── Lead Magnets ──────────────────────────────────────────

  describe('Lead Magnets', () => {
    it('magnetlab_list_lead_magnets passes filter params', async () => {
      await callTool('magnetlab_list_lead_magnets', { status: 'published', limit: 10 })
      expect(client.listLeadMagnets).toHaveBeenCalledWith({
        status: 'published',
        limit: 10,
        offset: undefined,
      })
    })

    it('magnetlab_get_lead_magnet passes id', async () => {
      await callTool('magnetlab_get_lead_magnet', { id: 'lm-1' })
      expect(client.getLeadMagnet).toHaveBeenCalledWith('lm-1')
    })

    it('magnetlab_create_lead_magnet passes params', async () => {
      await callTool('magnetlab_create_lead_magnet', {
        title: 'My Lead Magnet',
        archetype: 'single-breakdown',
      })
      expect(client.createLeadMagnet).toHaveBeenCalledWith({
        title: 'My Lead Magnet',
        archetype: 'single-breakdown',
        concept: undefined,
      })
    })

    it('magnetlab_delete_lead_magnet passes id', async () => {
      await callTool('magnetlab_delete_lead_magnet', { id: 'lm-1' })
      expect(client.deleteLeadMagnet).toHaveBeenCalledWith('lm-1')
    })

    it('magnetlab_get_lead_magnet_stats passes lead_magnet_id', async () => {
      await callTool('magnetlab_get_lead_magnet_stats', { lead_magnet_id: 'lm-1' })
      expect(client.getLeadMagnetStats).toHaveBeenCalledWith('lm-1')
    })
  })

  // ── Content Pipeline ──────────────────────────────────────

  describe('Content Pipeline (representative)', () => {
    it('magnetlab_submit_transcript passes params', async () => {
      await callTool('magnetlab_submit_transcript', {
        transcript: 'A'.repeat(100),
        title: 'Call Recording',
      })
      expect(client.submitTranscript).toHaveBeenCalledWith({
        transcript: 'A'.repeat(100),
        title: 'Call Recording',
      })
    })

    it('magnetlab_schedule_post transforms to camelCase', async () => {
      await callTool('magnetlab_schedule_post', {
        post_id: 'post-1',
        scheduled_time: '2026-03-01T10:00:00Z',
      })
      expect(client.schedulePost).toHaveBeenCalledWith({
        postId: 'post-1',
        scheduledTime: '2026-03-01T10:00:00Z',
      })
    })

    it('magnetlab_create_posting_slot transforms day_of_week', async () => {
      await callTool('magnetlab_create_posting_slot', {
        day_of_week: 3,
        time: '14:00',
      })
      expect(client.createPostingSlot).toHaveBeenCalledWith({
        dayOfWeek: 3,
        time: '14:00',
      })
    })

    it('magnetlab_extract_writing_style transforms linkedin_url', async () => {
      await callTool('magnetlab_extract_writing_style', {
        linkedin_url: 'https://linkedin.com/in/someone',
      })
      expect(client.extractWritingStyle).toHaveBeenCalledWith({
        linkedinUrl: 'https://linkedin.com/in/someone',
      })
    })

    it('magnetlab_update_idea_status passes correct args', async () => {
      await callTool('magnetlab_update_idea_status', {
        idea_id: 'idea-1',
        status: 'selected',
      })
      expect(client.updateIdeaStatus).toHaveBeenCalledWith('idea-1', 'selected')
    })

    it('magnetlab_get_posts_by_date_range transforms to camelCase', async () => {
      await callTool('magnetlab_get_posts_by_date_range', {
        start_date: '2026-01-01',
        end_date: '2026-01-31',
      })
      expect(client.getPostsByDateRange).toHaveBeenCalledWith({
        startDate: '2026-01-01',
        endDate: '2026-01-31',
      })
    })

    it('magnetlab_trigger_autopilot transforms params', async () => {
      await callTool('magnetlab_trigger_autopilot', {
        posts_per_batch: 5,
        buffer_target: 10,
        auto_publish: true,
      })
      expect(client.triggerAutopilot).toHaveBeenCalledWith({
        postsPerBatch: 5,
        bufferTarget: 10,
        autoPublish: true,
      })
    })
  })

  // ── Other categories (at least 1 per) ─────────────────────

  describe('Analytics', () => {
    it('magnetlab_get_funnel_stats calls client', async () => {
      await callTool('magnetlab_get_funnel_stats', {})
      expect(client.getFunnelStats).toHaveBeenCalled()
    })
  })

  describe('Brand Kit', () => {
    it('magnetlab_get_brand_kit calls client', async () => {
      await callTool('magnetlab_get_brand_kit', {})
      expect(client.getBrandKit).toHaveBeenCalled()
    })

    it('magnetlab_extract_business_context passes content', async () => {
      await callTool('magnetlab_extract_business_context', {
        content: 'A'.repeat(50),
      })
      expect(client.extractBusinessContext).toHaveBeenCalledWith({
        content: 'A'.repeat(50),
        contentType: undefined,
      })
    })
  })

  describe('Leads', () => {
    it('magnetlab_list_leads passes filter params', async () => {
      await callTool('magnetlab_list_leads', { search: 'john', limit: 20 })
      expect(client.listLeads).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'john', limit: 20 })
      )
    })
  })

  describe('Swipe File', () => {
    it('magnetlab_submit_to_swipe_file passes params', async () => {
      await callTool('magnetlab_submit_to_swipe_file', {
        content: 'Great hook',
        type: 'hook',
        niche: 'coaching',
      })
      expect(client.submitToSwipeFile).toHaveBeenCalledWith({
        content: 'Great hook',
        type: 'hook',
        niche: 'coaching',
      })
    })
  })

  describe('Libraries', () => {
    it('magnetlab_create_library passes name', async () => {
      await callTool('magnetlab_create_library', { name: 'My Lib' })
      expect(client.createLibrary).toHaveBeenCalledWith({
        name: 'My Lib',
        description: undefined,
      })
    })
  })

  describe('Qualification Forms', () => {
    it('magnetlab_create_qualification_form passes name', async () => {
      await callTool('magnetlab_create_qualification_form', { name: 'Survey' })
      expect(client.createQualificationForm).toHaveBeenCalledWith({ name: 'Survey' })
    })
  })

  // ── Error handling ────────────────────────────────────────

  describe('Error handling', () => {
    it('unknown tool returns error', async () => {
      const result = await callTool('magnetlab_nonexistent_tool', {})
      expect(result.error).toMatch(/Unknown tool/)
    })

    it('validation failure returns error', async () => {
      const result = await callTool('magnetlab_add_subscriber', {})
      expect(result.error).toBeTruthy()
    })

    it('client method error is caught and returned', async () => {
      ;(client.listEmailFlows as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Network error')
      )
      const result = await callTool('magnetlab_list_email_flows', {})
      expect(result.error).toBe('Network error')
    })
  })

  // ── Response format ───────────────────────────────────────

  describe('Response format', () => {
    it('wraps result in content array with text type', async () => {
      const result = await handleToolCall('magnetlab_list_email_flows', {}, client)
      expect(result.content).toHaveLength(1)
      expect(result.content[0].type).toBe('text')
      expect(typeof result.content[0].text).toBe('string')

      // Should be valid JSON
      const parsed = JSON.parse(result.content[0].text)
      expect(parsed).toBeDefined()
    })
  })
})
