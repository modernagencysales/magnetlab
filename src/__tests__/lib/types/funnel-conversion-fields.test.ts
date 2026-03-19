import {
  funnelPageFromRow,
  qualificationQuestionFromRow,
  type FunnelPageRow,
  type QualificationQuestionRow,
} from '@/lib/types/funnel';

describe('funnel conversion fields', () => {
  it('maps vsl/cta fields from row to FunnelPage', () => {
    const row = {
      id: 'fp1',
      lead_magnet_id: 'lm1',
      user_id: 'u1',
      slug: 'test',
      target_type: 'lead_magnet',
      library_id: null,
      external_resource_id: null,
      optin_headline: 'H',
      optin_subline: null,
      optin_button_text: 'Get',
      optin_social_proof: null,
      thankyou_headline: 'Thanks',
      thankyou_subline: null,
      vsl_url: null,
      calendly_url: null,
      qualification_pass_message: 'Pass',
      qualification_fail_message: 'Fail',
      redirect_trigger: 'none',
      redirect_url: null,
      redirect_fail_url: null,
      homepage_url: null,
      homepage_label: null,
      send_resource_email: true,
      thankyou_layout: 'video_first',
      theme: 'dark',
      primary_color: '#8b5cf6',
      background_style: 'solid',
      font_family: null,
      font_url: null,
      logo_url: null,
      qualification_form_id: null,
      is_published: true,
      published_at: null,
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
      vsl_headline: 'THE METHOD',
      vsl_subline: 'Watch this free training',
      cta_headline: 'Ready?',
      cta_button_text: 'BOOK NOW',
    } as FunnelPageRow;

    const result = funnelPageFromRow(row);
    expect(result.vslHeadline).toBe('THE METHOD');
    expect(result.vslSubline).toBe('Watch this free training');
    expect(result.ctaHeadline).toBe('Ready?');
    expect(result.ctaButtonText).toBe('BOOK NOW');
  });

  it('maps null vsl/cta fields correctly', () => {
    const row = {
      id: 'fp1',
      lead_magnet_id: 'lm1',
      user_id: 'u1',
      slug: 'test',
      target_type: 'lead_magnet',
      library_id: null,
      external_resource_id: null,
      optin_headline: 'H',
      optin_subline: null,
      optin_button_text: 'Get',
      optin_social_proof: null,
      thankyou_headline: 'Thanks',
      thankyou_subline: null,
      vsl_url: null,
      calendly_url: null,
      qualification_pass_message: 'Pass',
      qualification_fail_message: 'Fail',
      redirect_trigger: 'none',
      redirect_url: null,
      redirect_fail_url: null,
      homepage_url: null,
      homepage_label: null,
      send_resource_email: true,
      thankyou_layout: 'survey_first',
      theme: 'dark',
      primary_color: '#8b5cf6',
      background_style: 'solid',
      font_family: null,
      font_url: null,
      logo_url: null,
      qualification_form_id: null,
      is_published: true,
      published_at: null,
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
      vsl_headline: null,
      vsl_subline: null,
      cta_headline: null,
      cta_button_text: null,
    } as FunnelPageRow;

    const result = funnelPageFromRow(row);
    expect(result.vslHeadline).toBeNull();
    expect(result.ctaButtonText).toBeNull();
  });

  it('maps booking_prefill_key from question row', () => {
    const row = {
      id: 'q1',
      funnel_page_id: 'fp1',
      form_id: null,
      question_text: 'Monthly revenue?',
      question_order: 1,
      answer_type: 'multiple_choice',
      qualifying_answer: null,
      options: ['Under $10k', '$10k-$50k', '$50k+'],
      placeholder: null,
      is_qualifying: false,
      is_required: true,
      created_at: '2026-01-01',
      booking_prefill_key: 'monthlyrevenue',
    } as QualificationQuestionRow;

    const result = qualificationQuestionFromRow(row);
    expect(result.bookingPrefillKey).toBe('monthlyrevenue');
  });

  it('maps null booking_prefill_key', () => {
    const row = {
      id: 'q1',
      funnel_page_id: 'fp1',
      form_id: null,
      question_text: 'Are you an agency?',
      question_order: 1,
      answer_type: 'yes_no',
      qualifying_answer: 'yes',
      options: null,
      placeholder: null,
      is_qualifying: true,
      is_required: true,
      created_at: '2026-01-01',
      booking_prefill_key: null,
    } as QualificationQuestionRow;

    const result = qualificationQuestionFromRow(row);
    expect(result.bookingPrefillKey).toBeNull();
  });
});
