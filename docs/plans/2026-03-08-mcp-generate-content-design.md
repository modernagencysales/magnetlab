# MCP Generate Lead Magnet Content Tool — Design

**Date:** 2026-03-08
**Branch:** early-users/experiments
**Status:** Approved

## Problem

After calling `create_lead_magnet`, the content fields (`extracted_content`, `polished_content`) are null. The existing MCP tools (`magnetlab_extract_content`, `magnetlab_generate_content`) require Q&A answers — there's no one-call tool to generate content from the concept alone.

The server-side route `POST /api/lead-magnet/{id}/generate-content` already does everything needed, but has no MCP client method or tool wired to it.

## Design

Wire up the existing route with a new MCP tool.

**New tool:** `magnetlab_generate_lead_magnet_content`
- **Param:** `lead_magnet_id` (required)
- **Calls:** `POST /api/lead-magnet/{id}/generate-content` (120s AI timeout)
- **Server does:** Read concept → pull AI Brain knowledge → generate `extracted_content` → polish to `polished_content` → save both
- **Returns:** `{ extractedContent, polishedContent, polishedAt }`
- **Requires:** Lead magnet must have a `concept` set

## Files to Change

| File | Change |
|------|--------|
| `packages/mcp/src/client.ts` | Add `generateLeadMagnetContent(id)` method |
| `packages/mcp/src/tools/lead-magnets.ts` | Add tool definition |
| `packages/mcp/src/handlers/lead-magnets.ts` | Add handler case |
| `packages/mcp/src/tools/category-tools.ts` | Update create_lead_magnet workflow |
| `packages/mcp/src/__tests__/handlers/lead-magnets.test.ts` | Add test case |

## Not in Scope

- `tone`, `length`, `use_brain`, `knowledge_entry_ids` parameters (deferred to brain work)
- Background job approach (prototype is fine with sync 120s timeout)
- Changes to server-side route or service
