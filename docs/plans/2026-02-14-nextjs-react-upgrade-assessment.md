# Next.js 16 + React 19 Upgrade Assessment

**Date:** 2026-02-14
**Current versions:** Next.js 15.5.9, React 18.3.1, TypeScript 5.6
**Target versions:** Next.js 16.x, React 19.x

## Codebase Overview

- **470 total source files** (`.ts` + `.tsx`)
- **126 files** import from `react`
- **67 files** use `useEffect` (156 total occurrences)
- **52 dynamic route files** with `[param]` segments
- **15 shadcn/ui component files** in `src/components/ui/`
- **57 API route handlers**
- **1 class component** (`ErrorBoundary.tsx`)
- **0 `pages/` directory** routes (App Router only)

---

## React 19 Concerns

### 1. `forwardRef` usage (56 occurrences in 12 files)

**Impact: LOW** | All in `src/components/ui/` (shadcn/ui)

React 19 passes `ref` as a regular prop, making `forwardRef` unnecessary. However, `forwardRef` is NOT removed in React 19 -- it still works but is deprecated. These components will continue to function without changes.

Files affected:
- `src/components/ui/button.tsx` (1)
- `src/components/ui/card.tsx` (6)
- `src/components/ui/chart.tsx` (3)
- `src/components/ui/dialog.tsx` (4)
- `src/components/ui/dropdown-menu.tsx` (8)
- `src/components/ui/input.tsx` (1)
- `src/components/ui/label.tsx` (1)
- `src/components/ui/separator.tsx` (1)
- `src/components/ui/sheet.tsx` (4)
- `src/components/ui/sidebar.tsx` (23)
- `src/components/ui/tabs.tsx` (3)
- `src/components/ui/tooltip.tsx` (1)

**Action:** Optional cleanup. Can be done incrementally or when updating shadcn/ui. No urgency since `forwardRef` still works.

### 2. `defaultProps` on function components

**Impact: NONE** | 0 occurrences

The only `defaultProps` in the codebase is a test variable name (`const defaultProps = {...}` in `LibrarySearch.test.tsx`), not `Component.defaultProps`. No changes needed.

### 3. String refs

**Impact: NONE** | 0 occurrences

All `ref=` patterns found are `href=` attributes in anchor elements (false positives). No string refs exist.

### 4. Legacy lifecycle methods

**Impact: NONE** | 0 occurrences

No `componentWillMount`, `componentWillReceiveProps`, or `componentWillUpdate` found. The single class component (`ErrorBoundary.tsx`) uses `getDerivedStateFromError` and `componentDidCatch` -- both fully supported in React 19.

### 5. `useEffect` patterns

**Impact: LOW** | 67 files, 156 occurrences

React 19's improved effect cleanup is backward-compatible. No patterns found that would break. The main change is that React 19 may re-run effects during development with StrictMode, but Next.js already enables StrictMode by default, so any issues would already be visible.

### 6. Context providers

**Impact: NONE** | 2 files use `createContext` (sidebar, chart)

Both are shadcn/ui components. React 19 allows `<Context>` instead of `<Context.Provider>` but the old pattern still works.

### 7. `React.Children` / `cloneElement`

**Impact: NONE** | 0 occurrences

No usage of these legacy APIs found.

### 8. Class components

**Impact: NONE** | 1 file (`src/components/ErrorBoundary.tsx`)

Class components are still supported in React 19. Error boundaries specifically must remain as class components (no hook equivalent yet). No changes needed.

---

## Next.js 16 Concerns

### 1. next.config.ts

**Impact: LOW** | 1 file

Current config:
```ts
const nextConfig: NextConfig = {
  images: { remotePatterns: [...] },
  experimental: {
    serverActions: { bodySizeLimit: '2mb' },
  },
};
```

- `serverActions` may move out of `experimental` in Next.js 16. The config should be checked against the release notes.
- Sentry integration (`withSentryConfig`) needs to be verified for Next.js 16 compatibility.
- No deprecated config options like `swcMinify` (removed in 15), `appDir` (removed in 15), etc.

### 2. Turbopack as default bundler

**Impact: MEDIUM** | Build system change

Next.js 16 makes Turbopack the default bundler for dev and production. While Turbopack is designed to be backward-compatible:
- Custom PostCSS config (`postcss.config.mjs`) should be tested
- Tailwind CSS v3 works with Turbopack
- No custom webpack config exists, which reduces risk

**Action:** Test the dev server and build with Turbopack before upgrading. Run `next dev --turbopack` on Next.js 15 first.

### 3. `pages/` directory usage

**Impact: NONE** | 0 files

The codebase is 100% App Router. No `pages/` directory exists.

### 4. Dynamic route params (async params)

**Impact: NONE** | Already migrated

All 52 dynamic route files already use the `Promise<{ id: string }>` async params pattern:
```ts
interface RouteParams {
  params: Promise<{ id: string }>;
}
```
This migration was already completed for Next.js 15.

### 5. Middleware

**Impact: LOW** | 1 file (`src/middleware.ts`)

Current middleware is simple (auth check + redirects). No known breaking changes in Next.js 16 middleware. The matcher pattern uses standard regex exclusions.

### 6. NextAuth compatibility

**Impact: MEDIUM** | `next-auth@5.0.0-beta.25`

NextAuth v5 beta is used for authentication. Next.js 16 compatibility should be verified with the latest NextAuth beta. Key files:
- `src/lib/auth/config.ts` (4 imports)
- `src/middleware.ts` (session token check)
- `src/app/(auth)/login/page.tsx`

**Action:** Update `next-auth` to latest beta alongside the Next.js 16 upgrade.

### 7. `@types/react` version

**Impact: REQUIRED** | Must update to `@types/react@19`

Currently `@types/react@18.3.5` and `@types/react-dom@18.3.0`. These MUST be updated to v19 alongside React 19. The React 19 type definitions include:
- `ref` as a regular prop (changes component type signatures)
- `useActionState` replacing `useFormState`
- New `use()` hook types
- Updated `ReactNode` type (includes promises)

### 8. Third-party dependency compatibility

**Impact: MEDIUM** | Multiple libraries to verify

| Package | Current | React 19 Support | Notes |
|---------|---------|-------------------|-------|
| `@radix-ui/react-*` | various | Supported | Radix UI added React 19 support; may need updates |
| `framer-motion` | ^11.3.31 | Supported | v11 supports React 19 |
| `recharts` | ^2.15.4 | Likely supported | Check latest release |
| `next-themes` | ^0.4.6 | Check needed | May need update |
| `sonner` | ^2.0.7 | Check needed | Toast library |
| `@sentry/nextjs` | ^10.38.0 | Check needed | Must support Next.js 16 |
| `driver.js` | ^1.4.0 | Check needed | Product tour library |
| `@trigger.dev/sdk` | ^4.3.3 | N/A | Server-only, no React dependency |

---

## Effort Estimate

| Area | Files | Effort | Priority |
|------|-------|--------|----------|
| Update `react` + `react-dom` + `@types/react` + `@types/react-dom` | 1 (package.json) | Low | Required |
| Update `next` + verify config | 2 | Low | Required |
| Test Turbopack compatibility | 0 (testing only) | Medium | Required |
| Update `next-auth` beta | 3 | Low-Medium | Required |
| Update Radix UI packages | 1 (package.json) | Low | Required |
| Verify other third-party deps | 0 (testing only) | Medium | Required |
| Remove `forwardRef` from shadcn/ui | 12 | Low | Optional (cosmetic) |
| Sentry SDK compatibility check | 1 | Low | Required |

**Total estimated effort: 1-2 days**

---

## Recommended Upgrade Order

### Phase 1: Pre-upgrade validation (on current Next.js 15)

1. Run `next dev --turbopack` and test all pages manually
2. Run `npm run build` with Turbopack flag if supported
3. Fix any Turbopack-related issues while still on Next.js 15

### Phase 2: React 19 + Next.js 16 upgrade (single PR)

1. Update `react`, `react-dom`, `@types/react`, `@types/react-dom` to v19
2. Update `next` to v16
3. Update `next-auth` to latest beta
4. Update `eslint-config-next` to match Next.js version
5. Update all `@radix-ui/react-*` packages to latest
6. Update `@sentry/nextjs` to latest
7. Run `npm run typecheck` -- fix any type errors
8. Run `npm test` -- fix any test failures
9. Run `npm run build` -- verify production build

### Phase 3: Post-upgrade cleanup (separate PR)

1. Optionally refactor `forwardRef` out of shadcn/ui components
2. Consider adopting `useActionState` if form handling patterns evolve

---

## Recommendation

**Do in ONE PR, not staged.** React 19 and Next.js 16 are tightly coupled -- Next.js 16 requires React 19. Attempting a partial upgrade (e.g., React 19 with Next.js 15) creates version mismatches. The codebase is well-positioned for this upgrade:

- No legacy patterns (no string refs, no legacy lifecycles, no `defaultProps`)
- Async params already migrated
- 100% App Router (no `pages/` compat needed)
- No custom webpack config (Turbopack-friendly)
- All `forwardRef` usage is in shadcn/ui (still works, optional cleanup)
- Zero uses of removed or deprecated React APIs

**Risk level: LOW-MEDIUM.** The main risks are third-party dependency compatibility (Radix UI, NextAuth, Sentry) and Turbopack stability. These are mitigated by the large community adoption and the libraries' stated React 19 support.
