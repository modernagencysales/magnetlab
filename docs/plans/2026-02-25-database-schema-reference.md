# Database Schema Reference

**Date:** 2026-02-25
**Database:** Supabase project `qvawbxpijxlwdkolmjrs`
**Stats:** 231 tables, 3,170 columns, 253 foreign keys, 39 enums, 394 RLS policies, ~657k total rows
**Full dump:** `SCHEMA_DUMP.txt` in repo root (6,115 lines — every column, FK, enum, RLS policy, row count)

---

## How to Read This

Tables are grouped by **domain** (which product/feature area they belong to) and **ownership** (which repo writes to them). This tells you where to look when something goes wrong and who's responsible for data integrity.

**Ownership convention:**
- **W** = writes (creates/updates records)
- **R** = reads
- If a repo isn't listed, it doesn't touch that table

---

## 1. Identity & Auth (magnetlab writes)

| Table | Rows | Key Columns | Purpose |
|-------|------|-------------|---------|
| `users` | 84 | id, email, name, is_super_admin | User accounts (linked to NextAuth) |
| `subscriptions` | 84 | user_id→users, stripe_customer_id, status, plan | Stripe subscription state |
| `usage_tracking` | 1 | user_id→users, plan limits | Plan enforcement (free/pro/unlimited) |
| `teams` | 9 | owner_id→users, hide_branding, whitelabel_enabled | Team/workspace |
| `team_members` | 3 | member_id→users, owner_id→users | Team membership |
| `team_profiles` | 13 | team_id→teams, user_id→users, voice_profile | Per-person content voice |
| `api_keys` | 8 | user_id→users, key_hash, key_prefix | MagnetLab API keys |

**RLS:** Most use `auth.uid() = user_id`. Teams use owner-based access.

---

## 2. Lead Magnets & Funnels (magnetlab W, copy-of-gtm-os R)

| Table | Rows | Key Columns | Purpose |
|-------|------|-------------|---------|
| `lead_magnets` | 49 | user_id, team_id, title, archetype (enum), content (jsonb), status (enum) | Core content entities |
| `extraction_sessions` | 137 | user_id, lead_magnet_id, step data | 6-step wizard state |
| `funnel_pages` | 45 | user_id, lead_magnet_id, slug, theme, redirect_trigger, experiment_id | Published funnel/opt-in pages |
| `funnel_page_sections` | 37 | funnel_page_id→funnel_pages, section_type, content, sort_order | Modular page sections |
| `funnel_leads` | 414 | funnel_page_id, email, name, utm_*, qualification_answers | Captured leads |
| `page_views` | 666 | funnel_page_id, viewer_hash, page_type (optin/thankyou) | Analytics |
| `qualification_forms` | 4 | user_id | Survey form containers |
| `qualification_questions` | 56 | form_id, funnel_page_id, question_text, sort_order | Survey questions per funnel |
| `brand_kits` | 45 | user_id, logos (jsonb), default_theme, font_family | Team branding |
| `email_sequences` | 6 | user_id, lead_magnet_id, team_id, sequence config | Drip email campaigns |
| `ab_experiments` | 1 | funnel_page_id, test_field, status, winner_id | A/B testing |
| `libraries` | 1 | user_id, name | Lead magnet collections |
| `library_items` | 1 | library_id, lead_magnet_id | Items in collections |
| `external_resources` | 4 | user_id, url, title | External resources linked to funnels |
| `funnel_integrations` | 1 | funnel_page_id, provider, is_active, settings | Per-funnel ESP/GHL mappings |
| `user_integrations` | 9 | user_id, service, encrypted credentials | Connected 3rd-party accounts |
| `tracking_pixel_events` | 752 | lead_id→funnel_leads, user_id, event_type | Meta pixel tracking |
| `team_domains` | 0 | team_id, domain, vercel_domain_id, status | Custom domains |
| `team_email_domains` | 0 | team_id, domain, resend_domain_id, status | Whitelabel email domains |

**Enums:** `lead_magnet_archetype` (10 types), `lead_magnet_status` (draft/published/scheduled/archived)

---

## 3. Content Pipeline (magnetlab W, cp_ prefix)

The `cp_` prefix identifies all content pipeline tables. Auth is `user_id` based (not tenant-scoped).

| Table | Rows | Key Columns | Purpose |
|-------|------|-------------|---------|
| `cp_call_transcripts` | 43 | user_id, source (grain/fireflies/fathom/paste), raw text | Raw transcripts |
| `cp_knowledge_entries` | 515 | user_id, team_id, transcript_id, knowledge_type, quality_score, topics[], embedding (vector) | AI-extracted insights with pgvector |
| `cp_knowledge_topics` | 1 | user_id, slug, display_name, entry_count, avg_quality, summary | Auto-discovered topic taxonomy |
| `cp_knowledge_tags` | 1,616 | user_id, team_id, tag, usage_count | Tag tracking |
| `cp_knowledge_corroborations` | 0 | entry_id, corroborated_by | Links between corroborating entries |
| `cp_knowledge_sop_matches` | 329 | knowledge_entry_id, sync_run_id | Knowledge → SOP mapping |
| `cp_content_ideas` | 226 | user_id, idea text, score, status | Post-worthy ideas from transcripts |
| `cp_pipeline_posts` | 83 | user_id, team_profile_id, idea_id, style_id, status, content | Posts in autopilot pipeline |
| `cp_posting_slots` | 15 | user_id, team_profile_id, day_of_week, time_of_day | Publishing schedule |
| `cp_post_templates` | 182 | user_id, template structure, embedding (vector) | Reusable post templates |
| `cp_writing_styles` | 1 | user_id, team_profile_id, voice profile | User style profiles |
| `cp_viral_posts` | 5,124 | user_id, creator_id, content, engagement metrics | Scraped viral posts |
| `cp_tracked_creators` | 479 | added_by_user_id, linkedin profile info | Monitored LinkedIn creators |
| `cp_edit_history` | 10 | team_id, profile_id, original_text, edited_text, edit_diff | Edit tracking for style learning |
| `cp_sop_embeddings` | 60 | sop content + vector | SOP embeddings for knowledge matching |
| `cp_playbook_sync_runs` | 2 | sync metadata | Playbook sync history |
| `cp_monitored_competitors` | 0 | user_id, linkedin_url | Competitor profiles for engagement scraping |
| `cp_post_engagements` | 0 | post_id, source, engager details | LinkedIn post engagers |
| `cp_week_plans` | 2 | user_id, weekly content plan | Weekly content planning |

**Key RPCs:** `cp_match_knowledge_entries()` (pgvector cosine similarity), `cp_match_knowledge_entries_v2()` (with filters)

---

## 4. Blueprint Pipeline (leadmagnet-backend W, copy-of-gtm-os R)

| Table | Rows | Key Columns | Purpose |
|-------|------|-------------|---------|
| `prospects` | 1,892 | linkedin_url, scraped_data, analysis_results, scores, report_data, status, error_log | Core prospect records (60+ columns) |
| `posts` | 111,784 | prospect_id→prospects, template_id, content, hook, cta | Generated LinkedIn posts per prospect |
| `templates` | 0 | name, prompt structure | Post generation templates (7 types) |
| `all_leads` | 106,395 | "LinkedIn Link" (PK), name, email, company, enrichment fields | Cold email lead pool (space-capped column names!) |
| `enrichment_runs` | 75 | recipe_id, status, stats | Cold email batch enrichment runs |
| `enrichment_lead_status` | 242,534 | run_id→enrichment_runs, lead data, status | Per-lead enrichment tracking (**no updated_at — order by created_at**) |
| `dead_letter_queue` | 0 | prospect_id→prospects, error details | Failed pipeline events |
| `plusvibe_events` | 0 | webhook event log | PlusVibe webhook event history |
| `settings` | 0 | key/value | Pipeline settings including AI prompts |

**WARNING:** The `all_leads` table has space-in-column-names (e.g., "First Name", "LinkedIn Link"). This is a Clay CSV import artifact. Always use double quotes when referencing these columns in SQL.

**WARNING:** `enrichment_lead_status` is the largest table (242k rows) and has NO `updated_at` column. Always order by `created_at`.

---

## 5. GTM Operations — Leads & Events (gtm-system W)

| Table | Rows | Key Columns | Purpose |
|-------|------|-------------|---------|
| `leads` | 664 | tenant_id, email, full_name, opt_in_data (jsonb), status (enum), processing_step | Unified lead records |
| `events` | 4,793 | lead_id, event_type, metadata | Lead activity audit trail |
| `reply_pipeline` | 939 | lead_id→leads, source, status, blueprint data | Leads awaiting/completed Blueprint delivery |
| `blueprint_requests` | 172 | tenant_id, source, status, linkedin_url, prospect_id | Blueprint generation requests |
| `webhook_events` | 188 | tenant_id, event type, payload | Incoming webhook event log |
| `metrics` | 33 | metric name, value, dimensions | Performance metrics |
| `system_health` | 8 | service, status, last_check | Service health status |
| `audit_log` | 0 | tenant_id, actor, action, resource | Change audit trail |

**GOTCHA:** `leads.source` does NOT exist as a column. Source is in `opt_in_data->>'source'` (values: `organic`, `plusvibe`, `heyreach`).

**Enum:** `lead_status` (pending → scraping → analyzing → scoring → composing → notifying → complete → error → qualified → meeting_booked → meeting_attended)

---

## 6. Cold Email & Enrichment (gtm-system W)

| Table | Rows | Key Columns | Purpose |
|-------|------|-------------|---------|
| `enrichment_recipes` | 3 | tenant_id, slug, steps (jsonb) | Configurable enrichment flows |
| `enrichment_runs` | 75 | recipe_id, status, stats | Batch enrichment run tracking |
| `enrichment_lead_status` | 242,534 | run_id, lead data, status | Per-lead status within runs |
| `enrichment_batch_runs` | 2 | batch config | Batch run definitions |
| `enrichment_batch_leads` | 62 | run_id→enrichment_batch_runs | Leads in a batch |

---

## 7. DM Intelligence (gtm-system W)

| Table | Rows | Key Columns | Purpose |
|-------|------|-------------|---------|
| `dm_contacts` | 30,085 | tenant_id, lead_id→leads, funnel_stage, icp_score, attio_person_id | DM contacts with CRM sync |
| `dm_messages` | 86,140 | tenant_id, contact_id→dm_contacts, content, direction | DM message history |
| `dm_stage_transitions` | 110 | contact_id, from_stage, to_stage | Funnel stage change log |
| `dm_pipeline_config` | 1 | pipeline settings | DM pipeline configuration |

---

## 8. DFY Engagements (gtm-system W, copy-of-gtm-os R)

| Table | Rows | Key Columns | Purpose |
|-------|------|-------------|---------|
| `dfy_engagements` | 5 | tenant_id, client info, status, linear_project_id | DFY client engagements |
| `dfy_deliverables` | 64 | engagement_id→dfy_engagements, type, status | Client deliverables |
| `dfy_activity_log` | 98 | engagement_id, deliverable_id, action | Activity history |
| `dfy_automation_runs` | 24 | engagement_id, deliverable_id, status | Automation execution log |
| `dfy_client_sessions` | 6 | engagement_id, token | Client portal auth sessions |
| `dfy_intake_files` | 0 | engagement_id, file metadata | Client intake file uploads |
| `intro_offers` | 0 | tenant_id, lead_id, status (enum) | $2,500 intro offer tracking |
| `intro_offer_deliverables` | 0 | offer_id, type (enum), status (enum) | Intro offer deliverable items |
| `proposals` | 4 | prospect_id→prospects, content, status | AI-generated proposals |

---

## 9. Infrastructure Provisioning (gtm-system W)

| Table | Rows | Key Columns | Purpose |
|-------|------|-------------|---------|
| `infra_tiers` | 3 | name, stripe_product_id, domains_count, mailboxes_count | Starter/Growth/Scale tiers |
| `infra_provisions` | 3 | tier_id, student_id, status, service_provider | Provisioning jobs |
| `infra_domains` | 0 | provision_id, domain_name, zapmail_domain_id, status | Provisioned domains |

---

## 10. TAM Analysis (gtm-system W)

| Table | Rows | Key Columns | Purpose |
|-------|------|-------------|---------|
| `tam_projects` | 18 | name, icp criteria, status (enum) | TAM analysis projects |
| `tam_companies` | 1,250 | project_id, company data, qualification (enum) | Discovered companies |
| `tam_contacts` | 438 | project_id, company_id, contact data, email_status (enum) | Contacts at qualified companies |
| `tam_job_queue` | 31 | project_id, job_type (enum), status (enum) | TAM job orchestration |

**Enums:** `tam_project_status`, `tam_company_source` (8 sources), `tam_contact_source` (4), `tam_email_status` (5), `tam_job_status` (5), `tam_job_type` (6), `tam_qualification_status` (3)

---

## 11. Bootcamp & LMS (gtm-system W, copy-of-gtm-os R)

| Table | Rows | Key Columns | Purpose |
|-------|------|-------------|---------|
| `bootcamp_students` | 143 | email, name, cohort data, subscription | Student records |
| `bootcamp_cohorts` | 2 | name, status, dates | Cohort definitions |
| `bootcamp_settings` | 24 | key, value (jsonb) | Config (call grants, etc.) |
| `bootcamp_invite_codes` | 2 | code, cohort_id, max_uses, access_level | Enrollment codes |
| `bootcamp_student_progress` | 0 | student progress tracking | Weekly progress |
| `bootcamp_student_survey` | 48 | survey responses | Student surveys |
| `bootcamp_onboarding_checklist` | 0 | checklist items | Onboarding steps |
| `lms_cohorts` | 4 | name, status | LMS cohort definitions |
| `lms_weeks` | 13 | cohort_id, week_number, title | Weekly curriculum |
| `lms_lessons` | 45 | week_id, title, description | Individual lessons |
| `lms_content_items` | 140 | lesson_id, type (enum), content | Lesson content blocks |
| `lms_action_items` | 24 | week_id, title, description | Weekly action items |
| `student_cohorts` | 103 | student_id, cohort_id | Student-cohort mapping |
| `student_tool_credits` | 541 | student_id, tool_id→ai_tools, credits | AI tool usage credits |
| `student_content_grants` | 0 | student_id, content grants | Content access grants |
| `student_redeemed_codes` | 24 | student_id, code | Used invite codes |
| `ai_tools` | 3 | slug, name, system_prompt, model | AI tools available to students |

**Enum:** `lms_content_type` (video, slide_deck, guide, clay_table, ai_tool, text, external_link, credentials, sop_link)

---

## 12. Email System (gtm-system W)

| Table | Rows | Key Columns | Purpose |
|-------|------|-------------|---------|
| `email_flows` | 9 | tenant_id, name, trigger config | Email automation flows |
| `email_flow_steps` | 55 | flow_id, step_number, template, delay | Flow step definitions |
| `email_flow_contacts` | 32 | flow_id, contact email, current_step | Contacts in flows |
| `email_broadcasts` | 1 | tenant_id, subject, content | Broadcast emails |
| `email_sends` | 0 | broadcast_id, recipient, status | Send tracking |
| `email_subscribers` | 390 | email, source, metadata, tags | Unified subscriber list |
| `email_settings` | 1 | reply_to_email, sender config | Email configuration |
| `email_review_queue` | 0 | flow_id, step_id, content | Emails pending review |

---

## 13. Financial & Analytics (gtm-system W)

| Table | Rows | Key Columns | Purpose |
|-------|------|-------------|---------|
| `financial_transactions` | 545 | tenant_id, amount, type, stripe data | Revenue tracking |
| `revenue_events` | 358 | tenant_id, event type, amount | Revenue event log |
| `financial_sync_config` | 1 | tenant_id, sync settings | Stripe sync config |
| `analytics_daily_summary` | 0 | tenant_id, date, channel metrics | Daily metrics rollup |
| `ai_usage_logs` | 23,242 | tenant_id, caller, model, tokens, cost | AI cost tracking |

---

## 14. AI Prompts (gtm-system W, magnetlab R)

| Table | Rows | Key Columns | Purpose |
|-------|------|-------------|---------|
| `ai_prompt_templates` | 14 | slug, category, system_prompt, user_prompt, model, is_active | Managed AI prompts |
| `ai_prompt_versions` | 16 | prompt_id, version, prompts, change_note | Prompt version history |

---

## 15. GC & Affiliates (copy-of-gtm-os W)

| Table | Rows | Key Columns | Purpose |
|-------|------|-------------|---------|
| `gc_members` | 0 | member data | Growth Collective members |
| `affiliates` | 0 | email, slug, code, commission, stripe_connect | Affiliate accounts |
| `referrals` | 0 | affiliate_id, bootcamp_student_id | Referral tracking |
| `affiliate_payouts` | 0 | affiliate_id, amount, stripe_transfer_id | Payout history |

---

## 16. Legacy / Unused (0 rows, candidates for removal)

These tables have 0 rows and appear to be from abandoned features or migrations:

| Table | Likely Origin | Notes |
|-------|---------------|-------|
| `genres`, `creators`, `videos`, `analyses`, `sounds`, `boards`, `board_videos` | Filmmaker/video analysis tool | Completely unused |
| `installations`, `business_contexts` | Old gtm-system features | Replaced |
| `scraped_linkedin_posts`, `week_plans`, `viral_posts`, `posting_slots` | Old content pipeline (non-cp_) | Replaced by cp_ tables |
| `content_pipeline_jobs`, `lead_magnet_jobs` | Old job tracking | Replaced by Trigger.dev |
| `slack_settings`, `slack_notifications` | Slack integration | Unused |
| `loops_lead_syncs`, `notion_connections` | Loops/Notion integrations | Removed |
| `lead_magnet_deployments`, `lead_magnet_optins` | Old lead magnet tracking | Replaced |
| `tenants`, `conductor_tenants`, `tenant_*` (8 tables) | Multi-tenant gtm-system | 0 rows — using hardcoded tenant ID |
| `campaigns`, `resources` | Old GC features | Unused |
| `builder_sessions`, `connectors` | Old builder | Unused |
| `delivery_pipeline` | Old delivery tracking | Replaced by reply_pipeline |
| `dead_leads` | Lead cleanup | Never used |

**~50 tables with 0 rows** — these should be audited and dropped during consolidation.

---

## Enum Quick Reference

| Enum | Values | Used By |
|------|--------|---------|
| `lead_magnet_archetype` | single-breakdown, single-system, focused-toolkit, single-calculator, focused-directory, mini-training, one-story, prompt, assessment, workflow | lead_magnets |
| `lead_magnet_status` | draft, published, scheduled, archived | lead_magnets |
| `lead_status` | pending → scraping → analyzing → scoring → composing → notifying → complete / error / qualified / meeting_booked / meeting_attended | leads |
| `delivery_source` | plusvibe, heyreach, smartlead, form, api | delivery tables |
| `delivery_status` | pending, acknowledged, processing, delivered, error | delivery tables |
| `intro_offer_status` | created → payment_received → provisioning → interview_pending → fulfilling → review → delivered → handed_off | intro_offers |
| `tam_project_status` | draft, sourcing, enriching, complete | tam_projects |
| `tam_job_type` | source_companies, qualify, find_contacts, enrich_emails, check_linkedin, refine_discolike | tam_job_queue |
| `monthly_plan` | starter, growth, scale | infra_provisions |
| `lms_content_type` | video, slide_deck, guide, clay_table, ai_tool, text, external_link, credentials, sop_link | lms_content_items |

---

## Foreign Key Map (Key Relationships)

```
users ──┬── subscriptions
        ├── brand_kits
        ├── lead_magnets ── funnel_pages ──┬── funnel_page_sections
        │                                  ├── funnel_leads
        │                                  ├── page_views
        │                                  ├── qualification_questions
        │                                  └── ab_experiments
        ├── extraction_sessions
        ├── email_sequences
        ├── teams ──┬── team_members
        │           ├── team_profiles ── cp_pipeline_posts
        │           ├── team_domains
        │           └── team_email_domains
        ├── cp_call_transcripts ── cp_knowledge_entries ── cp_knowledge_corroborations
        ├── cp_content_ideas
        ├── cp_posting_slots
        └── user_integrations

tenants ──┬── leads ──┬── dm_contacts ── dm_messages
          │           ├── events
          │           └── reply_pipeline
          ├── enrichment_recipes ── enrichment_runs ── enrichment_lead_status
          ├── dfy_engagements ── dfy_deliverables ── dfy_activity_log
          ├── intro_offers ── intro_offer_deliverables
          ├── webhook_events
          ├── financial_transactions
          └── tam_projects ── tam_companies ── tam_contacts

prospects ── posts
          ── dead_letter_queue
          ── proposals

bootcamp_students ──┬── student_cohorts
                    ├── student_tool_credits
                    ├── student_content_grants
                    └── lms_student_*_progress
```

---

## RLS Patterns

Three main patterns across 394 policies:

1. **User-scoped** (magnetlab tables): `user_id = auth.uid()` — user can only see/edit their own data
2. **Tenant-scoped** (gtm-system tables): `tenant_id = auth_tenant_id()` or service_role check — data isolated per tenant
3. **Public read, service write** (bootcamp, blueprint): `SELECT` allows public, mutations require service_role — frontend reads freely, backend writes via service key

**Security concern noted in tenant isolation audit:** Many gtm-system tables have overly permissive RLS (`qual: true`). The bootcamp tables, blueprint settings, and several operational tables allow unrestricted public access. This should be tightened during consolidation.
