# Coding Standards

## 10 Principles

1. **Design for the reader** — JSDoc headers, section dividers, predictable structure. Types at top, reads before writes.

2. **Constrain before you build** — JSDoc states what a module CANNOT do. Services: no Next.js HTTP. Repos: DB only. Routes: thin shells.

3. **Make the implicit explicit** — Scope as parameter, column constants (not `select('*')`), `ALLOWED_UPDATE_FIELDS` whitelist, typed interfaces.

4. **Build layers, not features** — Route → Service → Repo → DB. New domain = repo + service first. Routes max 30 lines.

5. **Delete before you add** — Extract state to hooks when >15 useState. Move logic to services. No `// SYNC:` comments.

6. **Fail loudly** — `logError(context, error, metadata)`. Never empty catch. Named column selects. `Object.assign(new Error(), { statusCode })`.

7. **Quarantine side effects** — Webhooks fire-and-forget. Edit capture in separate try/catch. Never block response.

8. **Dependencies flow one way** — Route → Service → Repo. Never backwards. Client never imports from server/.

9. **Predictability over cleverness** — Repo: find*, create*, update*, delete*. Service: get*, domain verbs. Repo template: columns → types → reads → writes.

10. **Define negative space** — Whitelists, not blocklists. Read functions return `null` on not-found.

## Anti-Patterns

| Avoid | Fix |
|-------|-----|
| Empty catch | `logError()` at minimum |
| `select('*')` | Named column constants |
| `console.log(error)` | `logError(context, error, { step, id })` |
| Spreading request body into DB | `ALLOWED_UPDATE_FIELDS` whitelist |
| 300+ line component | Extract hooks + sub-components |
| Business logic in route | Move to service |
| `fetch()` in useEffect | API modules + hooks |
| TypeScript enum | Literal union `'a' \| 'b'` |
| `Record<string, any>` | Specific interfaces |

## Validation

- **Zod** at API boundary. Schema → `z.infer<typeof schema>` for types.
- **Service** whitelist for status/field updates.
- **Repos** trust services; minimal checks.

## Testing

- Mock services, not fetch. Test route logic (auth, parse, error mapping).
- `@jest-environment node` for API tests.
- Schema tests: validate Zod with realistic payloads.

## Code Review Checklist

Empty catch? Raw console? `select('*')`? Logic in route? Raw fetch in component? Body spread without whitelist? 300+ line component? Missing JSDoc? Wrong dependency direction?
