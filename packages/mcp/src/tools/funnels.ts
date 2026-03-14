import { Tool } from '@modelcontextprotocol/sdk/types.js'

export const funnelTools: Tool[] = [
  {
    name: 'magnetlab_list_funnels',
    description:
      'List all funnel pages for the current user. Returns funnel ID, slug, headline, theme, publish status, and target (lead magnet, library, or external resource).',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'magnetlab_get_funnel',
    description:
      'Get full details of a funnel page including all opt-in and thank-you copy, theme settings, qualification form, and publish status.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Funnel page UUID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'magnetlab_get_funnel_by_target',
    description:
      'Find the funnel page associated with a specific lead magnet, library, or external resource. Useful to check if a funnel already exists before creating one.',
    inputSchema: {
      type: 'object',
      properties: {
        lead_magnet_id: { type: 'string', description: 'Lead magnet UUID (for lead_magnet target)' },
        library_id: { type: 'string', description: 'Library UUID (for library target)' },
        external_resource_id: {
          type: 'string',
          description: 'External resource UUID (for external_resource target)',
        },
      },
    },
  },
  {
    name: 'magnetlab_create_funnel',
    description:
      'Create a new funnel/opt-in page. Must target a lead magnet, library, or external resource. Provide a slug (URL-safe name) and optionally customize headline, subline, button text, thank-you copy, theme (light/dark), colors, and VSL/Calendly URLs.',
    inputSchema: {
      type: 'object',
      properties: {
        lead_magnet_id: { type: 'string', description: 'Lead magnet UUID (for lead_magnet target)' },
        library_id: { type: 'string', description: 'Library UUID (for library target)' },
        external_resource_id: {
          type: 'string',
          description: 'External resource UUID (for external_resource target)',
        },
        target_type: {
          type: 'string',
          enum: ['lead_magnet', 'library', 'external_resource'],
          description: 'What this funnel delivers (defaults based on which ID is provided)',
        },
        slug: { type: 'string', description: 'URL slug (e.g. "my-free-guide")' },
        optin_headline: { type: 'string', description: 'Main headline on opt-in page' },
        optin_subline: { type: 'string', description: 'Subheadline text' },
        optin_button_text: {
          type: 'string',
          description: 'CTA button text (default: "Get Free Access")',
        },
        optin_social_proof: { type: 'string', description: 'Social proof line (e.g. "500+ downloads")' },
        thankyou_headline: {
          type: 'string',
          description: 'Thank you page headline (default: "Thanks! Check your email.")',
        },
        thankyou_subline: { type: 'string', description: 'Thank you page subheadline' },
        vsl_url: { type: 'string', description: 'Video URL to embed on thank-you page' },
        calendly_url: { type: 'string', description: 'Calendly URL for booking on thank-you page' },
        theme: { type: 'string', enum: ['light', 'dark'], description: 'Page theme (default: dark)' },
        primary_color: { type: 'string', description: 'Primary accent color hex (default: #8b5cf6)' },
        background_style: {
          type: 'string',
          enum: ['solid', 'gradient', 'pattern'],
          description: 'Background style',
        },
        logo_url: { type: 'string', description: 'Logo image URL' },
        qualification_form_id: {
          type: 'string',
          description: 'Qualification form UUID to attach (filters leads)',
        },
      },
      required: ['slug'],
    },
  },
  {
    name: 'magnetlab_update_funnel',
    description:
      'Update an existing funnel page. Change copy, theme, colors, URLs, or qualification form. Only provided fields are updated.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Funnel page UUID' },
        slug: { type: 'string', description: 'New URL slug' },
        optin_headline: { type: 'string' },
        optin_subline: { type: 'string' },
        optin_button_text: { type: 'string' },
        optin_social_proof: { type: 'string' },
        thankyou_headline: { type: 'string' },
        thankyou_subline: { type: 'string' },
        vsl_url: { type: 'string' },
        calendly_url: { type: 'string' },
        theme: { type: 'string', enum: ['light', 'dark'] },
        primary_color: { type: 'string' },
        background_style: { type: 'string', enum: ['solid', 'gradient', 'pattern'] },
        logo_url: { type: 'string' },
        qualification_form_id: { type: ['string', 'null'] },
        qualification_pass_message: { type: ['string', 'null'], description: 'Message shown to qualified leads' },
        qualification_fail_message: { type: ['string', 'null'], description: 'Message shown to unqualified leads' },
        redirect_trigger: { type: 'string', enum: ['none', 'immediate', 'after_qualification'], description: 'When to redirect after opt-in' },
        redirect_url: { type: ['string', 'null'], description: 'URL to redirect qualified leads to' },
        redirect_fail_url: { type: ['string', 'null'], description: 'URL to redirect unqualified leads to' },
        homepage_url: { type: ['string', 'null'], description: 'Homepage URL link' },
        homepage_label: { type: ['string', 'null'], description: 'Homepage link label text' },
        send_resource_email: { type: 'boolean', description: 'Whether to auto-send resource delivery email on opt-in' },
      },
      required: ['id'],
    },
  },
  {
    name: 'magnetlab_delete_funnel',
    description:
      'Delete a funnel page and all associated leads, page views, and qualification questions. This is permanent.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Funnel page UUID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'magnetlab_publish_funnel',
    description:
      'Publish a funnel page to make it publicly accessible. Returns the live URL (e.g. /p/username/slug). Requires the user to have a username set. Auto-polishes lead magnet content on first publish.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Funnel page UUID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'magnetlab_unpublish_funnel',
    description: 'Take a funnel page offline. The URL will no longer be accessible.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Funnel page UUID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'magnetlab_generate_funnel_content',
    description:
      'Auto-generate opt-in page copy (headline, subline, button text) based on the lead magnet content using AI.',
    inputSchema: {
      type: 'object',
      properties: {
        lead_magnet_id: { type: 'string', description: 'Lead magnet UUID to generate funnel copy for' },
      },
      required: ['lead_magnet_id'],
    },
  },
]
