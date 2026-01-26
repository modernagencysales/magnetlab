import {
  funnelPageFromRow,
  qualificationQuestionFromRow,
  funnelLeadFromRow,
  webhookConfigFromRow,
  type FunnelPageRow,
  type QualificationQuestionRow,
  type FunnelLeadRow,
  type WebhookConfigRow,
} from '@/lib/types/funnel';

describe('Funnel Type Conversions', () => {
  describe('funnelPageFromRow', () => {
    const mockRow: FunnelPageRow = {
      id: 'funnel-123',
      lead_magnet_id: 'lm-456',
      user_id: 'user-789',
      slug: 'my-funnel',
      optin_headline: 'Get Your Free Guide',
      optin_subline: 'Download now',
      optin_button_text: 'Get Access',
      optin_social_proof: '1000+ downloads',
      thankyou_headline: 'Thanks!',
      thankyou_subline: 'Check your email',
      vsl_url: 'https://youtube.com/watch?v=123',
      calendly_url: 'https://calendly.com/user/30min',
      qualification_pass_message: 'Great fit!',
      qualification_fail_message: 'Not a fit right now',
      is_published: true,
      published_at: '2025-01-26T00:00:00Z',
      created_at: '2025-01-25T00:00:00Z',
      updated_at: '2025-01-26T00:00:00Z',
    };

    it('should convert snake_case row to camelCase object', () => {
      const result = funnelPageFromRow(mockRow);

      expect(result).toEqual({
        id: 'funnel-123',
        leadMagnetId: 'lm-456',
        userId: 'user-789',
        slug: 'my-funnel',
        optinHeadline: 'Get Your Free Guide',
        optinSubline: 'Download now',
        optinButtonText: 'Get Access',
        optinSocialProof: '1000+ downloads',
        thankyouHeadline: 'Thanks!',
        thankyouSubline: 'Check your email',
        vslUrl: 'https://youtube.com/watch?v=123',
        calendlyUrl: 'https://calendly.com/user/30min',
        qualificationPassMessage: 'Great fit!',
        qualificationFailMessage: 'Not a fit right now',
        isPublished: true,
        publishedAt: '2025-01-26T00:00:00Z',
        createdAt: '2025-01-25T00:00:00Z',
        updatedAt: '2025-01-26T00:00:00Z',
      });
    });

    it('should handle null optional fields', () => {
      const rowWithNulls: FunnelPageRow = {
        ...mockRow,
        optin_subline: null,
        optin_social_proof: null,
        thankyou_subline: null,
        vsl_url: null,
        calendly_url: null,
        published_at: null,
      };

      const result = funnelPageFromRow(rowWithNulls);

      expect(result.optinSubline).toBeNull();
      expect(result.optinSocialProof).toBeNull();
      expect(result.thankyouSubline).toBeNull();
      expect(result.vslUrl).toBeNull();
      expect(result.calendlyUrl).toBeNull();
      expect(result.publishedAt).toBeNull();
    });
  });

  describe('qualificationQuestionFromRow', () => {
    const mockRow: QualificationQuestionRow = {
      id: 'q-123',
      funnel_page_id: 'funnel-456',
      question_text: 'Do you have a team?',
      question_order: 0,
      qualifying_answer: 'yes',
      created_at: '2025-01-25T00:00:00Z',
    };

    it('should convert snake_case row to camelCase object', () => {
      const result = qualificationQuestionFromRow(mockRow);

      expect(result).toEqual({
        id: 'q-123',
        funnelPageId: 'funnel-456',
        questionText: 'Do you have a team?',
        questionOrder: 0,
        qualifyingAnswer: 'yes',
        createdAt: '2025-01-25T00:00:00Z',
      });
    });

    it('should preserve qualifyingAnswer as "yes" or "no"', () => {
      const yesRow: QualificationQuestionRow = { ...mockRow, qualifying_answer: 'yes' };
      const noRow: QualificationQuestionRow = { ...mockRow, qualifying_answer: 'no' };

      expect(qualificationQuestionFromRow(yesRow).qualifyingAnswer).toBe('yes');
      expect(qualificationQuestionFromRow(noRow).qualifyingAnswer).toBe('no');
    });
  });

  describe('funnelLeadFromRow', () => {
    const mockRow: FunnelLeadRow = {
      id: 'lead-123',
      funnel_page_id: 'funnel-456',
      lead_magnet_id: 'lm-789',
      user_id: 'user-abc',
      email: 'lead@example.com',
      name: 'John Doe',
      qualification_answers: { 'q-1': 'yes', 'q-2': 'no' },
      is_qualified: true,
      utm_source: 'linkedin',
      utm_medium: 'social',
      utm_campaign: 'launch',
      created_at: '2025-01-26T00:00:00Z',
    };

    it('should convert snake_case row to camelCase object', () => {
      const result = funnelLeadFromRow(mockRow);

      expect(result).toEqual({
        id: 'lead-123',
        funnelPageId: 'funnel-456',
        leadMagnetId: 'lm-789',
        userId: 'user-abc',
        email: 'lead@example.com',
        name: 'John Doe',
        qualificationAnswers: { 'q-1': 'yes', 'q-2': 'no' },
        isQualified: true,
        utmSource: 'linkedin',
        utmMedium: 'social',
        utmCampaign: 'launch',
        createdAt: '2025-01-26T00:00:00Z',
      });
    });

    it('should handle null optional fields', () => {
      const rowWithNulls: FunnelLeadRow = {
        ...mockRow,
        name: null,
        qualification_answers: null,
        is_qualified: null,
        utm_source: null,
        utm_medium: null,
        utm_campaign: null,
      };

      const result = funnelLeadFromRow(rowWithNulls);

      expect(result.name).toBeNull();
      expect(result.qualificationAnswers).toBeNull();
      expect(result.isQualified).toBeNull();
      expect(result.utmSource).toBeNull();
      expect(result.utmMedium).toBeNull();
      expect(result.utmCampaign).toBeNull();
    });
  });

  describe('webhookConfigFromRow', () => {
    const mockRow: WebhookConfigRow = {
      id: 'webhook-123',
      user_id: 'user-456',
      name: 'My CRM Webhook',
      url: 'https://example.com/webhook',
      is_active: true,
      created_at: '2025-01-25T00:00:00Z',
      updated_at: '2025-01-26T00:00:00Z',
    };

    it('should convert snake_case row to camelCase object', () => {
      const result = webhookConfigFromRow(mockRow);

      expect(result).toEqual({
        id: 'webhook-123',
        userId: 'user-456',
        name: 'My CRM Webhook',
        url: 'https://example.com/webhook',
        isActive: true,
        createdAt: '2025-01-25T00:00:00Z',
        updatedAt: '2025-01-26T00:00:00Z',
      });
    });

    it('should handle inactive webhooks', () => {
      const inactiveRow: WebhookConfigRow = { ...mockRow, is_active: false };
      const result = webhookConfigFromRow(inactiveRow);

      expect(result.isActive).toBe(false);
    });
  });
});
