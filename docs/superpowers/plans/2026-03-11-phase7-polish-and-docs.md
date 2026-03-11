# Phase 7: Polish & Documentation

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire module click → chat focus, remove unused exports, add env var documentation, and update CLAUDE.md with accelerator feature docs.

**Architecture:** Minimal changes — UI wiring, cleanup, and documentation.

**Tech Stack:** Next.js 15, React 18

---

## File Structure

### Modified Files
| File | Change |
|------|--------|
| `src/components/accelerator/AcceleratorPage.tsx` | Handle module click → send chat message |
| `src/components/accelerator/AcceleratorChat.tsx` | Accept onModuleSelect callback |
| `src/components/accelerator/useAcceleratorChat.ts` | Accept moduleToFocus, auto-send module message |
| `src/lib/services/accelerator-enrollment.ts` | Remove unused ACCELERATOR_STRIPE_PRODUCT_ID export |
| `CLAUDE.md` | Add accelerator feature docs + env vars |

---

### Task 1: Wire Module Click to Chat Focus

**Files:**
- Modify: `src/components/accelerator/AcceleratorPage.tsx`
- Modify: `src/components/accelerator/AcceleratorChat.tsx`
- Modify: `src/components/accelerator/useAcceleratorChat.ts`

When a user clicks a module in the ProgressPanel, send a message to the chat focusing on that module.

- [ ] **Step 1: Read AcceleratorPage.tsx**

Find the `handleModuleClick` callback or where ProgressPanel's `onModuleClick` is defined.

- [ ] **Step 2: Add module focus state to AcceleratorPage**

```typescript
const [focusModule, setFocusModule] = useState<ModuleId | null>(null);
```

Pass `setFocusModule` as `onModuleClick` to ProgressPanel. Pass `focusModule` to AcceleratorChat.

- [ ] **Step 3: Update AcceleratorChat to accept focusModule**

Add `focusModule?: ModuleId | null` to AcceleratorChatProps. Pass through to useAcceleratorChat.

- [ ] **Step 4: Handle focusModule in useAcceleratorChat**

Add a useEffect that sends a message when focusModule changes:
```typescript
useEffect(() => {
  if (focusModule) {
    const moduleName = MODULE_NAMES[focusModule];
    sendMessage(`Let's work on ${moduleName} (${focusModule}). What should I focus on next?`);
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [focusModule]);
```

Import `MODULE_NAMES` from `@/lib/types/accelerator`.

- [ ] **Step 5: Clear focusModule after sending**

The parent should clear focusModule after the message is sent. One approach: have useAcceleratorChat call a `onFocusHandled` callback, or simply clear it via the setFocusModule passed down. Simplest: clear in the useEffect after sendMessage.

- [ ] **Step 6: Run typecheck**

Run: `pnpm typecheck`

- [ ] **Step 7: Commit**

```bash
git commit -m "feat(accelerator): wire module click to chat focus"
```

---

### Task 2: Remove Unused Exports

**Files:**
- Modify: `src/lib/services/accelerator-enrollment.ts`

- [ ] **Step 1: Read accelerator-enrollment.ts**

Find `ACCELERATOR_STRIPE_PRODUCT_ID` export.

- [ ] **Step 2: Verify it's unused**

Search for `ACCELERATOR_STRIPE_PRODUCT_ID` across the codebase. If only defined in enrollment.ts and never imported elsewhere, remove it.

- [ ] **Step 3: Run typecheck**

- [ ] **Step 4: Commit**

```bash
git commit -m "chore(accelerator): remove unused ACCELERATOR_STRIPE_PRODUCT_ID export"
```

---

### Task 3: Add Accelerator Feature Documentation

**Files:**
- Create: `docs/accelerator.md`
- Modify: `CLAUDE.md` (the repo-level one at magnetlab root)

- [ ] **Step 1: Create docs/accelerator.md**

Document the accelerator feature:
- Architecture overview (multi-agent, 8 modules, sub-agent dispatch)
- Database tables (9 tables)
- API routes (2 routes)
- Key services (7 services)
- Frontend components (11 components)
- Trigger.dev tasks (3 tasks)
- AI agents (8 sub-agents + orchestrator)
- Env vars needed (ACCELERATOR_STRIPE_PRICE_ID, etc.)
- Data flow (enrollment → onboarding → module work → metrics → troubleshooter)

- [ ] **Step 2: Update CLAUDE.md**

Add to the Feature Documentation table:
```
| GTM Accelerator | [docs/accelerator.md](docs/accelerator.md) |
```

Add the env vars to the Env Vars section:
```
ACCELERATOR_STRIPE_PRICE_ID
```

- [ ] **Step 3: Commit**

```bash
git commit -m "docs(accelerator): add feature documentation and env var reference"
```

---

### Task 4: E2E Verification

- [ ] **Step 1: Run typecheck**
- [ ] **Step 2: Run full test suite**
- [ ] **Step 3: Run build**

---
