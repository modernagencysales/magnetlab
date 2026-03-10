# Email Sequence State Machine Clarity — Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make email sequence activation state machine explicit in MCP tool descriptions, add placeholder validation on activate, and warn when publishing a funnel with a draft sequence.

**Architecture:** Updates to 4 tool descriptions, handler-level placeholder validation, publish-funnel warning injection, and workflow recipe updates. No new tools — just better descriptions and guardrails.

**Tech Stack:** TypeScript, MCP SDK, Vitest

---

## State Machine

```
generate_email_sequence → draft (AI or template emails created, NOT sending)
update_email_sequence → draft (any edit resets to draft)
activate_email_sequence → active (emails sent to new opt-ins automatically)
synced → legacy Loops.so status, treat as draft
```

Emails are ONLY sent when:
1. Sequence status is `active`
2. A new lead opts into the associated funnel

Publishing a funnel does NOT activate the sequence.

## Changes

### 1. Tool Description Updates (4 tools in email-sequences.ts)

- `magnetlab_get_email_sequence` — document status field meanings
- `magnetlab_generate_email_sequence` — explain draft state, template fallback risk
- `magnetlab_update_email_sequence` — explain draft reset, review before activating
- `magnetlab_activate_email_sequence` — explain draft→active transition, placeholder validation

### 2. Placeholder Validation (handler: email-sequences.ts)

Before calling `client.activateEmailSequence()`:
- Fetch sequence via `client.getEmailSequence()`
- Scan subjects + bodies for pattern: `/\[[A-Z][A-Z _]*\]/` (ALL-CAPS bracketed text)
- Known placeholders: `[INSERT TIP]`, `[Resource 1]`, `[YOUR NAME]`, `[PLACEHOLDER]`, `[TODO]`
- If found: throw descriptive error listing which emails and which placeholders
- If no sequence exists: throw error

### 3. Publish Funnel Warning (handler: funnels.ts)

After successful `publishFunnel()`:
- Attempt to find email sequence for the funnel's lead magnet
- If sequence exists with status `draft`: append warning to response
- If no sequence: no warning (not all funnels need sequences)
- Warning is informational, does not block publish

Challenge: `publishFunnel` takes a funnel ID, not a lead magnet ID. The handler needs to get the funnel first to find its lead magnet, OR we accept that we can't do this lookup cheaply. **Decision**: Try to get the funnel details from the publish response (it returns the funnel object which should have the target ID). If the response doesn't include it, skip the warning rather than making an extra API call.

### 4. Workflow Recipe Updates (category-tools.ts)

- `create_lead_magnet` recipe: add email sequence step
- `setup_funnel` recipe: already has email sequence step, add activation reminder

### 5. Update status enum documentation

- Remove `synced` from the enum in `update_email_sequence` tool schema (or document as deprecated)
- Keep accepting it in the handler for backwards compatibility

---

### Task 1: Update email sequence tool descriptions

**Files:**
- Modify: `packages/mcp/src/tools/email-sequences.ts`

Update all 4 tool descriptions with state machine documentation.

### Task 2: Add placeholder validation to activate handler

**Files:**
- Modify: `packages/mcp/src/handlers/email-sequences.ts`

Add validation logic before activation call.

### Task 3: Add publish funnel warning

**Files:**
- Modify: `packages/mcp/src/handlers/funnels.ts`

After publish, check for draft sequence and append warning.

### Task 4: Update workflow recipes

**Files:**
- Modify: `packages/mcp/src/tools/category-tools.ts`

Add email sequence activation steps to recipes.

### Task 5: Write tests

**Files:**
- Create: `packages/mcp/src/__tests__/handlers/email-sequences.test.ts`

Test placeholder validation and publish warning.

### Task 6: Verify all tests pass

Run full test suite, fix any count assertions.
