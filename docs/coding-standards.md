# Coding Standards

> Full reference with code examples. Place in `docs/coding-standards.md` in each repo.

## 10 Principles

### 1. Design for the reader, not the writer

Every file should be understandable in a 10-second skim. Optimize for the person who reads next.

Bad — clever but requires reading every line to understand:
```typescript
export async function handle(req: NextRequest) {
  const s = await auth(); if (!s?.user?.id) return NextResponse.json({error:'Unauthorized'},{status:401});
  const d = await supabase.from('posts').select('*').eq('user_id',s.user.id);
  return NextResponse.json(d.data);
}
```

Good — scannable structure, clear naming, predictable sections:
```typescript
/**
 * Posts Service
 * Business logic for pipeline posts.
 * Never imports from Next.js HTTP layer (no NextRequest, NextResponse, cookies).
 */

// --- Response types ---------------------------------------------------------

export interface PostWithProfile extends PipelinePost {
  profile_name: string | null;
}

// --- Read operations --------------------------------------------------------

export async function getPosts(
  scope: DataScope,
  filters: PostFilters = {},
): Promise<PostWithProfile[]> {
```

Key behaviors:
- JSDoc module header: `/** Name. Purpose. Constraint. */`
- Section dividers: `// --- Name -----` in files > 50 lines
- Import order: external packages -> @/ absolute imports -> type imports
- Consistent file structure: types at top, reads before writes, error helpers at bottom


### 2. Constrain before you build

Define what a module CANNOT do before writing it. Constraints prevent scope creep.

Bad:
```typescript
// services/posts.service.ts
import { cookies } from 'next/headers';  // Service reaching into HTTP layer
import { NextResponse } from 'next/server';  // Service returning HTTP responses
```

Good:
```typescript
/**
 * Posts Service
 * Business logic for pipeline posts.
 * Never imports from Next.js HTTP layer (no NextRequest, NextResponse, cookies).
 */
import * as postsRepo from '@/server/repositories/posts.repo';
```

Key behaviors:
- Every new file starts with a JSDoc header stating its constraint
- Services: "Never imports from Next.js HTTP layer"
- Repositories: "ALL DB queries live here. Never imported by client files."
- Routes: thin shells only (auth -> scope -> service -> JSON)


### 3. Make the implicit explicit

If something is assumed, make it a parameter, a type, or a constant.

Bad — hidden dependency on cookie, caller can't control scope:
```typescript
async function getPosts() {
  const cookieStore = await cookies();
  const teamId = cookieStore.get('team-context')?.value;
  // ... build query based on teamId
}
```

Good — scope is explicit, testable, controllable:
```typescript
async function getPosts(scope: DataScope, filters: PostFilters = {}): Promise<PostWithProfile[]> {
  const posts = await postsRepo.findPosts(scope, filters);
  // ...
}
```

Other examples:
- Column constants instead of `select('*')`: `const POST_LIST_COLUMNS = "id, user_id, ..."`
- `ALLOWED_UPDATE_FIELDS` whitelist instead of spreading request body
- Typed interfaces (`PostFilters`, `PostUpdateInput`) instead of `Record<string, any>`
- `?? default` for nullish coalescing instead of relying on falsy behavior


### 4. Build layers, not features

Before adding a feature, ask "what layer does this belong to?" and build the layer first.

Bad — bolt feature onto existing route:
```typescript
// app/api/posts/route.ts — 150 lines of mixed concerns
export async function GET(request: NextRequest) {
  const session = await auth();
  const supabase = createClient();
  // 40 lines of query building
  // 20 lines of enrichment
  // 15 lines of error handling
}
```

Good — create the layer, then the route is trivial:
```typescript
// server/repositories/posts.repo.ts — ALL queries
// server/services/posts.service.ts — ALL business logic
// app/api/posts/route.ts — 22 lines: auth -> scope -> service -> JSON

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const scope = await getDataScope(session.user.id);
    const posts = await postsService.getPosts(scope, { status, limit });
    return NextResponse.json({ posts });
  } catch (error) {
    logError('posts', error, { step: 'list_error' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

Key behaviors:
- New domain = create `{domain}.repo.ts` + `{domain}.service.ts` before the route
- Route handlers max 30 lines
- Services call repos + AI modules + integrations (never DB directly)
- Repos call DB only (never imported by client code)


### 5. Delete before you add

Before adding code, ask: can I remove something to make this simpler?

Bad — add a feature by bolting more code onto a 300-line component:
```typescript
// Component now has 25 useState calls, 3 useEffects, inline fetch, mixed concerns
const [posts, setPosts] = useState([]);
const [loading, setLoading] = useState(true);
const [filter, setFilter] = useState('');
// ... 22 more useState calls
```

Good — extract state to a hook, then the component is pure rendering:
```typescript
// usePosts.ts — all state and data fetching
export function usePosts(filters: PostFilters) {
  const [posts, setPosts] = useState<PipelinePost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // ... returns { posts, isLoading, refetch }
}

// PostsTab.tsx — pure rendering, imports the hook
const { posts, isLoading, refetch } = usePosts(filters);
```

Key behaviors:
- Extract state to hooks when component exceeds ~15 useState
- Move inline DB queries to repos
- Move business logic from routes to services
- Replace duplicated code with shared constants (never `// SYNC:` comments)


### 6. Write code that fails loudly

Build systems where mistakes are caught immediately, not swallowed silently.

Bad — silent failures:
```typescript
try {
  await savePost(data);
} catch {
  // Silent failure — user thinks it saved
}

const { data } = await supabase.from('posts').select('*');  // silently fails on missing columns
```

Good — explicit failures with context:
```typescript
// Named columns fail visibly if column doesn't exist
const POST_LIST_COLUMNS = "id, user_id, draft_content, final_content, status, ...";

// Errors carry status codes and get logged
if (!post) {
  throw Object.assign(new Error('Post not found'), { statusCode: 404 });
}

// Every catch has structured logging
} catch (error) {
  logError('posts', error, { step: 'polish_operation', postId });
  return NextResponse.json({ error: 'Failed to polish post' }, { status: 500 });
}
```

Key behaviors:
- Never empty `catch { }` — at minimum `logError()`
- `logError(context, error, metadata)` — never raw console.log
- Service errors: `Object.assign(new Error(msg), { statusCode: N })`
- Explicit column selects (named constants at file top)
- Typed interfaces catch mismatches at compile time


### 7. Side effects are quarantined

Core logic should never be hostage to secondary concerns.

Bad — side effect failure blocks the response:
```typescript
export async function updatePost(userId, postId, body) {
  const post = await postsRepo.updatePost(userId, postId, updates);
  await captureEditHistory(post);  // If this fails, the whole update fails
  await sendWebhook(post);  // If this times out, user waits
  return post;
}
```

Good — side effects isolated, never block the response:
```typescript
export async function updatePost(userId, postId, body) {
  const post = await postsRepo.updatePost(userId, postId, updates);

  // Edit capture must never affect the save flow
  try {
    await captureAndClassifyEdit({ ... });
  } catch {
    // Edit capture must never affect the save flow
  }

  return { post, editId };
}
```

Key behaviors:
- Webhooks: fire-and-forget with timeout
- Edit tracking: separate try/catch, comment explains why
- Enrichment: parallel and optional (Promise.all with graceful degradation)
- The comment in catch explains the intent, not just "// ignore"


### 8. Dependencies flow one direction

Route -> Service -> Repo -> Database. Never backwards. Never sideways.

```
API Route (auth + parse + respond)
    | calls
Service (business logic + validation + orchestration)
    | calls
Repository (database queries only)
    | calls
Database
```

Violations:
- Repo importing from a service <- WRONG
- Service importing NextRequest/NextResponse <- WRONG
- Route containing business logic <- WRONG
- Client component importing from server/ <- WRONG
- Service calling another service at same level <- OK sparingly, but prefer shared repo


### 9. Predictability over cleverness

Every file of the same type should follow the same structure.

Repository file template:
```
1. JSDoc header (name, purpose, constraint)
2. Column select constants
3. Filter/input type interfaces
4. Internal helper functions (not exported)
5. Read operations (find*)
6. Write operations (create*, update*, delete*)
```

Service file template:
```
1. JSDoc header (name, purpose, constraint)
2. Imports: repo -> AI modules -> integrations -> types
3. Response type interfaces
4. Validation constants (ALLOWED_UPDATE_FIELDS, VALID_STATUSES)
5. Read operations (get*)
6. Write operations (update*, delete*, publish*, polish*)
7. getStatusCode() error helper
```

Route file template:
```
1. Imports: next/server -> auth -> scope -> logger -> service
2. GET/POST/PATCH/DELETE handlers (each max 30 lines)
3. Pattern: auth -> scope -> parse -> service -> json
```

Naming conventions:
- Repos: `find*` (reads), `create*`, `update*`, `delete*`
- Services: `get*` (reads), domain verbs (publish, polish, schedule)
- Files: `{domain}.repo.ts`, `{domain}.service.ts`
- Types: `*Filters`, `*UpdateInput`, `*InsertInput`, `*Result`
- Literal union types, NOT TypeScript enums


### 10. Think about what SHOULDN'T happen

Define the negative space. Whitelists, not blocklists.

Bad — accept anything, blocklist known bad:
```typescript
const updates = { ...body };  // Accepts ANY field from request body
delete updates.id;  // Try to block dangerous fields
delete updates.user_id;
// What about created_at? What about fields added next month?
```

Good — whitelist what IS allowed:
```typescript
const ALLOWED_UPDATE_FIELDS: (keyof PostUpdateInput)[] = [
  'draft_content', 'final_content', 'status', 'scheduled_time',
];

const updates: Record<string, unknown> = {};
for (const field of ALLOWED_UPDATE_FIELDS) {
  if (field in body) {
    updates[field] = body[field];
  }
}
if (Object.keys(updates).length === 0) {
  throw Object.assign(new Error('No valid fields to update'), { statusCode: 400 });
}
```

Key behaviors:
- ALLOWED_UPDATE_FIELDS for every update operation
- JSDoc constraints define what modules CANNOT import
- Architecture defines what layers CANNOT do
- Read functions return `null` on not-found (don't throw) — callers decide how to handle


## Anti-Pattern Catalog

Common AI-generated code smells and their fixes:

| Anti-Pattern | Why It's Bad | Fix |
|---|---|---|
| Empty `catch { }` | Errors silently swallowed | `logError(context, error, metadata)` at minimum |
| `select('*')` | Silently fails on missing columns | Named column constants at file top |
| `console.log(error)` | Unstructured, no context | `logError('domain/function', error, { step, id })` |
| `// SYNC: keep in sync with X` | Manual sync always drifts | Extract shared constant, import from one place |
| Spreading request body into DB | New fields = security hole | `ALLOWED_UPDATE_FIELDS` whitelist pattern |
| 300+ line component | Unreadable, untestable | Extract hooks + sub-components |
| Business logic in route handler | Can't test, can't reuse | Move to service layer |
| `fetch()` inside useEffect | Loading flash, no caching | API modules + hooks or server components |
| TypeScript `enum` | Generates runtime code, poor narrowing | Literal union: `type Status = 'a' \| 'b'` |
| Inline DB queries in routes/services | Scattered, untestable | Repository layer with typed functions |
| `Record<string, any>` everywhere | No type safety | Specific interfaces per domain |
| Mocking fetch in tests | Tests the mock, not logic | Mock service layer, test business logic |


## Validation Patterns

### Zod (at API boundary)
```typescript
export const createItemSchema = z.object({
  email: z.string({ required_error: 'Email is required' })
    .email('Invalid email format')
    .max(255)
    .transform((email) => email.toLowerCase().trim()),
  name: z.string().max(100).transform((n) => n.trim()).optional(),
});
export type CreateItemInput = z.infer<typeof createItemSchema>;
```

### Service validation (inside business logic)
```typescript
const VALID_STATUSES: Status[] = ['draft', 'reviewing', 'approved', 'scheduled'];

if (field === 'status' && !VALID_STATUSES.includes(body[field])) {
  throw Object.assign(new Error('Invalid status value'), { statusCode: 400 });
}
```

### Repos trust services
```typescript
// Repo accepts pre-validated data, minimal checks
export async function updateItem(userId: string, id: string, updates: Record<string, unknown>) {
  const { data, error } = await supabase.from('items')
    .update(updates).eq('id', id).eq('user_id', userId).select(COLUMNS).single();
  if (error) throw new Error(`items.update: ${error.message}`);
  return data;
}
```


## Null Handling Patterns

```typescript
// Return null from reads (don't throw)
export async function findById(userId: string, id: string): Promise<Item | null> {
  const { data, error } = await supabase.from('items').select(COLUMNS).eq('id', id).single();
  if (error) return null;
  return data;
}

// Caller decides how to handle null
const item = await repo.findById(userId, id);
if (!item) throw Object.assign(new Error('Item not found'), { statusCode: 404 });

// Nullish coalescing for defaults (preserves 0, '')
const limit = filters.limit ?? 50;

// Filter + dedupe arrays before passing to queries
const ids = [...new Set(items.map(i => i.relatedId).filter(Boolean))] as string[];
const relatedMap = ids.length > 0 ? await repo.getRelatedMap(ids) : {};
```


## Testing Patterns

```typescript
/**
 * @jest-environment node
 */

// Mock ENTIRE modules at file top, BEFORE imports
jest.mock('@/server/services/posts.service');
jest.mock('@/lib/utils/logger', () => ({
  logError: jest.fn(), logWarn: jest.fn(), logInfo: jest.fn(),
}));

// Import AFTER mocks
import * as postsService from '@/server/services/posts.service';

describe('GET /api/posts', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 401 when unauthenticated', async () => {
    (auth as jest.Mock).mockResolvedValue(null);
    const response = await GET(buildRequest());
    expect(response.status).toBe(401);
  });

  it('returns posts for authenticated user', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
    (postsService.getPosts as jest.Mock).mockResolvedValue([mockPost]);
    const response = await GET(buildRequest());
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.posts).toHaveLength(1);
  });
});
```

Key: mock the SERVICE layer, not fetch. Test route logic (auth, parsing, error mapping), not DB queries.


## Code Review Checklist

When reviewing code, check for these violations:

- [ ] Empty catch blocks without logging
- [ ] Raw `console.log` instead of `logError()`
- [ ] `select('*')` in database queries
- [ ] Business logic in API route handlers (routes should be <30 lines)
- [ ] Raw `fetch()` in React components
- [ ] Request body spread into DB queries without field whitelist
- [ ] Components over 300 lines without hook/sub-component extraction
- [ ] Missing JSDoc module headers on new files
- [ ] Missing typed interfaces for function parameters/returns
- [ ] Dependencies flowing the wrong direction
