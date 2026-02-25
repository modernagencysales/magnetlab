# What Our Tech Does — Plain English

*Last updated: Feb 25, 2026*

---

## The Simple Version

We have built a machine that does three things:

1. **Finds people who might buy from us** (outreach)
2. **Shows them something impressive that makes them want to talk to us** (the Blueprint)
3. **Turns everything we learn into content that attracts more people** (content engine)

All of this runs mostly on autopilot. Below is what each piece does.

---

## The Products

### MagnetLab (magnetlab.app)

**What it is:** Our SaaS product. Think of it like Canva, but for creating lead magnets and landing pages.

**What users do with it:**
- Answer questions about their expertise in a step-by-step wizard
- AI generates a lead magnet (a free resource) from their answers
- They get a landing page with an opt-in form
- When someone fills out the form, the lead is captured and delivered the resource
- They can set up email sequences that automatically follow up

**What it also does behind the scenes:**
- Listens to our sales call recordings (Grain, Fireflies, Fathom)
- AI pulls out insights and knowledge from every call
- Stores all that knowledge in a searchable "AI Brain"
- Every night at 2 AM, the AI writes LinkedIn posts using that knowledge
- Posts are queued for review and publishing

**Revenue:** Monthly subscriptions (free / pro / unlimited tiers via Stripe)

---

### The Blueprint (modernagencysales.com)

**What it is:** A personalized analysis we create for prospects. It's our best lead magnet — for our own business.

**How it works:**
1. Someone gives us their LinkedIn URL (from a form, cold email reply, or LinkedIn DM)
2. Our system automatically scrapes their LinkedIn profile
3. AI analyzes their authority, content strategy, and positioning
4. AI generates 5-7 personalized LinkedIn post examples for them
5. We send them a link to their personal Blueprint page
6. They see their analysis and think "these people understand me" → they book a call

**This is the core of our outbound.** When someone replies positively to a cold email, the Blueprint is what we send them. It's generated automatically, no human involved.

---

### Cold Email Machine (managed via gtmconductor.com)

**What it is:** Our outbound email system that runs semi-automatically.

**How it works:**
1. We upload a list of leads (from Clay, Apollo, etc.)
2. System enriches them — finds emails using 6 different providers (tries each one until it finds a valid email)
3. Leads get pushed to PlusVibe (email sending) and HeyReach (LinkedIn outreach)
4. When someone replies positively, AI reads the reply and classifies it
5. If positive → automatically generates a Blueprint and sends it back
6. If they book a call → system tracks it and gives them access to tools

**Key numbers to know:**
- 106k leads in the pool
- 242k enrichment records processed
- 939 leads have been through the reply pipeline

---

### Done-For-You Service (DFY)

**What it is:** Our managed service offering. We do the work for the client using the same tools.

**How it works:**
1. Client pays for the intro offer ($2,500)
2. They go through an intake form (uploads, questionnaires)
3. AI processes their intake and generates deliverables
4. A Linear project is created for tracking
5. We review, refine, and deliver: posts, lead magnets, funnels, outreach setup
6. Client sees progress in their portal

---

### Bootcamp & Coaching

**What it is:** Our educational product. Students get curriculum, tools, and SOPs.

**How it works:**
- Students log in to a portal with weekly lessons, action items, and AI tools
- They get credits to use AI tools (post generator, profile optimizer, DM helper)
- Progress is tracked per week
- SOPs (step-by-step guides) live in the Playbook — a separate docs site

**Key number:** 143 bootcamp students

---

## How They All Connect

```
Someone sees our content or gets our cold email
            ↓
They reply or fill out a form
            ↓
System generates a personalized Blueprint
            ↓
They're impressed → book a call
            ↓
Call happens → recording is transcribed
            ↓
AI extracts knowledge from the call
            ↓
Knowledge feeds the content engine
            ↓
Content attracts more people
            ↓
(cycle repeats)
```

This flywheel is the core of the business. Every call makes the content better. Better content brings more leads. More leads mean more calls.

---

## Where Things Live

| What | Where | Think of it as... |
|------|-------|-------------------|
| The SaaS product | magnetlab.app | Our Canva |
| Blueprint pages | modernagencysales.com | Our portfolio / proof of work |
| The backend brain | gtmconductor.com | Our operations center |
| The playbook | dwy-playbook site | Our employee handbook |
| Blueprint generation | leadmagnet-backend | The factory floor |
| Pipeline admin | leadmagnet-admin | The factory control room |

---

## What's Automated vs. Manual

| Process | Automated? | Human involvement |
|---------|-----------|-------------------|
| Cold email sending | ✅ Fully | Upload lead list, review campaigns |
| Reply classification | ✅ Fully | AI reads replies, classifies sentiment |
| Blueprint generation | ✅ Fully | No human needed |
| Blueprint delivery | ✅ Fully | Sent via email reply + LinkedIn DM |
| Call transcription | ✅ Fully | Just record the call |
| Knowledge extraction | ✅ Fully | AI pulls insights from transcripts |
| LinkedIn post writing | ✅ Fully | AI writes from knowledge base |
| Post publishing | ⚠️ Semi | AI writes, human approves |
| Lead magnet creation (SaaS) | ⚠️ Semi | User answers questions, AI generates |
| DFY deliverables | ⚠️ Semi | AI generates, team reviews + refines |
| Bootcamp curriculum | ❌ Manual | Content created by team |
| Email infrastructure setup | ⚠️ Semi | System buys domains + sets up, human triggers |

---

## Key Metrics You Can Ask About

These are things the system tracks that you can ask about at any time:

- **How many leads are in the pipeline?** (664 active leads, 106k in the cold pool)
- **How many Blueprints have been generated?** (1,892 prospects processed)
- **How many posts have been generated?** (111k+ posts across all prospects)
- **How many bootcamp students do we have?** (143)
- **How many DFY engagements are active?** (5)
- **What's in the AI knowledge base?** (515 knowledge entries from 43 transcripts)
- **How much are we spending on AI?** (23k logged API calls with cost tracking)
- **How are cold email enrichments performing?** (75 enrichment runs, 242k lead statuses)
- **How many DM contacts do we have?** (30k contacts, 86k messages tracked)

---

## What We're Planning

We're consolidating from 6 separate code repositories into 1. This doesn't change what the product does — it makes it easier to maintain, faster to build new features, and possible to hire developers who can understand the system quickly.

Think of it like having 6 separate filing cabinets that all reference each other vs. having 1 well-organized filing cabinet. Same files, much easier to find things.

Timeline: ~6 months, phased. No disruption to the live product.
