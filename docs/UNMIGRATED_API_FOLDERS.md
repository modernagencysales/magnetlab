# API Folders Not Yet Migrated (repo + service + thin route)

Routes in these folders still use `createSupabaseAdminClient()` directly.  
**Migrated** = auth → getDataScope (if needed) → validate → service → JSON. No Supabase in route.

---

## Already migrated (reference)

- `content-pipeline/posts` (+ by-date-range, [id], schedule, polish, publish, retry, engagement)
- `content-pipeline/ideas` (+ [id], [id]/write)
- `content-pipeline/edit-feedback`
- `content-pipeline/business-context`
- `content-pipeline/creators` (+ [id])
- `content-pipeline/styles` (+ [id], extract, extract-from-url)
- `content-pipeline/scrape-searches` (+ [id] DELETE)
- `content-pipeline/quick-write`
- `jobs/[id]`
- `admin/learning`
- `thumbnail/generate`
- `content-pipeline/performance` (+ patterns)
- `content-pipeline/inspiration` (+ sources)
- `content-pipeline/scraper` (+ extract-template)
- `leads` (+ export)
- `competitors` (+ [id])
- **Step 3 (top-level folders):** `keys` (+ [id]), `user` (username, defaults), `catalog`, `ab-experiments` (+ [id], suggest), `landing-page` (quick-create)
- **Step 4 (top-level folders):** `team` (+ [id] GET/DELETE, [id]/activity), `teams` (+ PATCH, profiles, profiles/[id]), `brand-kit` (+ upload), `wizard-draft`, `stripe` (checkout, webhook)
- **Step 5 (top-level folders):** `analytics` (overview, engagement, email, funnel/[id]), `swipe-file` (lead-magnets, posts, submit), `external-resources` (+ [id]), `qualification-forms` (+ [formId], [formId]/questions, [formId]/questions/[qid]), `admin` (prompts, prompts/[slug], restore, import-subscribers)
- **Step 6 (top-level folders):** `email-sequence` (generate, [leadMagnetId] GET/PUT, [leadMagnetId]/activate), `libraries` (+ [id], [id]/items, [id]/items/[itemId], [id]/items/reorder), `settings` (team-domain + verify, team-email-domain + verify + from-email, whitelabel, custom-domain), `integrations` (resend/settings, email-marketing/connected, email-marketing/disconnect, gohighlevel/disconnect), `linkedin` (schedule, automations, automations/[id])
- **Step 7 (content-pipeline + webhooks):** `content-pipeline/planner` (GET, POST, [id] GET/PATCH/DELETE, generate, approve), `content-pipeline/templates` (GET, POST, [id] GET/PATCH/DELETE, seed, bulk-import, match), `content-pipeline/schedule/slots` (GET, POST, [id] PATCH/DELETE), `content-pipeline/transcripts` (GET, POST, DELETE, [id] GET/PATCH, upload, [id]/reprocess), `webhooks` (GET, POST, [id] PUT/DELETE/POST test)

---

## Not migrated (by logical folder)

### Content-pipeline

| Folder | Routes | Tables / notes |
|--------|--------|-----------------|
| ~~content-pipeline/quick-write~~ | ✅ migrated | |
| ~~content-pipeline/scrape-searches~~ | ✅ migrated | |
| ~~content-pipeline/planner~~ | ✅ migrated | cp_* |
| ~~content-pipeline/templates~~ | ✅ migrated | cp_* |
| ~~content-pipeline/schedule/slots~~ | ✅ migrated | cp_* |
| ~~content-pipeline/transcripts~~ | ✅ migrated | cp_* |
| ~~content-pipeline/performance~~ | ✅ migrated | |
| ~~content-pipeline/inspiration~~ | ✅ migrated | |
| ~~content-pipeline/scraper~~ | ✅ migrated | |

### Email & sequences

| Folder | Routes | Tables / notes |
|--------|--------|-----------------|
| ~~email/broadcasts~~ | ✅ migrated | email |
| ~~email/flows~~ | ✅ migrated (+ [id], generate, contacts, steps, [stepId]) | email |
| ~~email/subscribers~~ | ✅ migrated (+ [id], import) | email |
| ~~email/generate-daily~~ | ✅ migrated | email |
| ~~email/unsubscribe~~ | ✅ migrated | email |
| ~~email-sequence/generate~~ | ✅ migrated | |
| ~~email-sequence/[leadMagnetId]~~ | ✅ migrated (+ activate) | |

### Admin & learning

| Folder | Routes | Tables / notes |
|--------|--------|-----------------|
| ~~admin/learning~~ | ✅ migrated | |
| ~~admin/prompts~~ | ✅ migrated | |
| ~~admin/import-subscribers~~ | ✅ migrated | |

### Core app

| Folder | Routes | Tables / notes |
|--------|--------|-----------------|
| ~~team~~ | ✅ migrated | |
| ~~teams~~ | ✅ migrated | |
| ~~libraries~~ | ✅ migrated (+ [id], items, items/[itemId], reorder) | libraries |
| ~~keys~~ | ✅ migrated | |
| ~~jobs/[id]~~ | ✅ migrated | |
| ~~user/username~~ | ✅ migrated | |
| ~~user/defaults~~ | ✅ migrated | |
| ~~wizard-draft~~ | ✅ migrated | |

### Settings & integrations

| Folder | Routes | Tables / notes |
|--------|--------|-----------------|
| ~~settings/team-domain~~ | ✅ migrated (+ verify) | - |
| ~~settings/team-email-domain~~ | ✅ migrated (+ verify, from-email) | - |
| ~~settings/whitelabel~~ | ✅ migrated | - |
| ~~settings/custom-domain~~ | ✅ migrated | - |
| integrations/email-marketing | ~~connected, disconnect~~ ✅; connect, verify, tags, lists | - |
| ~~integrations/resend/settings~~ | ✅ migrated | - |
| integrations/gohighlevel | ~~disconnect~~ ✅; verify, status, connect | - |
| ~~linkedin~~ | connect, disconnect; ~~schedule, automations, automations/[id]~~ ✅ migrated | - |

### Lead magnets & external

| Folder | Routes | Tables / notes |
|--------|--------|-----------------|
| external/lead-magnets | ~~GET, POST, [id]~~ ✅ migrated; [id]/extract, [id]/generate, [id]/write-posts, [id]/stats, ideate | - |
| external/funnels | GET + [id]/publish | - |
| external/* | create-lead-magnet, create-account, setup-thankyou, ingest-transcript, import-posts, ingest-knowledge, generate-quiz, review-content, apply-branding | - |
| ~~external-resources~~ | ✅ migrated | |
| ~~qualification-forms~~ | ✅ migrated | |
| ~~swipe-file~~ | ✅ migrated | |

### Analytics & other

| Folder | Routes | Tables / notes |
|--------|--------|-----------------|
| ~~analytics/overview~~ | ✅ migrated | |
| ~~analytics/engagement~~ | ✅ migrated | |
| ~~analytics/email~~ | ✅ migrated | |
| ~~analytics/funnel/[id]~~ | ✅ migrated | |
| ~~ab-experiments~~ | ✅ migrated | |
| ~~competitors~~ | ✅ migrated | |
| ~~leads~~ | ✅ migrated | |
| ~~brand-kit~~ | ✅ migrated (+ upload) | |
| ~~thumbnail/generate~~ | ✅ migrated | |
| ~~catalog~~ | ✅ migrated | |
| ~~stripe~~ | ✅ migrated | |
| webhooks | ~~GET, POST, [id], transcript, resend, attio, gtm-callback, fireflies, grain, dfy, fathom/[userId], subscriber-sync~~ ✅ all migrated | - |
| public/* | ~~view, resource-click, page/[username]/[slug], questions/[id]~~ ✅ migrated; lead, chat | - |
| ~~landing-page/quick-create~~ | ✅ migrated | |

---

## Migration batches (5 folders per step)

- **Step 1 (done):** content-pipeline/quick-write, content-pipeline/scrape-searches, admin/learning, thumbnail/generate, jobs/[id]
- **Step 2 (done):** content-pipeline/performance, content-pipeline/inspiration, content-pipeline/scraper, leads, competitors
- **Step 3 (done):** keys, user, catalog, ab-experiments, landing-page (5 top-level API folders)
- **Step 4 (done):** team, teams, brand-kit, wizard-draft, stripe (5 top-level API folders)
- **Step 5 (done):** analytics, swipe-file, external-resources, qualification-forms, admin (5 top-level API folders)
- **Step 6 (done):** email-sequence, libraries, settings, integrations, linkedin (5 top-level API folders)
- **Step 7 (done):** content-pipeline/planner, content-pipeline/templates, content-pipeline/schedule/slots, content-pipeline/transcripts, webhooks (main + [id])
- **Step 8 (done):** email (broadcasts, flows, subscribers, generate-daily, unsubscribe)
- **Step 9 (done):** webhooks incoming (transcript, resend, attio, gtm-callback, fireflies, grain, dfy, fathom/[userId], subscriber-sync), public (view, resource-click, page/[username]/[slug], questions/[id]), external/lead-magnets (GET, POST, [id])
