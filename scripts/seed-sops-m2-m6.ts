/** Seed M2-M6 SOPs for the GTM Accelerator.
 *  Run: npx tsx scripts/seed-sops-m2-m6.ts */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ─── Types ──────────────────────────────────────────────────────────────────

interface QualityBar {
  check: string;
  severity: 'critical' | 'warning' | 'info';
}

interface Deliverable {
  type: string;
  description: string;
}

interface SopSeed {
  module_id: string;
  sop_number: string;
  title: string;
  content: string;
  quality_bars: QualityBar[];
  deliverables: Deliverable[];
  tools_used: string[];
  version: number;
}

// ─── M2: TAM Building ───────────────────────────────────────────────────────

const M2_SOPS: SopSeed[] = [
  {
    module_id: 'm2',
    sop_number: '2.1',
    title: 'Export LinkedIn Connections',
    version: 1,
    tools_used: ['LinkedIn', 'Google Sheets', 'Clay'],
    content: `## 2.1 Export LinkedIn Connections

### Overview
Export your existing LinkedIn connections to build an initial warm prospect list. This is your fastest path to early pipeline — these people already know you.

### Steps

**Step 1: Request your LinkedIn data export**
1. Go to LinkedIn Settings → Data Privacy → Get a copy of your data
2. Select "Connections" only (not full archive — it's much faster)
3. Click "Request Archive" — you'll receive an email within 10 minutes
4. Download the ZIP file and extract \`Connections.csv\`

**Step 2: Clean the CSV**
1. Open \`Connections.csv\` in Google Sheets
2. Remove connections where:
   - First name or last name is blank
   - Company is blank
   - Connected before 2020 (usually cold)
3. Add a column: \`ICP_Fit\` (leave blank for now — Clay will fill this)

**Step 3: Import to Clay**
1. In Clay, create a new table: "LinkedIn Connections — [Month Year]"
2. Import CSV → map columns: First Name, Last Name, Company, Email Address, Connected On
3. Run the "Enrich from LinkedIn URL" waterfall (Clay will find profile URLs)
4. Add the "ICP Fit Scorer" formula column (uses your ICP definition from M1)

**Step 4: Segment the list**
1. Filter: ICP score ≥ 7 → Tag as \`warm_icp\`
2. Filter: ICP score 4-6 → Tag as \`warm_nurture\`
3. Filter: ICP score < 4 → Tag as \`warm_low\` (deprioritize)
4. Export \`warm_icp\` segment to your outreach sheet

### Time Required
- Export request + download: 15 min
- CSV cleaning: 20-30 min
- Clay import + enrichment: 30-45 min (runs in background)
- Segmentation: 15 min`,
    quality_bars: [
      {
        check: 'CSV exported and cleaned (blanks removed, pre-2020 filtered)',
        severity: 'critical',
      },
      {
        check: 'All connections imported into Clay with ICP scores assigned',
        severity: 'critical',
      },
      {
        check: 'warm_icp segment contains at least 50 contacts',
        severity: 'warning',
      },
      {
        check: 'warm_icp contacts tagged and exported to outreach sheet',
        severity: 'critical',
      },
    ],
    deliverables: [
      {
        type: 'file',
        description: 'Cleaned Connections.csv (blanks + old connections removed)',
      },
      {
        type: 'clay_table',
        description: 'Clay table "LinkedIn Connections — [Month Year]" with ICP scores',
      },
      {
        type: 'segment',
        description: 'warm_icp segment with 50+ contacts ready for outreach',
      },
    ],
  },
  {
    module_id: 'm2',
    sop_number: '2.2',
    title: 'Sales Navigator Search Criteria',
    version: 1,
    tools_used: ['LinkedIn Sales Navigator', 'Clay', 'Google Sheets'],
    content: `## 2.2 Sales Navigator Search Criteria

### Overview
Build a repeatable saved search in Sales Navigator that generates 200-500 qualified prospects per month. The goal is a narrow, high-signal search — not a broad list.

### Steps

**Step 1: Define your search parameters**
Before touching Sales Navigator, write these down:
- **Job titles** (include variations): e.g. "Founder", "CEO", "Managing Director", "Owner"
- **Industries**: Pick 2-3 max (broader = worse signal)
- **Company headcount**: e.g. 1-50 (solo to small team)
- **Geography**: Start with English-speaking markets (US, UK, AU, CA)
- **Seniority level**: Director, VP, C-Suite, Owner

**Step 2: Build the search in Sales Navigator**
1. Go to Lead Filters in Sales Navigator
2. Set filters in this order:
   - Geography → your target regions
   - Industry → your 2-3 industries
   - Job title → paste all title variations (use "OR" logic)
   - Seniority level → check all senior levels
   - Company headcount → set range
3. Review result count — target: 5,000-50,000 leads
   - If > 50,000: add more filters (e.g. keywords, posted on LinkedIn in past 30 days)
   - If < 5,000: broaden geography or add more title variations

**Step 3: Refine with boolean keywords**
In the "Keywords" field, test these refinements:
- Add: "agency" OR "consulting" OR "studio" (if targeting service businesses)
- Exclude: "intern" OR "assistant" OR "student" using NOT logic
- Test "Posted on LinkedIn in past 30 days" — reduces volume but dramatically increases engagement signal

**Step 4: Save the search**
1. Click "Save Search" → name it: "[ICP Name] — [Date]"
2. Set alert frequency: Weekly new leads
3. Screenshot the filter settings for documentation

**Step 5: Export first batch to Clay**
1. Select first 100 results → Export to CSV
2. Import to Clay → run enrichment waterfall:
   - LinkedIn profile URL (Sales Nav CSV includes this)
   - Work email (Prospeo → Hunter.io → Apollo waterfall)
   - Company website
3. Spot-check 10 random rows — do they look like your ICP?

### Time Required
- Filter setup: 30-45 min
- Refinement + spot check: 20 min
- Clay import + enrichment: 30 min (background)`,
    quality_bars: [
      {
        check: 'Saved search result count is between 5,000 and 50,000',
        severity: 'critical',
      },
      {
        check: 'Search saved with weekly alert configured',
        severity: 'warning',
      },
      {
        check: 'Filter settings documented (screenshot or written)',
        severity: 'warning',
      },
      {
        check: 'First 100 exports enriched in Clay with email hit rate ≥ 40%',
        severity: 'critical',
      },
      {
        check: 'Spot-check confirms 7+ out of 10 random rows match ICP definition',
        severity: 'critical',
      },
    ],
    deliverables: [
      {
        type: 'saved_search',
        description: 'Sales Navigator saved search "[ICP Name] — [Date]" with weekly alerts',
      },
      {
        type: 'documentation',
        description: 'Filter settings screenshot or written summary for reproducibility',
      },
      {
        type: 'clay_table',
        description: 'Clay table with first 100 enriched contacts from Sales Navigator',
      },
    ],
  },
  {
    module_id: 'm2',
    sop_number: '2.3',
    title: 'Enrichment Waterfall',
    version: 1,
    tools_used: ['Clay', 'Prospeo', 'Hunter.io', 'Apollo', 'ZeroBounce'],
    content: `## 2.3 Enrichment Waterfall

### Overview
A waterfall runs multiple email-finding tools in sequence, stopping when it finds a valid result. This maximizes email coverage while minimizing cost. Target: 50-60% email coverage on any prospect list.

### Steps

**Step 1: Set up the waterfall in Clay**
In your Clay table, add enrichment columns in this order:

1. **Prospeo** (highest accuracy, costs credits)
   - Formula: \`=PROSPEO(linkedin_url)\`
   - Output: email, confidence score
   - Only runs if: LinkedIn URL exists

2. **Hunter.io** (good for company domains)
   - Formula: \`=HUNTER(first_name, last_name, domain)\`
   - Output: email, score
   - Only runs if: Prospeo returned no result

3. **Apollo** (broad coverage, lower accuracy)
   - Formula: \`=APOLLO_FIND_EMAIL(linkedin_url)\`
   - Output: email
   - Only runs if: Prospeo AND Hunter both returned no result

4. **Waterfall merge column**
   - Formula: \`=COALESCE(prospeo_email, hunter_email, apollo_email)\`
   - This is your final \`email\` column

**Step 2: Validate emails before outreach**
1. Add ZeroBounce validation column:
   - Formula: \`=ZEROBOUNCE(email)\`
   - Output: valid / invalid / catch-all / unknown
2. Filter OUT:
   - Status = invalid (hard bounces — never send)
   - Status = unknown (skip unless you have headroom)
3. Keep: valid + catch-all (catch-all is acceptable for outreach)

**Step 3: Run the enrichment**
1. Select all rows → Run all enrichment columns
2. Monitor credit usage in Clay sidebar — estimate 3-5 credits per row
3. Let enrichment run to completion (can take 30-60 min for 500+ rows)

**Step 4: QA the results**
1. Check email coverage rate: (valid + catch-all) / total rows
   - ≥ 50%: good, proceed
   - 30-50%: acceptable, may need to supplement
   - < 30%: check LinkedIn URL quality — likely a data source issue
2. Scan 20 random emails — do they look like real work emails (not gmail/yahoo)?
3. Export validated list to Google Sheets or directly to your cold email tool

### Time Required
- Waterfall setup (first time): 45-60 min
- Subsequent runs: 10 min setup + enrichment run time
- QA: 20-30 min`,
    quality_bars: [
      {
        check: 'Waterfall has at least 2 email-finding tools in sequence',
        severity: 'critical',
      },
      {
        check: 'ZeroBounce validation run on all found emails',
        severity: 'critical',
      },
      {
        check: 'Invalid emails filtered out before export',
        severity: 'critical',
      },
      {
        check: 'Email coverage rate ≥ 50% on final validated list',
        severity: 'warning',
      },
      {
        check: 'Spot-check confirms emails are work addresses (not personal)',
        severity: 'warning',
      },
    ],
    deliverables: [
      {
        type: 'clay_table',
        description: 'Clay table with waterfall columns (Prospeo → Hunter → Apollo → merge)',
      },
      {
        type: 'validated_list',
        description: 'Exported list with only valid + catch-all emails, invalid removed',
      },
      {
        type: 'metric',
        description: 'Email coverage rate documented (valid + catch-all / total)',
      },
    ],
  },
  {
    module_id: 'm2',
    sop_number: '2.4',
    title: 'Activity-Based Segmentation',
    version: 1,
    tools_used: ['LinkedIn', 'Sales Navigator', 'Clay', 'Google Sheets'],
    content: `## 2.4 Activity-Based Segmentation

### Overview
Activity-based segmentation identifies prospects showing buying signals — people who are actively engaging on LinkedIn, hiring, or posting about relevant pain points. These contacts convert 2-3x better than cold lists.

### Steps

**Step 1: Define your activity signals**
Choose 2-3 signals that correlate with your ICP being "in market":
- **Posted on LinkedIn in past 30 days** (high intent = they're active)
- **Hired for a relevant role** (e.g. hiring "head of sales" = growth signal)
- **Engaged with competitors' content** (captured via Sales Nav alerts)
- **Posted about a specific pain point** (keyword tracking in Sales Nav)
- **Recently promoted** (LinkedIn career event = opportunity window)

**Step 2: Build activity filters in Sales Navigator**
1. Open your saved search from SOP 2.2
2. Add activity-based filters:
   - "Posted on LinkedIn": check "Past 30 days"
   - "Changed jobs": check "Past 90 days" (if role change is your signal)
   - "Mentioned in news": useful for executives
3. Save as a new search: "[ICP Name] — Active — [Date]"
4. Note result count — this will be smaller (20-40% of base list)

**Step 3: Create Clay signal columns**
For each prospect in Clay, add a signal score:
1. Add column: \`recently_posted\` (boolean — did they post in past 30 days?)
   - Fill from Sales Nav export field or LinkedIn scrape
2. Add column: \`hiring_signal\` (boolean — do they have relevant open roles?)
   - Use Clay's "Find Job Postings" enrichment
3. Add column: \`signal_score\` formula:
   - \`=IF(recently_posted, 3, 0) + IF(hiring_signal, 2, 0) + IF(icp_score >= 8, 2, 0)\`
   - Max score = 7

**Step 4: Segment by signal score**
| Score | Segment | Action |
|-------|---------|--------|
| 6-7 | Hot | Prioritize for personalized LinkedIn DM + cold email same week |
| 4-5 | Warm | Cold email sequence + LinkedIn connection request |
| 0-3 | Cold | Standard cold email sequence only |

**Step 5: Build your weekly pipeline pull**
Every Monday:
1. Run Sales Nav alert for new matches from past 7 days
2. Import to Clay → run enrichment
3. Score all new rows → segment
4. Add "Hot" segment to this week's outreach queue

### Time Required
- Initial setup: 45-60 min
- Weekly pull: 15-20 min`,
    quality_bars: [
      {
        check: 'At least 2 activity signals defined and documented',
        severity: 'critical',
      },
      {
        check: 'Activity-filtered Sales Navigator search saved separately from base search',
        severity: 'warning',
      },
      {
        check: 'signal_score column in Clay with documented formula',
        severity: 'critical',
      },
      {
        check: 'Hot/Warm/Cold segments created with clear action per segment',
        severity: 'critical',
      },
      {
        check: 'Weekly pull cadence scheduled (calendar block or reminder)',
        severity: 'warning',
      },
    ],
    deliverables: [
      {
        type: 'saved_search',
        description: 'Sales Navigator activity-filtered search "[ICP Name] — Active — [Date]"',
      },
      {
        type: 'clay_table',
        description: 'Clay table with signal_score column and Hot/Warm/Cold tags applied',
      },
      {
        type: 'process',
        description: 'Weekly pull process documented (when, how, what to do with each segment)',
      },
    ],
  },
];

// ─── M3: LinkedIn Outreach ───────────────────────────────────────────────────

const M3_SOPS: SopSeed[] = [
  {
    module_id: 'm3',
    sop_number: '3.1',
    title: 'DM Campaign Setup',
    version: 1,
    tools_used: ['LinkedIn', 'HeyReach', 'Clay', 'Google Sheets'],
    content: `## 3.1 DM Campaign Setup

### Overview
Set up a LinkedIn DM campaign using HeyReach to deliver your lead magnet to warm and cold prospects at scale. Target: 50-100 connection requests per week per LinkedIn account.

### Steps

**Step 1: Prepare your lead list**
1. Export your "warm_icp" and "Hot" segments from Clay (SOP 2.4)
2. Ensure each row has: First Name, Last Name, LinkedIn Profile URL
3. Remove anyone you're already connected with (LinkedIn will reject duplicates)
4. Cap initial batch at 200 contacts per LinkedIn account

**Step 2: Write your connection request message**
Keep it under 300 characters (LinkedIn limit). Formula:
> [Personalization] + [Common ground or observation] + [No pitch]

Example:
> "Hi [First Name] — saw your post about [topic]. Resonated with me. Building in the same space. Would love to connect."

Write 3 variations to A/B test. DO NOT mention your lead magnet in the connection request.

**Step 3: Write your follow-up DM sequence**
After connection is accepted (HeyReach sends this automatically):

**Message 1 (Day 1 after connect):**
> "Thanks for connecting, [First Name]! Quick question — are you actively trying to [solve their pain point] right now, or is it more of a back-burner thing?"

**Message 2 (Day 3, only if no reply):**
> "Hey [First Name] — I put together a [lead magnet type] that covers [specific outcome]. Happy to send it over if useful. No strings."

**Message 3 (Day 7, only if no reply):**
> "Last one, I promise 😄 — if [lead magnet] isn't relevant, no worries at all. But if [pain point] is something you're working through, it might save you some time. Just say the word."

**Step 4: Configure the campaign in HeyReach**
1. Create new campaign → "LinkedIn Outreach — [ICP Name] — [Date]"
2. Add your LinkedIn account(s)
3. Upload lead list CSV
4. Set message sequence: Connection Request → Message 1 → Message 2 → Message 3
5. Set delays: Day 0 (connection), Day 1, Day 3, Day 7
6. Set daily limits: 20 connection requests/day, 30 follow-ups/day
7. Set schedule: Weekdays only, 8am-6pm in prospect timezone

**Step 5: Launch and monitor**
1. Launch campaign → watch for the first 48 hours
2. Check acceptance rate: target ≥ 25%
   - If < 20%: rewrite connection request message
3. Check reply rate: target ≥ 10% of accepted connections
   - If < 5%: rewrite Message 1 (the opener question)

### Time Required
- List prep: 20 min
- Message writing: 30-45 min
- HeyReach setup: 20 min
- Total: ~1.5 hours`,
    quality_bars: [
      {
        check: 'Connection request message is under 300 characters and contains no pitch',
        severity: 'critical',
      },
      {
        check: 'At least 2 connection request variants created for A/B testing',
        severity: 'warning',
      },
      {
        check: 'Full 3-message follow-up sequence written and loaded into HeyReach',
        severity: 'critical',
      },
      {
        check: 'Daily limits configured: ≤ 20 connection requests/day per account',
        severity: 'critical',
      },
      {
        check: 'Campaign acceptance rate ≥ 25% after first 50 connection requests',
        severity: 'warning',
      },
    ],
    deliverables: [
      {
        type: 'heyreach_campaign',
        description: 'Active HeyReach campaign with 3-step sequence running',
      },
      {
        type: 'copy',
        description: '3 connection request variants + 3-message follow-up sequence documented',
      },
      {
        type: 'metric',
        description: 'Acceptance rate and reply rate tracked after first 50 sends',
      },
    ],
  },
  {
    module_id: 'm3',
    sop_number: '3.2',
    title: 'Second Message Strategy',
    version: 1,
    tools_used: ['LinkedIn', 'HeyReach', 'Google Sheets'],
    content: `## 3.2 Second Message Strategy

### Overview
Most DM conversations die after the first exchange because there's no clear next step. This SOP covers how to handle replies, deliver your lead magnet, and move conversations toward a booked call without being pushy.

### Steps

**Step 1: Set up your reply routing**
In HeyReach, configure keyword-based routing:
- Keywords: YES, SURE, SEND IT, INTERESTED, PLEASE, LOVE TO, GO AHEAD
- Action: Tag as "interested" + pause sequence + notify you via email/Slack

When you see a "interested" tag:
1. Manually send the lead magnet link with a personal note
2. Log in your tracking sheet: Name, Date, Lead Magnet Sent

**Step 2: The lead magnet delivery message**
After someone says yes, send within 4 hours:

> "Here you go, [First Name] 🙌 — [lead magnet URL]
>
> The [specific section] is the most useful part for people dealing with [pain point]. Takes about 10 min to go through.
>
> Curious — what's your current approach to [related topic]?"

Key elements:
- Send the link immediately (don't make them wait)
- Point to the most valuable section (shows you know the content)
- End with a question to keep the conversation going

**Step 3: The follow-up after delivery (Day 2-3)**
If they haven't replied after receiving the lead magnet:

> "Hey [First Name] — just checking in. Did you get a chance to look at [lead magnet]?
>
> The part about [specific insight] tends to spark the most questions. Happy to dig into that with you if useful."

**Step 4: The soft call pivot (Day 5-7)**
If they've engaged but haven't committed to a call:

> "[First Name] — based on what you've shared, I think there's a real opportunity here for [specific outcome].
>
> Would it make sense to hop on a 20-min call to see if we can map that out for your situation? No pitch — just want to understand if what we do is even relevant."

**Step 5: Track and optimize**
In your tracking sheet, log:
| Column | Track |
|--------|-------|
| Date Connected | When they accepted |
| Date LM Sent | When lead magnet delivered |
| Reply (Y/N) | Did they reply after LM? |
| Call Booked (Y/N) | Did they book? |
| Notes | Any context |

Weekly: calculate LM-to-Call conversion rate. Target: ≥ 15%

**Step 6: Handle the "not right now" replies**
When someone says "not a fit" or "not the right time":

> "No worries at all, [First Name] — appreciate the honest answer. If anything changes on your end or you ever want to chat about [topic], feel free to reach back out. Good luck with [their current focus]!"

Then add them to a 6-month re-engagement sequence in HeyReach.

### Time Required
- Reply handling: 10-15 min/day
- Weekly tracking review: 20 min`,
    quality_bars: [
      {
        check: 'HeyReach keyword routing configured for positive reply detection',
        severity: 'critical',
      },
      {
        check: 'Lead magnet delivery message written and saved as template',
        severity: 'critical',
      },
      {
        check: 'Follow-up sequence (Day 2-3 + Day 5-7) documented and ready',
        severity: 'critical',
      },
      {
        check: 'Tracking sheet active with date, LM sent, reply, and call booked columns',
        severity: 'warning',
      },
      {
        check: 'LM-to-Call conversion rate tracked weekly (target ≥ 15%)',
        severity: 'warning',
      },
    ],
    deliverables: [
      {
        type: 'copy',
        description: 'LM delivery message + Day 2-3 follow-up + Day 5-7 call pivot templates',
      },
      {
        type: 'heyreach_config',
        description: 'Keyword routing rules configured for positive reply detection',
      },
      {
        type: 'tracking_sheet',
        description: 'Google Sheet tracking DM → LM → reply → call conversion funnel',
      },
    ],
  },
];

// ─── M4: Cold Email ──────────────────────────────────────────────────────────

const M4_SOPS: SopSeed[] = [
  {
    module_id: 'm4',
    sop_number: '4.1',
    title: 'Email Infrastructure Setup',
    version: 1,
    tools_used: ['Zapmail', 'Google Workspace', 'PlusVibe', 'Cloudflare'],
    content: `## 4.1 Email Infrastructure Setup

### Overview
Set up cold email infrastructure with dedicated sending domains to protect your primary domain's reputation. Goal: 3-5 sending domains, 2-3 mailboxes per domain, fully warmed before first campaign.

### Steps

**Step 1: Choose and register sending domains**
Register domains that are close variants of your primary domain:
- Primary domain: \`agencyname.com\`
- Sending domains: \`agencynamehq.com\`, \`agencynameltd.com\`, \`tryagencyname.com\`

Rules for sending domains:
- Must NOT be your primary domain (protects main deliverability)
- Should sound professional and related to your brand
- Buy 3-5 domains to distribute sending volume
- Use Zapmail or Namecheap to register

**Step 2: Provision Google Workspace mailboxes**
For each domain, create 2-3 mailboxes:
- \`tim@agencynamehq.com\`
- \`tim.johnson@agencynamehq.com\`
- \`t.johnson@agencynamehq.com\`

Via Zapmail (recommended):
1. Log into Zapmail → Domains → Add Domain
2. Enter domain → follow DNS setup wizard
3. Zapmail will provide SPF, DKIM, DMARC records
4. Add these records in your domain registrar (Cloudflare recommended)
5. Provision mailboxes: Workspace → Add Mailbox for each address

**Step 3: Set up DNS authentication records**
For EACH sending domain, confirm these are set:
- **SPF**: \`v=spf1 include:_spf.google.com ~all\`
- **DKIM**: 2048-bit key (Google Workspace generates this)
- **DMARC**: \`v=DMARC1; p=none; rua=mailto:dmarc@agencyname.com\`
- **MX records**: Google Workspace MX records

Use [MXToolbox](https://mxtoolbox.com) to verify all records pass.

**Step 4: Connect mailboxes to PlusVibe**
1. In PlusVibe → Email Accounts → Add Account
2. Connect each mailbox via IMAP/SMTP or Google OAuth
3. For each account: enable warmup mode (starts automatically)
4. Set sending limit: 30 emails/day initially (increases as warmup progresses)

**Step 5: Warm up all mailboxes**
Warmup period: 14-21 days minimum. DO NOT send cold campaigns during warmup.

Warmup settings in PlusVibe:
- Daily ramp: start at 5 emails/day, increase by 5/day each week
- Warmup reply rate: 40%+ (PlusVibe handles this with warmup network)
- Monitor spam placement: should be < 5% in spam folder

After 21 days, check health score in PlusVibe → should be ≥ 80.

### Time Required
- Domain registration: 30 min
- DNS setup: 45-60 min per domain
- Mailbox provisioning: 20 min per domain
- PlusVibe setup: 30 min
- Warmup: 14-21 days (passive)`,
    quality_bars: [
      {
        check: 'Minimum 3 sending domains registered (not primary domain)',
        severity: 'critical',
      },
      {
        check: 'SPF, DKIM, and DMARC records verified for ALL sending domains via MXToolbox',
        severity: 'critical',
      },
      {
        check: '2-3 mailboxes provisioned per sending domain',
        severity: 'critical',
      },
      {
        check: 'All mailboxes connected to PlusVibe with warmup enabled',
        severity: 'critical',
      },
      {
        check: 'Warmup period ≥ 14 days complete before first campaign launches',
        severity: 'critical',
      },
      {
        check: 'Health score ≥ 80 in PlusVibe before launching campaign',
        severity: 'warning',
      },
    ],
    deliverables: [
      {
        type: 'infrastructure',
        description: '3-5 sending domains with DNS fully configured (SPF/DKIM/DMARC)',
      },
      {
        type: 'accounts',
        description: '6-15 warmed mailboxes connected to PlusVibe with health scores ≥ 80',
      },
      {
        type: 'documentation',
        description: 'Domain → mailbox mapping spreadsheet with DNS record status',
      },
    ],
  },
  {
    module_id: 'm4',
    sop_number: '4.2',
    title: 'Cold Email Campaign Launch',
    version: 1,
    tools_used: ['PlusVibe', 'Clay', 'Google Sheets', 'Loom'],
    content: `## 4.2 Cold Email Campaign Launch

### Overview
Launch your first cold email campaign using validated leads from your enrichment waterfall (SOP 2.3). Target metrics: ≥ 40% open rate, ≥ 3% reply rate, < 0.5% bounce rate.

### Steps

**Step 1: Finalize your lead list**
1. Export validated leads from Clay (ZeroBounce status: valid or catch-all)
2. Check list has these columns: First Name, Company, Email, Pain Point signal (from enrichment)
3. Remove: anyone who replied to LinkedIn DMs in past 30 days (avoid double-touch)
4. Cap first campaign at 500 leads

**Step 2: Write your email sequence**
3-touch sequence. Each email should stand alone (someone might see Email 2 first).

**Email 1 — The Opener:**
Subject: \`[specific question or observation]\`
> Hi [First Name],
>
> [1-sentence observation about their company or role that shows you did research]
>
> I ask because [your ICP] often struggles with [specific pain point]. We've helped [X clients] fix this by [brief mechanism].
>
> I made a quick [guide/checklist/video] that shows exactly how — happy to send it over if relevant.
>
> Worth a look?

**Email 2 — The Bump (Day 3):**
Subject: \`Re: [previous subject]\`
> [First Name] — just bumping this to the top. Not sure if you saw it.
>
> The [lead magnet] has been really useful for [similar companies]. Thought it might help with [specific thing they're dealing with].
>
> Still happy to send if you want it.

**Email 3 — The Breakup (Day 7):**
Subject: \`Re: [previous subject]\`
> Hey [First Name],
>
> I won't keep following up — clearly the timing isn't right.
>
> If [pain point] becomes a priority down the road, feel free to reach back out.
>
> [Lead magnet URL] is still there if you want it.
>
> Good luck!

**Step 3: Set up the campaign in PlusVibe**
1. PlusVibe → Campaigns → Create Campaign
2. Name: "[ICP Name] — Lead Magnet — [Date]"
3. Upload lead list CSV
4. Add email accounts: rotate across all warmed mailboxes
5. Set sending schedule: Monday-Friday, 7am-5pm (prospect local time)
6. Set sending limits: 30 emails/day per mailbox
7. Enable open tracking + click tracking
8. Add unsubscribe link to footer (required for CAN-SPAM compliance)

**Step 4: Pre-launch checklist**
- [ ] Send test email to yourself — does it land in inbox?
- [ ] Personalization tokens working? ({{first_name}}, etc.)
- [ ] Unsubscribe link present and working
- [ ] Sequence delays set correctly (Day 0, Day 3, Day 7)
- [ ] Sending limits capped (not over 30/mailbox/day)
- [ ] Bounce rate monitoring enabled (auto-pause if > 2%)

**Step 5: Launch + monitor**
1. Launch campaign → check first 24 hours
2. Daily checks for first week:
   - Open rate: should reach 40%+ within 48 hours
   - Bounce rate: pause immediately if > 2%
   - Reply rate: track and categorize (positive/negative/OOO)
3. Positive replies: pause sequence immediately, handle manually within 4 hours

### Time Required
- List prep: 20 min
- Email writing: 45-60 min
- PlusVibe setup: 20 min
- Pre-launch QA: 15 min`,
    quality_bars: [
      {
        check: 'All 3 emails written — each can stand alone without reading previous emails',
        severity: 'critical',
      },
      {
        check: 'Test email lands in inbox (not spam) for at least one mailbox',
        severity: 'critical',
      },
      {
        check: 'Unsubscribe link present in all emails (CAN-SPAM compliance)',
        severity: 'critical',
      },
      {
        check: 'Sending limits set at ≤ 30 emails/day per mailbox',
        severity: 'critical',
      },
      {
        check: 'Open rate ≥ 40% after first 100 sends',
        severity: 'warning',
      },
      {
        check: 'Bounce rate < 0.5% (pause campaign if it exceeds 2%)',
        severity: 'critical',
      },
    ],
    deliverables: [
      {
        type: 'campaign',
        description: 'Active PlusVibe campaign with 3-touch sequence running',
      },
      {
        type: 'copy',
        description: '3-email sequence with subject lines documented in Google Doc',
      },
      {
        type: 'metrics',
        description: 'Campaign dashboard showing open rate, reply rate, bounce rate after Day 3',
      },
    ],
  },
];

// ─── M5: LinkedIn Ads ────────────────────────────────────────────────────────

const M5_SOPS: SopSeed[] = [
  {
    module_id: 'm5',
    sop_number: '5.1',
    title: 'Campaign Manager Setup',
    version: 1,
    tools_used: ['LinkedIn Campaign Manager', 'Canva', 'Google Sheets', 'MagnetLab'],
    content: `## 5.1 Campaign Manager Setup

### Overview
Set up your LinkedIn Campaign Manager account and launch your first lead generation campaign promoting your lead magnet. Budget: start at $30-50/day. Goal: ≤ $80 CPL within 30 days.

### Steps

**Step 1: Account and billing setup**
1. Go to LinkedIn Campaign Manager → Create Account
2. Business name: use your agency/company name
3. Currency: set to your billing currency (cannot change later)
4. Add credit card → set billing threshold at $500 (prevents surprise charges)
5. Link your LinkedIn Company Page (required for Sponsored Content)

**Step 2: Create your Campaign Group**
Campaign Groups organize related campaigns. Create:
- Group name: "Lead Magnet — [Month Year]"
- Budget type: Group-level budget (easier to manage)
- Group budget: $1,000/month to start (you control spend at campaign level)

**Step 3: Create your first campaign**
1. Campaign name: "[ICP Name] — Lead Gen Form — [Date]"
2. Objective: Lead Generation (not awareness — you want conversions)
3. Audience: see SOP 5.2 for detailed targeting setup
4. Ad format: Single Image Ad + Lead Gen Form (best CPL for cold traffic)
5. Budget: $30/day (minimum to exit learning phase is typically $20/day)
6. Schedule: Start date today, no end date (set manually when pausing)
7. Bid strategy: Maximum Delivery (LinkedIn auto-optimizes)

**Step 4: Create your Lead Gen Form**
1. Campaign → Lead Gen Forms → Create
2. Form name: "[Lead Magnet Name] — Request"
3. Headline: "Get the [Lead Magnet Name]" (max 60 chars)
4. Details: 1-2 sentences explaining what they'll learn
5. CTA button: "Download" or "Get the Guide"
6. Fields to collect: First Name, Last Name, Email Address (keep it short — more fields = lower conversion)
7. Privacy policy URL: link to your website privacy page (required)
8. Confirmation message: "Check your email — [Lead Magnet Name] is on its way!"
9. Thank you URL: your lead magnet landing page or thank you page

**Step 5: Create your ad creative**
1. In Canva, create a 1200x627px image (LinkedIn single image ad spec)
2. Ad elements:
   - Headline at top (large text, 4-6 words)
   - Visual showing the lead magnet (mockup, graphic, or your photo)
   - Social proof element (e.g. "Used by 500+ agency owners")
3. Write ad copy in Campaign Manager:
   - Introductory text (above image): 150 chars max for mobile
   - Headline (below image): 70 chars max
   - Description: 100 chars max
4. Create 2-3 variations with different images or headlines

**Step 6: Launch and set up conversion tracking**
1. LinkedIn Insight Tag: install on your thank you page
2. Set up Lead Gen Form submit as a conversion event
3. Launch campaign → check "Active" status in Campaign Manager
4. Set a calendar reminder: check metrics every day for first week

### Time Required
- Account setup: 30 min (one-time)
- Campaign + form setup: 45-60 min
- Creative in Canva: 30-60 min
- Launch + tracking setup: 20 min`,
    quality_bars: [
      {
        check: 'LinkedIn Insight Tag installed on website and confirmed active',
        severity: 'critical',
      },
      {
        check: 'Lead Gen Form has ≤ 4 fields (more fields hurt conversion rate)',
        severity: 'critical',
      },
      {
        check: 'Privacy policy URL present in Lead Gen Form (LinkedIn requirement)',
        severity: 'critical',
      },
      {
        check: 'At least 2 ad creative variations created for A/B testing',
        severity: 'warning',
      },
      {
        check: 'Daily budget set at ≥ $20/day (minimum for algorithm to learn)',
        severity: 'critical',
      },
      {
        check: 'Campaign status confirmed "Active" in Campaign Manager',
        severity: 'critical',
      },
    ],
    deliverables: [
      {
        type: 'campaign',
        description: 'Active LinkedIn campaign with Lead Gen Form and 2+ ad creatives',
      },
      {
        type: 'creative',
        description: '2-3 ad creative variants (1200x627px) with copy documented',
      },
      {
        type: 'tracking',
        description: 'LinkedIn Insight Tag active + Lead Gen Form submit conversion event set up',
      },
    ],
  },
  {
    module_id: 'm5',
    sop_number: '5.2',
    title: 'Audience Targeting',
    version: 1,
    tools_used: ['LinkedIn Campaign Manager', 'Google Sheets'],
    content: `## 5.2 Audience Targeting

### Overview
Set up precise audience targeting in LinkedIn Campaign Manager to reach your ICP. The target audience size is 50,000-300,000 — large enough to learn, small enough to be relevant.

### Steps

**Step 1: Build your primary audience**
In Campaign Manager → Audiences → Create:

**Location** (required first):
- Select countries: start with your primary market (e.g. United States)
- Can expand to UK, Canada, Australia in separate campaigns later

**Company attributes** (add at least 2):
- Company industry: select 2-4 industries that match your ICP
- Company size: select headcount ranges (e.g. 1-10, 11-50)
- (Optional) Company names: if you have a target account list, upload it

**Job experience** (required — this is your most important targeting):
- Job titles: enter 10-20 variations of your ICP's title
  - Include: "Founder", "CEO", "Managing Director", "Owner", "Principal"
  - Avoid: too-junior titles that inflate audience size
- Job seniority: Director, VP, C-Suite, Owner, Partner
- (Optional) Years of experience: 5+ years filters out early-career

**Interests** (add 1-2 for signal):
- LinkedIn Groups: join and target groups your ICP participates in
- Interests: select categories matching your ICP's focus areas

**Step 2: Check audience size**
After each filter addition:
- 50K-300K: ideal range → proceed
- < 50K: audience too small → broaden job titles or geography
- > 300K: too broad → add more filters or tighten job seniority

**Step 3: Create audience exclusions**
Add these exclusions to prevent wasted spend:
- Exclude: your existing customers (if you have a contact list — upload and exclude)
- Exclude: employees of your own company
- Exclude: LinkedIn members who already converted (set up retargeting exclusion)

**Step 4: Save the audience**
1. Click "Save as Matched Audience"
2. Name: "[ICP Name] — Primary — [Date]"
3. LinkedIn will show "Audience is processing" — wait 24-48 hours for full match

**Step 5: Set up a retargeting audience (after 2 weeks)**
After your campaign has run for 2+ weeks:
1. Create retargeting audience: "Visited lead magnet landing page (past 90 days)"
2. Create a separate, lower-budget retargeting campaign targeting this audience
3. Retargeting CPL is usually 30-50% lower than cold audience

**Step 6: Monitor and optimize targeting**
Weekly, check Campaign Manager → Demographics tab:
- Are impressions going to your target job titles?
- Are impressions going to your target company sizes?
- Identify over-indexed segments (too many impressions on one job title)
- Add exclusions for segments with 0% conversion rate

### Audience Targeting Cheat Sheet

| ICP Type | Recommended Filters |
|----------|---------------------|
| Agency Owners | Job title: Founder/CEO, Company size: 1-50, Industry: Marketing/Advertising |
| SaaS Founders | Job title: Founder/CEO/CTO, Company size: 1-200, Industry: Software/Tech |
| Consultants | Seniority: Owner/Partner, Job function: Consulting, Experience: 10+ years |
| Sales Leaders | Job title: VP Sales/Head of Sales, Company size: 50-500 |

### Time Required
- Initial audience setup: 30-45 min
- Audience validation and exclusions: 20 min
- Weekly optimization review: 15 min`,
    quality_bars: [
      {
        check: 'Audience size is between 50,000 and 300,000',
        severity: 'critical',
      },
      {
        check: 'Job seniority filter applied (not just job title)',
        severity: 'critical',
      },
      {
        check: 'Company size filter applied to match ICP headcount range',
        severity: 'warning',
      },
      {
        check: 'Existing customers excluded from campaign targeting',
        severity: 'warning',
      },
      {
        check: 'Audience saved with date in name for reproducibility',
        severity: 'info',
      },
      {
        check: 'Demographics tab reviewed after 48 hours to confirm targeting working',
        severity: 'warning',
      },
    ],
    deliverables: [
      {
        type: 'audience',
        description: 'Saved Campaign Manager audience "[ICP Name] — Primary — [Date]" (50K-300K)',
      },
      {
        type: 'exclusion',
        description: 'Customer exclusion list uploaded and applied to campaign',
      },
      {
        type: 'documentation',
        description: 'Targeting decisions documented (which filters applied and why)',
      },
    ],
  },
];

// ─── M6: Operating System ────────────────────────────────────────────────────

const M6_SOPS: SopSeed[] = [
  {
    module_id: 'm6',
    sop_number: '6.1',
    title: 'Daily GTM Rhythm',
    version: 1,
    tools_used: ['Google Calendar', 'HeyReach', 'PlusVibe', 'LinkedIn', 'Notion'],
    content: `## 6.1 Daily GTM Rhythm

### Overview
The Daily GTM Rhythm is a 30-minute morning routine that keeps all your outreach channels active without becoming a full-time job. Done consistently, this 30-minute routine generates a steady stream of conversations.

### Steps

**Step 1: Block the time (one-time setup)**
1. Open Google Calendar
2. Create a recurring event: "GTM Daily" — Monday to Friday
3. Time: first 30 minutes of your workday (before email, before Slack)
4. Make it non-negotiable — block it like a client meeting

**Step 2: The 30-minute routine**
Follow this sequence every day. Use a timer.

**Minutes 1-10: Reply Management**
1. LinkedIn DMs (HeyReach → Replies tab): respond to any new replies
   - Positive reply: send lead magnet link within this window
   - Negative reply: acknowledge and close politely
   - No reply needed: mark as reviewed
2. Cold email replies (PlusVibe → Unibox): respond to any new replies
   - Same protocol as LinkedIn
3. LinkedIn notifications: check for profile views from your target ICP (opportunity to connect)

**Minutes 11-20: Outreach Execution**
1. Check HeyReach campaign stats → is it running? Any errors?
2. Check PlusVibe campaign stats → open rate OK? Any bounces?
3. Manually send 3-5 personalized LinkedIn connection requests (to your "Hot" signal leads from SOP 2.4)
   - Personalize each request with a specific observation
   - DO NOT use generic templates for manual outreach

**Minutes 21-30: Content + Pipeline**
1. Spend 10 minutes on ONE content action:
   - Write a LinkedIn post (use your Content Pipeline in MagnetLab)
   - Engage with 3-5 posts from your ICP (comment genuinely)
   - OR review and approve a scheduled post draft
2. Log your daily numbers in the tracking sheet (see Step 3)

**Step 3: Set up your daily tracking sheet**
Create a Google Sheet with these columns:
| Date | LI DM Replies | Email Replies | Manual Connects | Positive Replies | LMs Sent | Calls Booked |
|------|--------------|--------------|-----------------|-----------------|----------|--------------|

Fill this in at the end of each GTM session. Takes 2 minutes.

**Step 4: The session-end question**
At the end of every GTM session, ask: "Did I move at least one conversation forward today?"
- YES: mark session as ✓
- NO: review why — did you spend too long on setup? Were there no replies to handle?

### Common Pitfalls
- **Checking email BEFORE GTM session**: Email will derail your focus. GTM first.
- **Letting HeyReach/PlusVibe run without checking**: Sequences can break. Check daily.
- **Skipping weekends entirely**: It's fine to skip, but check for weekend replies on Monday AM
- **Spending 30 min just on replies**: Time-box strictly. Use the timer.

### Time Required
- Setup (one-time): 20 min
- Daily: 30 min`,
    quality_bars: [
      {
        check: 'Recurring calendar block created for GTM Daily (Mon-Fri, first 30 min of day)',
        severity: 'critical',
      },
      {
        check: 'Daily tracking sheet set up with all required columns',
        severity: 'critical',
      },
      {
        check: 'GTM session completed 15+ days in the first month',
        severity: 'critical',
      },
      {
        check: 'Positive replies handled within the same GTM session (not deferred)',
        severity: 'warning',
      },
      {
        check: 'Daily numbers logged in tracking sheet after every session',
        severity: 'warning',
      },
    ],
    deliverables: [
      {
        type: 'calendar',
        description: 'Recurring "GTM Daily" calendar block, Mon-Fri, first 30 min of workday',
      },
      {
        type: 'tracking_sheet',
        description: 'Daily GTM tracking sheet (date, replies, manual connects, LMs sent, calls)',
      },
      {
        type: 'metric',
        description: 'Session completion rate tracked (target: ≥ 15 sessions in first month)',
      },
    ],
  },
  {
    module_id: 'm6',
    sop_number: '6.2',
    title: 'Weekly Review',
    version: 1,
    tools_used: ['Google Sheets', 'HeyReach', 'PlusVibe', 'LinkedIn Campaign Manager', 'Notion'],
    content: `## 6.2 Weekly Review

### Overview
The Weekly Review is a 60-minute Friday session where you analyze the past week's numbers, identify what's working and what isn't, and set 3 priorities for the coming week. This is the compounding mechanism that improves your GTM system over time.

### Steps

**Step 1: Block the time (one-time setup)**
1. Create a recurring calendar event: "GTM Weekly Review"
2. Time: Friday, 2:00-3:00 PM (or your equivalent end-of-week slot)
3. This event is sacred — reschedule client calls around it, not the other way

**Step 2: Pull your weekly numbers (15 min)**
Open each platform and pull these metrics:

**LinkedIn (HeyReach):**
- Connection requests sent this week
- Acceptance rate (accepted / sent)
- Replies received
- Lead magnets delivered

**Cold Email (PlusVibe):**
- Emails sent this week
- Open rate
- Reply rate
- Positive replies
- Bounces

**LinkedIn Ads (if running):**
- Impressions
- CTR
- Leads generated
- CPL

**Overall Pipeline:**
- Total positive replies (all channels)
- Calls booked
- Proposals sent
- Deals closed (if any)

Record all of these in your Weekly Review sheet (see Step 3).

**Step 3: Set up your Weekly Review sheet**
Create a Google Sheet with one row per week:
| Week | LI Sent | LI Acc% | Email Sent | Email Open% | Email Reply% | Pos Replies | Calls Booked | Notes |
|------|---------|---------|------------|------------|--------------|-------------|--------------|-------|

**Step 4: Run the 5-question review (20 min)**
Answer these 5 questions in writing (Notion or paper):

1. **What worked this week?** (What drove the most positive replies?)
2. **What didn't work?** (Where did performance drop below target?)
3. **What was the biggest blocker?** (Time? Copy? List quality? Something broke?)
4. **What would I do differently?** (Specific change to make next week)
5. **What's the #1 priority for next week?** (One thing that will move the needle most)

**Step 5: Set next week's 3 priorities (15 min)**
Based on your review, set exactly 3 priorities:
1. **Optimize**: something to improve in an existing campaign
2. **Build**: one new asset, list, or sequence to create
3. **Protect**: one system to maintain or fix before it breaks

Write these in Notion or your task manager. Review them on Monday morning before your first GTM session.

**Step 6: Make one improvement (10 min)**
Before you close the review, make ONE small change:
- Rewrite a low-performing email subject line
- Adjust a LinkedIn audience targeting filter
- Pause a campaign with below-target metrics
- Add 50 new leads to a running campaign

Small consistent improvements compound dramatically over 90 days.

### Weekly Review Scorecard
Use this to rate each week:

| Metric | Target | 🟢 Good | 🟡 Warning | 🔴 Act Now |
|--------|--------|---------|-----------|-----------|
| LI Acceptance Rate | 25%+ | ≥25% | 15-25% | <15% |
| Email Open Rate | 40%+ | ≥40% | 25-40% | <25% |
| Email Reply Rate | 3%+ | ≥3% | 1-3% | <1% |
| Positive Replies | 5+/week | ≥5 | 2-4 | <2 |
| Calls Booked | 2+/week | ≥2 | 1 | 0 |

### Time Required
- One-time setup: 20 min
- Weekly: 60 min`,
    quality_bars: [
      {
        check: 'Recurring "GTM Weekly Review" calendar block set (Friday, 60 min)',
        severity: 'critical',
      },
      {
        check: 'Weekly Review sheet set up and populated for at least 2 weeks',
        severity: 'critical',
      },
      {
        check: '5-question review completed in writing (not just mentally)',
        severity: 'warning',
      },
      {
        check: "Next week's 3 priorities written down before closing the review",
        severity: 'critical',
      },
      {
        check: 'At least one improvement made during or immediately after the review',
        severity: 'warning',
      },
      {
        check: 'Weekly scorecard used to identify 🔴 metrics needing immediate action',
        severity: 'warning',
      },
    ],
    deliverables: [
      {
        type: 'calendar',
        description: 'Recurring "GTM Weekly Review" calendar block, Friday 60 min',
      },
      {
        type: 'tracking_sheet',
        description: 'Weekly Review Google Sheet with all channel metrics tracked week-over-week',
      },
      {
        type: 'priorities',
        description: 'Written 3-priority list for next week (optimize, build, protect)',
      },
    ],
  },
];

// ─── Seed Function ────────────────────────────────────────────────────────────

async function seedSops() {
  console.log('Seeding M2-M6 SOPs...\n');

  const allSops = [...M2_SOPS, ...M3_SOPS, ...M4_SOPS, ...M5_SOPS, ...M6_SOPS];
  let upserted = 0;
  let errors = 0;

  for (const sop of allSops) {
    const { error } = await supabase
      .from('accelerator_sops')
      .upsert(sop, { onConflict: 'module_id,sop_number' });

    if (error) {
      console.error(`  ERROR [${sop.sop_number} — ${sop.title}]: ${error.message}`);
      errors++;
    } else {
      console.log(`  Upserted: ${sop.sop_number} — ${sop.title}`);
      upserted++;
    }
  }

  console.log(`\nDone! ${upserted} SOPs upserted, ${errors} errors.`);
}

seedSops().catch(console.error);
