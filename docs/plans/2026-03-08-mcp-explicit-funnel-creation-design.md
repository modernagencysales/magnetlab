# MCP Explicit Funnel Creation Design

**Date:** 2026-03-08
**Branch:** early-users/experiments
**Status:** Approved

## Problem

1. **Disconnected workflow**: MCP `create_lead_magnet` creates a lead magnet but doesn't tell agents they need to also create a funnel to make it accessible. An agent could create a lead magnet and think it's done.
2. **Fabricated social proof**: `generateDefaultOptinContent()` returns `'Join thousands of professionals using this resource'` and `buildFunnelPage()` uses `'Built from real spreadsheet calculations'` — both are fabricated.
3. **Import auto-creates funnels**: The import flow (`importLeadMagnet`) silently creates a funnel with hardcoded defaults that agents can't customize.
4. **Undocumented defaults**: The `create_funnel` tool doesn't explain what defaults are used when fields are omitted.

## Design

### 1. Fix fabricated social proof

**`src/lib/ai/funnel-content-generator.ts`** — `generateDefaultOptinContent()`:
- Change `socialProof` from `'Join thousands of professionals using this resource'` to `null`

**`src/server/services/lead-magnets.service.ts`** — `buildFunnelPage()`:
- Change spreadsheet import social proof from `'Built from real spreadsheet calculations'` to `null`

### 2. Add `funnel_config` to MCP `create_lead_magnet`

Add an optional `funnel_config` object to the `magnetlab_create_lead_magnet` tool schema:

```typescript
funnel_config: {
  type: 'object',
  description: 'Optional. Creates a funnel page for this lead magnet in the same call. If omitted, no funnel is created — use magnetlab_create_funnel separately.',
  properties: {
    slug: { type: 'string', description: 'URL slug. Auto-generated from title if omitted.' },
    optin_headline: { type: 'string' },
    optin_subline: { type: 'string' },
    optin_button_text: { type: 'string' },
    optin_social_proof: { type: 'string', description: 'Social proof line. Null if omitted — do NOT fabricate.' },
    thankyou_headline: { type: 'string' },
    thankyou_subline: { type: 'string' },
    theme: { type: 'string', enum: ['light', 'dark'] },
    primary_color: { type: 'string' },
    background_style: { type: 'string', enum: ['solid', 'gradient', 'pattern'] },
    vsl_url: { type: 'string' },
    calendly_url: { type: 'string' },
    logo_url: { type: 'string' },
    qualification_form_id: { type: 'string' },
    publish: { type: 'boolean', description: 'Publish immediately after creation (default: false)' }
  }
}
```

**MCP handler flow** (in `handlers/lead-magnets.ts`):
1. Call `client.createLeadMagnet(params)` → get `leadMagnet`
2. If `funnel_config` provided:
   a. Generate slug from title if not provided
   b. Call `client.createFunnel({ lead_magnet_id: leadMagnet.id, ...funnel_config })`
   c. If `funnel_config.publish` is true, call `client.publishFunnel(funnel.id)`
3. Return combined result: `{ leadMagnet, funnel?, publishedUrl? }`

### 3. Update MCP tool descriptions

**`magnetlab_create_lead_magnet`**:
```
Create a new lead magnet. Choose an archetype and provide a title.

A lead magnet alone is not publicly accessible — you must also create a funnel page.
Two options:
1. Pass funnel_config here to create both in one call
2. Call magnetlab_create_funnel separately after creation

Without a funnel, the lead magnet exists only as a draft in the user's library.
```

**`magnetlab_create_funnel`** — add defaults documentation:
```
Create a new funnel/opt-in page. Must target a lead magnet, library, or external resource.

Defaults when fields are omitted:
- optin_headline: Lead magnet title
- optin_subline: null
- optin_button_text: "Get Free Access"
- optin_social_proof: null (do NOT fabricate — leave empty or use real data)
- thankyou_headline: "Thanks! Check your email."
- thankyou_subline: null
- theme: User's brand kit theme, or "dark"
- primary_color: User's brand kit color, or "#8b5cf6"
- background_style: User's brand kit style, or "solid"
```

### 4. Update guide workflow

Update the "Create & Publish" workflow in `category-tools.ts` to show both patterns.

## Files to Change

| File | Change |
|------|--------|
| `packages/mcp/src/tools/lead-magnets.ts` | Add `funnel_config` to schema, update description |
| `packages/mcp/src/tools/funnels.ts` | Update `create_funnel` description with defaults |
| `packages/mcp/src/handlers/lead-magnets.ts` | Handle `funnel_config` → create funnel + optional publish |
| `packages/mcp/src/client.ts` | No changes needed (already has `createFunnel` and `publishFunnel`) |
| `packages/mcp/src/tools/category-tools.ts` | Update guide workflow |
| `src/lib/ai/funnel-content-generator.ts` | Fix `generateDefaultOptinContent()` social proof → null |
| `src/server/services/lead-magnets.service.ts` | Fix `buildFunnelPage()` social proof → null |
| `packages/mcp/src/__tests__/` | Tests for new funnel_config flow |

## Not in Scope

- Changing the server-side API routes (composition stays in MCP layer)
- Changing the UI wizard flow
- Removing the import auto-funnel behavior (just fixing defaults)
