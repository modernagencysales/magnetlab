<!-- Extracted from CLAUDE.md — see main file for architecture overview -->

## Testing Philosophy

### What to test and when

| Layer | Tool | What it catches | When to write |
|-------|------|----------------|---------------|
| **Schema validation** | Jest | Zod schema ↔ actual data shape mismatches | Every new/changed API route or Zod schema |
| **API integration** | Jest | Route handler logic, auth, DB errors | Every new API route |
| **Critical path e2e** | Playwright | Save flow, funnel publish, lead capture broken end-to-end | Every new archetype or major wizard change |
| **Typecheck** | `tsc --noEmit` | Type errors | Always (run before commit) |

### The #1 bug pattern to guard against

**Zod schemas drifting from actual data shapes.** TypeScript can't catch this because DB columns accept `Json`/`unknown`. The Zod schema is the only runtime check, so if it's wrong, bad data silently passes or valid data gets rejected.

**Rule: When you add or change a Zod schema, add a Jest test with realistic data matching what the UI actually sends.** See `src/__tests__/api/lead-magnet/create.test.ts` for the pattern — it tests each archetype's payload against `createLeadMagnetSchema`.

### Jest tests (fast, run often)

```
npm run test                              # All tests
npx jest src/__tests__/api/lead-magnet/   # Specific directory
npx jest --no-coverage path/to/test.ts    # Single file, fast
```

- API route tests: mock Supabase + auth, test request/response shapes
- Schema tests: validate Zod accepts realistic payloads, rejects bad ones
- Use `@jest-environment node` for API route tests

### Playwright e2e tests (slower, critical paths only)

```
npm run test:e2e                  # All e2e (needs dev server)
npm run test:e2e:headed           # With browser visible
npx playwright test e2e/wizard.spec.ts   # Single file
```

- Auth: cookie-based setup in `e2e/fixtures/auth.ts`
- Mocks: `e2e/helpers/index.ts` has Supabase, Stripe, AI, and auth mocks
- API contract tests in `e2e/wizard.spec.ts` POST realistic payloads directly to validate schema acceptance
- Config: `playwright.config.ts` (chromium, firefox, mobile-safari)

### When NOT to test

- Don't write Playwright tests for every UI variation — only critical user flows
- Don't test Supabase/Stripe internals — mock them and test your logic
- Don't duplicate what `tsc --noEmit` already catches
