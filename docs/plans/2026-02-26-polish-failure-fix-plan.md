# MOD-262: Polish Failure Fix — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the polish step so all 4 lead magnets render with rich formatting, embedded videos, and complete content.

**Architecture:** Switch `polishLeadMagnetContent()` from synchronous API call to streaming, add JSON repair fallback, enable embed block generation in the polish prompt, fix the `ExtractedContentRenderer` fallback, then re-run polish on all 4 lead magnets.

**Tech Stack:** @anthropic-ai/sdk (streaming), Next.js, React, TypeScript

---

### Task 1: Add JSON repair utility

**Files:**
- Create: `src/lib/utils/repair-json.ts`
- Create: `src/__tests__/lib/utils/repair-json.test.ts`

**Step 1: Write the failing test**

```ts
// src/__tests__/lib/utils/repair-json.test.ts
import { repairJson } from '@/lib/utils/repair-json';

describe('repairJson', () => {
  it('parses valid JSON unchanged', () => {
    const valid = '{"key": "value", "arr": [1, 2]}';
    expect(repairJson(valid)).toEqual({ key: 'value', arr: [1, 2] });
  });

  it('fixes trailing comma before closing brace', () => {
    const broken = '{"key": "value",}';
    expect(repairJson(broken)).toEqual({ key: 'value' });
  });

  it('fixes trailing comma before closing bracket', () => {
    const broken = '{"arr": [1, 2,]}';
    expect(repairJson(broken)).toEqual({ arr: [1, 2] });
  });

  it('closes unclosed braces', () => {
    const broken = '{"sections": [{"id": "a"}]';
    expect(repairJson(broken)).toEqual({ sections: [{ id: 'a' }] });
  });

  it('closes unclosed brackets', () => {
    const broken = '{"arr": [1, 2';
    expect(repairJson(broken)).toEqual({ arr: [1, 2] });
  });

  it('handles deeply truncated JSON', () => {
    const broken = '{"sections": [{"id": "a", "blocks": [{"type": "paragraph"';
    const result = repairJson(broken);
    expect(result).toBeTruthy();
    expect(result.sections).toBeDefined();
  });

  it('throws on completely invalid input', () => {
    expect(() => repairJson('not json at all')).toThrow();
  });

  it('strips markdown code fences', () => {
    const wrapped = '```json\n{"key": "value"}\n```';
    expect(repairJson(wrapped)).toEqual({ key: 'value' });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest src/__tests__/lib/utils/repair-json.test.ts --no-coverage`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

```ts
// src/lib/utils/repair-json.ts

/**
 * Attempt to parse JSON, repairing common truncation artifacts.
 * Used as a fallback when Claude returns truncated JSON responses.
 */
export function repairJson(raw: string): Record<string, unknown> {
  // Strip markdown code fences
  let text = raw.replace(/^```(?:json)?\s*\n?/m, '').replace(/\n?```\s*$/m, '');

  // Extract the outermost JSON object
  const objStart = text.indexOf('{');
  if (objStart === -1) throw new Error('No JSON object found');
  text = text.slice(objStart);

  // Try parsing as-is first
  try {
    return JSON.parse(text);
  } catch {
    // Continue to repair
  }

  // Remove trailing commas before } or ]
  text = text.replace(/,\s*([}\]])/g, '$1');

  // Try again after comma fix
  try {
    return JSON.parse(text);
  } catch {
    // Continue to bracket repair
  }

  // Count unclosed brackets/braces and close them
  let openBraces = 0;
  let openBrackets = 0;
  let inString = false;
  let escaped = false;

  for (const char of text) {
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (char === '{') openBraces++;
    else if (char === '}') openBraces--;
    else if (char === '[') openBrackets++;
    else if (char === ']') openBrackets--;
  }

  // If we're inside a string, close it
  if (inString) text += '"';

  // Remove any trailing partial key-value (e.g., `"key": "val`)
  // by trimming back to last complete value
  text = text.replace(/,\s*"[^"]*":\s*"[^"]*$/m, '');
  text = text.replace(/,\s*"[^"]*":\s*$/m, '');
  text = text.replace(/,\s*"[^"]*$/m, '');

  // Remove trailing commas again after trimming
  text = text.replace(/,\s*$/m, '');

  // Close unclosed brackets then braces
  for (let i = 0; i < openBrackets; i++) text += ']';
  for (let i = 0; i < openBraces; i++) text += '}';

  // Final trailing comma cleanup
  text = text.replace(/,\s*([}\]])/g, '$1');

  return JSON.parse(text);
}
```

**Step 4: Run test to verify it passes**

Run: `npx jest src/__tests__/lib/utils/repair-json.test.ts --no-coverage`
Expected: All 8 tests PASS

**Step 5: Commit**

```bash
git add src/lib/utils/repair-json.ts src/__tests__/lib/utils/repair-json.test.ts
git commit -m "feat(MOD-262): add repairJson utility for truncated Claude responses"
```

---

### Task 2: Switch polish function to streaming + higher max_tokens + JSON repair

**Files:**
- Modify: `src/lib/ai/lead-magnet-generator.ts:1378-1398`

**Step 1: Update the API call and response handling**

Replace lines 1378–1398 in `polishLeadMagnetContent()`:

OLD (lines 1378–1398):
```ts
  const response = await getAnthropicClient().messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 8000,
    messages: [{ role: 'user', content: prompt }],
  });

  const textContent = response.content.find((block) => block.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from Claude');
  }

  try {
    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as PolishedContent;
    }
    return JSON.parse(textContent.text) as PolishedContent;
  } catch {
    throw new Error('Failed to parse polished content response');
  }
}
```

NEW:
```ts
  // Use streaming to prevent HTTP timeout truncation (MOD-262)
  const response = await getAnthropicClient().messages.stream({
    model: 'claude-opus-4-6',
    max_tokens: 16000,
    messages: [{ role: 'user', content: prompt }],
  }).finalMessage();

  const textContent = response.content.find((block) => block.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from Claude');
  }

  const rawText = textContent.text;
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  const jsonStr = jsonMatch ? jsonMatch[0] : rawText;

  // Try standard parse first, then repair truncated JSON (MOD-262)
  try {
    return JSON.parse(jsonStr) as PolishedContent;
  } catch {
    try {
      return repairJson(jsonStr) as PolishedContent;
    } catch (repairErr) {
      const preview = jsonStr.slice(-200);
      throw new Error(
        `Failed to parse polished content (even after repair). Last 200 chars: ${preview}`
      );
    }
  }
}
```

Also add the import at the top of the file (after line 17):
```ts
import { repairJson } from '@/lib/utils/repair-json';
```

**Step 2: Run existing polish tests to verify nothing broke**

Run: `npx jest src/__tests__/api/lead-magnet/polish.test.ts --no-coverage`
Expected: All existing tests PASS (the AI function is mocked in route tests)

**Step 3: Commit**

```bash
git add src/lib/ai/lead-magnet-generator.ts
git commit -m "feat(MOD-262): switch polish to streaming + 16K tokens + JSON repair"
```

---

### Task 3: Enable embed blocks in the polish prompt

**Files:**
- Modify: `src/lib/ai/lead-magnet-generator.ts:1310-1312` (the "Do NOT use" line for embeds)

**Step 1: Find and replace the embed restriction**

In the polish prompt (around line 1310-1312), find:
```
    - "embed": ONLY for embeddable URLs found in the extracted content (YouTube, Vimeo, Loom, Airtable). Include "url" (the full URL) and "provider" (e.g. "youtube", "vimeo", "loom", "airtable"). Use these when the extracted content contains video or external resource links that should be embedded inline.
```

Wait — let me re-check. The current prompt says:
```
   - Do NOT use "image" or "embed" blocks — those are added manually by the user.
```

Replace that line with:
```
   - Do NOT use "image" blocks — those are added manually by the user.
   - "embed": Use ONLY when the extracted content contains YouTube, Vimeo, Loom, or Airtable URLs. Include "url" (the full original URL) and "provider" (e.g. "youtube", "vimeo", "loom", "airtable"). Embed each video/resource URL found in the content — do not skip them.
```

**Step 2: Verify the prompt change compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

**Step 3: Commit**

```bash
git add src/lib/ai/lead-magnet-generator.ts
git commit -m "feat(MOD-262): enable auto-detection of embeddable URLs in polish prompt"
```

---

### Task 4: Fix ExtractedContentRenderer to show all content fields

The `ExtractedContentRenderer` currently only renders `content.structure[].contents[]` and `content.nonObviousInsight`. But `ExtractedContent` also has `personalExperience`, `proof`, `commonMistakes[]`, and `differentiation` fields that may contain substantial content. If `structure[].contents[]` arrays are empty for some lead magnets, those fields might be the only content.

**Files:**
- Modify: `src/components/content/ExtractedContentRenderer.tsx:62-92`

**Step 1: Add rendering for additional ExtractedContent fields**

After the `content.structure.map(...)` section (after line 62's closing `</section>`), add rendering for the extra fields before the `nonObviousInsight` block. Insert before the `{/* Non-obvious insight */}` comment (line 65):

```tsx
      {/* Additional content fields */}
      {content.personalExperience && (
        <div style={{ margin: '2rem 0' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: textColor, margin: '0 0 0.75rem 0' }}>
            Personal Experience
          </h3>
          <p style={{ fontSize: '1.125rem', lineHeight: '1.875rem', color: bodyColor, margin: 0 }}>
            {content.personalExperience}
          </p>
        </div>
      )}

      {content.proof && (
        <div style={{ margin: '2rem 0' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: textColor, margin: '0 0 0.75rem 0' }}>
            Proof
          </h3>
          <p style={{ fontSize: '1.125rem', lineHeight: '1.875rem', color: bodyColor, margin: 0 }}>
            {content.proof}
          </p>
        </div>
      )}

      {content.commonMistakes && content.commonMistakes.length > 0 && (
        <div style={{ margin: '2rem 0' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: textColor, margin: '0 0 0.75rem 0' }}>
            Common Mistakes
          </h3>
          {content.commonMistakes.map((mistake: string, i: number) => (
            <p key={i} style={{ fontSize: '1.125rem', lineHeight: '1.875rem', color: bodyColor, margin: '0 0 0.75rem 0' }}>
              {mistake}
            </p>
          ))}
        </div>
      )}

      {content.differentiation && (
        <div style={{ margin: '2rem 0' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: textColor, margin: '0 0 0.75rem 0' }}>
            What Makes This Different
          </h3>
          <p style={{ fontSize: '1.125rem', lineHeight: '1.875rem', color: bodyColor, margin: 0 }}>
            {content.differentiation}
          </p>
        </div>
      )}
```

**Step 2: Verify the component compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/content/ExtractedContentRenderer.tsx
git commit -m "fix(MOD-262): render all ExtractedContent fields in fallback renderer"
```

---

### Task 5: Re-run polish on all 4 lead magnets

**Prerequisite:** Tasks 1-4 must be committed and the dev server running or the code deployed.

**Step 1: Find the lead magnet IDs**

Query the database for the 4 affected lead magnets. Use the slugs from the funnel pages:
- `5m-linkedin-post-database`
- `top-1-percent-linkedin-content-pack`
- `5m-ai-lead-magnet-machine-pack`
- `5m-lead-magnet-swipe-file`

Run a Supabase query or check the app to get the `lead_magnet.id` for each.

**Step 2: Trigger polish for each lead magnet**

Option A — via the API (requires auth session):
```bash
# For each lead magnet ID:
curl -X POST "http://localhost:3000/api/lead-magnet/<ID>/polish" \
  -H "Cookie: <session-cookie>"
```

Option B — via the rebuild script (re-generates extracted_content + polishes):
```bash
cd C:\Users\deskt\magnetlab
npx tsx scripts/rebuild-stub-content.ts <lead-magnet-id>
```

Option C — via a one-off script that calls `polishLeadMagnetContent()` directly for each ID.

**Step 3: Verify each page**

Open each URL in browser and confirm:
- [ ] `https://www.magnetlab.app/p/modernagencysales/5m-linkedin-post-database/content` — rich blocks rendering
- [ ] `https://www.magnetlab.app/p/modernagencysales/top-1-percent-linkedin-content-pack/content` — rich blocks + YouTube embeds
- [ ] `https://www.magnetlab.app/p/modernagencysales/5m-ai-lead-magnet-machine-pack/content` — rich blocks, all sections have body content
- [ ] `https://www.magnetlab.app/p/modernagencysales/5m-lead-magnet-swipe-file/content` — rich blocks, no empty sections

**Step 4: Comment on MOD-262 with results**

Post a comment on MOD-262 confirming all 4 pages are fixed, tag Tim for re-review.

**Step 5: Commit any final changes**

```bash
git add -A
git commit -m "fix(MOD-262): re-polish all 4 lead magnets with fixed pipeline"
```
