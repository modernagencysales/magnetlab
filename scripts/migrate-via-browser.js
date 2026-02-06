// =============================================================================
// MagnetLab Lead Magnet Migration Script (Browser Console Version)
// =============================================================================
// Paste this entire script into the browser console at https://www.magnetlab.app
// It uses fetch() which automatically includes your session cookies.
//
// Usage:
//   1. Paste this script into the browser console
//   2. Run: migrate({ dryRun: true })   — preview what will be created
//   3. Run: migrate({ dryRun: false })  — execute for real
//   4. Results are logged and saved to window.migrationResults
// =============================================================================

const CSV_DATA = [
  {
    funnelName: "AI CONTENT GENERATOR",
    leadMagnetName: "Free LinkedIn Content System",
    headline: "How to Turn Sales Calls Into High-Leverage LinkedIn Content",
    subHeadline: "Get a walkthrough of the exact system I use to turn recorded calls into consistent, high-quality posts—without creating content from scratch.",
    slug: "ai-content-generator",
    resourceContent: "Here's your copy of AI Content Generator — get a full walkthrough of the exact system I use to turn my call recordings into top-quality posts.\n\n👉 Watch How it Works: https://storage.googleapis.com/msgsndr/TBBJ77dxW4J2L27gMKFu/media/67992a8a2ee4852fecc0c7fc.mp4\n\n👉 Download the Prompt: https://docs.google.com/document/d/1geVUJlUTwKq4ki8hXUkEBBqbRmyoLzkT7bfNrhlj0Ho",
    resourceUrl: "https://storage.googleapis.com/msgsndr/TBBJ77dxW4J2L27gMKFu/media/67992a8a2ee4852fecc0c7fc.mp4"
  },
  {
    funnelName: "LINKEDIN DM WRITING GPT",
    leadMagnetName: "GPT-Powered LinkedIn DM System",
    headline: "Turn LinkedIn Messages Into Revenue",
    subHeadline: "Use the exact GPT workflow I leveraged to generate $5M in revenue and sell my agency—turn prompts into high-converting DMs without wasting time on guesswork.",
    slug: "linkedin-dm-writing-gpt",
    resourceContent: "Here's your copy of {{contact.lm_source}} — get a full walkthrough of the exact system I use to turn my DM's recordings into sales calls.\n\n👇🏻 Get Access Here\n\nhttps://go.modernagencysales.com/dmgpt-thanks",
    resourceUrl: "https://go.modernagencysales.com/dmgpt-thanks"
  },
  {
    funnelName: "7-Figure Lead Magnet Method",
    leadMagnetName: "(BONUS) The $1M+ Lead Magnet Swipefile",
    headline: "the playbook behind 18,731 leads and a 7-figure exit",
    subHeadline: "(HERE's the full 8-chapter Playbook I Used To Close Over $5,000,000 In Revenue From LinkedIn)",
    slug: "7-figure-lead-magnet-method",
    resourceContent: "Here's your copy of my 7 Figure Lead Magnet Method - get a full walkthrough of the exact system I use to collect thousands of leads through LinkedIn on autopilot.\n\n👉 Get Access Here\n\nhttps://meadow-leader-47c.notion.site/The-7-Figure-Lead-Magnet-Method-28581f7dc52780518d95caa8d8a70e0a",
    resourceUrl: "https://meadow-leader-47c.notion.site/The-7-Figure-Lead-Magnet-Method-28581f7dc52780518d95caa8d8a70e0a"
  },
  {
    funnelName: "Gemini 3: Agency Sales System",
    leadMagnetName: "(BONUS) Gemini 3: Agency Sales System",
    headline: "Gemini 3: Agency Sales System\n(5M Dollar Swipefile)",
    subHeadline: "From prompt libraries to implementation roadmaps, it eliminates time-sinks in lead gen. Built for niche agencies seeking leverage and predictability.",
    slug: "gemini-3-agency-sales-system",
    resourceContent: "Here's your copy of my Gemini 3: Agency Sales System - get a full walkthrough of the exact system I use to collect thousands of leads through LinkedIn on autopilot.\n\n👉 Get Access Here: https://app.getcreator.io/ResourceLibraryPage?id=695c1c7cbfd0842c2b9349fa",
    resourceUrl: "https://app.getcreator.io/ResourceLibraryPage?id=695c1c7cbfd0842c2b9349fa"
  },
  {
    funnelName: "The 60-Day LinkedIn Inbound System",
    leadMagnetName: "The 60-Day LinkedIn Inbound System: 15-Minute Daily SOPs",
    headline: "The 60-Day LinkedIn System That Doubled Alexandre's Agency Revenue",
    subHeadline: "This tactical guide gives busy agency owners a simple 60-day plan with tiny daily actions to own predictable LinkedIn leads. No ghostwriters or hours wasted, just a boring system that generated millions for Tim and now works without constant founder involvement.",
    slug: "60-day-linkedin-inbound-system",
    resourceContent: "Here's your copy of my The 60-Day LinkedIn Inbound System: 15-Minute Daily SOPs - get a full walkthrough of the exact system I use to collect thousands of leads through LinkedIn on autopilot.\n\n👉 Get Access Here\nhttps://app.getcreator.io/PublicLeadMagnet?id=6968b72969c207a8adda97aa",
    resourceUrl: "https://app.getcreator.io/PublicLeadMagnet?id=6968b72969c207a8adda97aa"
  },
  {
    funnelName: "The $5 Million Dollar 'Claude Code' Agency Sales Vault",
    leadMagnetName: "The $5 Million Dollar 'Claude Code' Agency Sales Vault",
    headline: "$5M+ sales vault using Claude Code agents for effortless high-ticket positioning",
    subHeadline: "Taps into the current AI Agent trend to show how founders can turn one 30-minute strategy call into 30 days of high-authority LinkedIn content that specifically targets enterprise-level agency clients.",
    slug: "5m-claude-code-agency-sales-vault",
    resourceContent: "Here's your copy of my The $5 Million Dollar 'Claude Code' Agency Sales Vault - get a full walkthrough of the exact system I use to collect thousands of leads through LinkedIn on autopilot.\n\n👉 Get Access Here https://app.getcreator.io/PromptLibraryPublicPage?id=6968b19d26f4c73d3ee1184f",
    resourceUrl: "https://app.getcreator.io/PromptLibraryPublicPage?id=6968b19d26f4c73d3ee1184f"
  },
  {
    funnelName: "My Entire 7-Figure Agency Sales System Library",
    leadMagnetName: "My Entire 7-Figure Agency Sales System Library",
    headline: "Everything behind Tim's\n7-figure LinkedIn exit now yours",
    subHeadline: "From prompt libraries to full lead magnet methods, this collection delivers Tim's exact playbook. Agency owners escape fragile growth with systems that scale without constant input.",
    slug: "7-figure-agency-sales-system-library",
    resourceContent: "Here's your copy of my My Entire 7-Figure Agency Sales System Library - get a full walkthrough of the exact system I use to collect thousands of leads through LinkedIn on autopilot.\n\n👉 Get Access Here https://courselaunchr.notion.site/My-entire-7-figure-agency-sales-system-into-one-library-for-you-2edf971fc6778095ac7ed13fb14f77a3",
    resourceUrl: "https://courselaunchr.notion.site/My-entire-7-figure-agency-sales-system-into-one-library-for-you-2edf971fc6778095ac7ed13fb14f77a3"
  },
  {
    funnelName: "The $1M+ Lead Magnet Swipefile: 6 Viral Templates That Built an Agency",
    leadMagnetName: "The $1M+ Lead Magnet Swipefile: 6 Viral Templates That Built an Agency",
    headline: "Everything behind Tim's $1M+ lead magnet system now yours",
    subHeadline: "Tired of low-engagement content? Grab the battle-tested 6 templates that drove 10k+ comments and millions in pipeline. Simple copy-paste assets deliver real results for busy founders who want predictable leads without daily grind.",
    slug: "1m-lead-magnet-swipefile",
    resourceContent: "Here's your copy of my The $1M+ Lead Magnet Swipefile - get a full walkthrough of the exact system I use to collect thousands of leads through LinkedIn on autopilot.\n\n👉 Get Access Here\nhttps://unexpected-pyroraptor-13c.notion.site/The-1M-Lead-Magnet-Swipefile-2767aba7ab66812db1a3cae8cf3d9f6b",
    resourceUrl: "https://unexpected-pyroraptor-13c.notion.site/The-1M-Lead-Magnet-Swipefile-2767aba7ab66812db1a3cae8cf3d9f6b"
  },
  {
    funnelName: "$5M LinkedIn Post Database Swipe File",
    leadMagnetName: "$5M LinkedIn Post Database Swipe File",
    headline: "The LinkedIn post database that generated $5M+ without ads",
    subHeadline: "Tim's curated Airtable of proven post structures, including urgency-driven offers and direct-response hooks like \"drop your URL for 3 opportunities.\" Niche agency founders get leverage to post once, get massive engagement, and own inbound leads instead of chasing referrals.",
    slug: "5m-linkedin-post-database",
    resourceContent: "Here's your copy of my $5M LinkedIn Post Database Swipe File - get a full walkthrough of the exact system I use to collect thousands of leads through LinkedIn on autopilot.\n\n👉 Get Access Here\nhttps://airtable.com/appocNnw4hPnnSfOj/pagCxbYPTw5fXeotL?xnOwz=recfli6zmZP89hUZn",
    resourceUrl: "https://airtable.com/appocNnw4hPnnSfOj/pagCxbYPTw5fXeotL?xnOwz=recfli6zmZP89hUZn"
  },
  {
    funnelName: "30-Day LinkedIn Speed-run System",
    leadMagnetName: "Tim Keen's 30-Day LinkedIn Speed-run System",
    headline: "Tim's 30-day system that powered his 7-figure exit",
    subHeadline: "Step-by-step daily actions eliminate scrolling, build authority, spark engagement, and convert comments into calls. Designed for high 6-7 figure owners who need leverage and systems that scale without becoming another full-time job.",
    slug: "30-day-linkedin-speedrun-system",
    resourceContent: "Here's your copy of my 30-day LinkedIn Speed Run - get a full walkthrough of the exact system I use to collect thousands of leads through LinkedIn on autopilot.\n\n👉 Get Access Here https://meadow-leader-47c.notion.site/Tim-Keen-s-30-Day-LinkedIn-Speed-run-System-29581f7dc5278013869fe2596c11487c",
    resourceUrl: "https://meadow-leader-47c.notion.site/Tim-Keen-s-30-Day-LinkedIn-Speed-run-System-29581f7dc5278013869fe2596c11487c"
  },
  {
    funnelName: "Copy My Exact LinkedIn Lead System",
    leadMagnetName: "Copy My Exact LinkedIn Lead System: $4.7 Million in Inbound Revenue",
    headline: "The LinkedIn system that built $4.7M and sold Tim's agency",
    subHeadline: "Busy niche agency owners copy Tim's proven daily loop that turned LinkedIn into a reliable lead machine. Comes loaded with 100+ post templates, niche examples, and prompts to eliminate blank-screen stress and deliver predictable pipeline.",
    slug: "copy-my-linkedin-lead-system",
    resourceContent: "Here's your copy of my My Exact LinkedIn Lead System - get a full walkthrough of the exact system I use to collect thousands of leads through LinkedIn on autopilot.\n\n👉 Get Access Here\n\nhttps://go.modernagencysales.com/thanks-4375-8983-7724",
    resourceUrl: "https://go.modernagencysales.com/thanks-4375-8983-7724"
  },
  {
    funnelName: "LinkedIn Inbound Playbook",
    leadMagnetName: "LinkedIn Inbound Playbook",
    headline: "The playbook behind consistent daily booked calls",
    subHeadline: "From core fundamentals and authority-building profile to content strategies that convert, lead magnets that book calls, and best practices for maximum reach. Agency owners escape fragile growth with a clear, repeatable playbook that runs independently.",
    slug: "linkedin-inbound-playbook",
    resourceContent: "Here's your copy of my LinkedIn Inbound Playbook - get a full walkthrough of the exact system I use to collect thousands of leads through LinkedIn on autopilot.\n\n👉 Get Access Here\n\nhttps://unexpected-pyroraptor-13c.notion.site/LinkedIn-Inbound-Playbook-26d7aba7ab6680919398df9410912571",
    resourceUrl: "https://unexpected-pyroraptor-13c.notion.site/LinkedIn-Inbound-Playbook-26d7aba7ab6680919398df9410912571"
  },
  {
    funnelName: "LinkedIn Foundations Pack",
    leadMagnetName: "LinkedIn Foundations Pack",
    headline: "The foundations pack that generated 18,731 leads",
    subHeadline: "Niche agency owners get 20 fill-in-the-blank headlines, 5 connection scripts, 20 DM openers/follow-ups, inbound reply map, and a dead-simple 7-day checklist. Stop guessing and start conversations that turn into qualified calls fast, no content grind required.",
    slug: "linkedin-foundations-pack",
    resourceContent: "Here's your copy of my LinkedIn Foundations Pack - get a full walkthrough of the exact system I use to collect thousands of leads through LinkedIn on autopilot.\n\n👉 Get Access Here\n\nhttps://courselaunchr.notion.site/How-to-get-18-731-Leads-LinkedIn-Foundations-Pack-2f1f971fc67780b4a688eae03ebe7fe7",
    resourceUrl: "https://courselaunchr.notion.site/How-to-get-18-731-Leads-LinkedIn-Foundations-Pack-2f1f971fc67780b4a688eae03ebe7fe7"
  },
  {
    funnelName: "Top 1% LinkedIn Content Pack",
    leadMagnetName: "How to Write Top 1% LinkedIn Content Pack",
    headline: "Get the pack behind top 1% LinkedIn content",
    subHeadline: "From idea bank and swipe file setup to content pillars, simple writing, audience targeting, and hook mastery. Agency founders get daily prompts and templates to produce consistent, high-engagement content that attracts qualified clients automatically.",
    slug: "top-1-percent-linkedin-content-pack",
    resourceContent: "Here's your copy of How to Write Top 1% LinkedIn Content Pack - get a full walkthrough of the exact system I use to collect thousands of leads through LinkedIn on autopilot.\n\n👉 Get Access Here https://courselaunchr.notion.site/How-to-write-Top-1-LinkedIn-Content-Pack-2f1f971fc677805da8d7c9dcf3fa60a1",
    resourceUrl: "https://courselaunchr.notion.site/How-to-write-Top-1-LinkedIn-Content-Pack-2f1f971fc677805da8d7c9dcf3fa60a1"
  },
  {
    funnelName: "$5M Automatic AI Lead Magnet Machine Pack",
    leadMagnetName: "$5M Automatic AI Lead Magnet Machine Pack",
    headline: "The pack that built a $5M automatic lead magnet machine",
    subHeadline: "Niche agency owners get a 6-day system to create, post, capture, and convert high-value lead magnets using AI. From swipe files (18,731 leads proof), AI generation, auto-email capture, viral post templates, to delivery + conversion, replace fragile referrals with predictable, hands-off inbound that scales without daily effort.",
    slug: "5m-ai-lead-magnet-machine-pack",
    resourceContent: "Here's your copy of my $5M Automatic AI Lead Magnet Machine Pack - get a full walkthrough of the exact system I use to collect thousands of leads through LinkedIn on autopilot.\n\n👉 Get Access Here\n\nhttps://courselaunchr.notion.site/5M-Automatic-AI-Lead-Magnet-Machine-Pack-2f1f971fc6778014bf49f190b8f1c95c",
    resourceUrl: "https://courselaunchr.notion.site/5M-Automatic-AI-Lead-Magnet-Machine-Pack-2f1f971fc6778014bf49f190b8f1c95c"
  },
  {
    funnelName: "Zero to One Offer and Close Pack",
    leadMagnetName: "Zero to One Offer and Close Pack – Turn Personal Brand into Stable MRR",
    headline: "The pack behind easy-sell intro offers and closes",
    subHeadline: "Designed for high 6-7 figure owners still running sales: generate your Zero-to-One offer, promote with authority content, run diagnostic discovery calls, avoid pitfalls, audit prospects, and close confidently. Includes post frameworks for client stories, contrarian takes, and resource lists to build trust and momentum fast.",
    slug: "zero-to-one-offer-and-close-pack",
    resourceContent: "Here's your copy of my Zero to One Offer and Close Pack - get a full walkthrough of the exact system I use to collect thousands of leads through LinkedIn on autopilot.\n\n👉 Get Access Here https://courselaunchr.notion.site/Turn-your-personal-brand-into-a-stable-MRR-business-Zero-to-One-Offer-and-Close-Pack-2f1f971fc6778025a202d006fe2bdc57",
    resourceUrl: "https://courselaunchr.notion.site/Turn-your-personal-brand-into-a-stable-MRR-business-Zero-to-One-Offer-and-Close-Pack-2f1f971fc6778025a202d006fe2bdc57"
  },
  {
    funnelName: "$5M Lead Magnet Swipe File",
    leadMagnetName: "$5M Lead Magnet Swipe File (10,000 Leads)",
    headline: "$5M swipe file with 10,000 leads proof",
    subHeadline: "Access the battle-tested lead magnets that drove 10,000+ opt-ins and filled pipelines for Tim's agency. Includes exact formats, why they went viral, and easy adaptations for your niche — high-leverage tools for busy founders to create magnets that attract qualified prospects fast, no daily creation needed.",
    slug: "5m-lead-magnet-swipe-file",
    resourceContent: "Here's your copy of my $5M Lead Magnet Swipe File (10,000 Leads) - get a full walkthrough of the exact system I use to collect thousands of leads through LinkedIn on autopilot.\n\n👉 Get Access Here https://unexpected-pyroraptor-13c.notion.site/The-1M-Lead-Magnet-Swipefile-2767aba7ab66812db1a3cae8cf3d9f6b",
    resourceUrl: "https://unexpected-pyroraptor-13c.notion.site/The-1M-Lead-Magnet-Swipefile-2767aba7ab66812db1a3cae8cf3d9f6b"
  },
  {
    funnelName: "Build Your Own Private AI Assistant",
    leadMagnetName: "Build Your Own Private AI Assistant (24/7 on Telegram)",
    headline: "The simple way to run a private AI assistant 24/7 on Telegram",
    subHeadline: "Avoid risky local setups that sleep or expose your laptop. This guide uses Orgo.ai's agent computers for a secure, cloud-based AI that never turns off, handles research/writing/planning/thinking, and chats privately via Telegram. No AWS hassle, no server management, stupid simple for busy founders wanting leverage without daily babysitting.",
    slug: "build-your-own-ai-assistant",
    resourceContent: "Here's your copy of my Build Your Own Private AI Assistant (24/7 on Telegram) - get a full walkthrough of the exact system I use to collect thousands of leads through LinkedIn on autopilot.\n\n👉 Get Access Here\n\nhttps://courselaunchr.notion.site/Tim-s-ClawdBot-GTM-Agent-Installation-Guide-2f4f971fc677807080a9f62faf169076",
    resourceUrl: "https://courselaunchr.notion.site/Tim-s-ClawdBot-GTM-Agent-Installation-Guide-2f4f971fc677807080a9f62faf169076"
  },
  {
    funnelName: "Claude Code Training",
    leadMagnetName: "Claude Code Training",
    headline: "Learn to build AI-powered tools that actually run your business.",
    subHeadline: "Claude Code's interactive platform teaches you coding, prompting, and deployment by building projects you can use immediately. Hands-on, results-driven, no fluff.",
    slug: "claude-code-training",
    resourceContent: "Here's your copy of my Claude Code Training - get a full walkthrough of the exact system I use to collect thousands of leads through LinkedIn on autopilot.\n\n👉 Get Access Here\n\nhttps://claude-code-training-ebon.vercel.app/",
    resourceUrl: "https://claude-code-training-ebon.vercel.app/"
  }
];

// Helper: delay between requests
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Helper: make API request
async function apiCall(method, path, body = null) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(path, opts);
  const data = await res.json();

  if (!res.ok) {
    throw new Error(`${method} ${path} → ${res.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

// Main migration function
async function migrate({ dryRun = true } = {}) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  MagnetLab Migration — ${dryRun ? 'DRY RUN' : 'LIVE RUN'}`);
  console.log(`  ${CSV_DATA.length} lead magnets to create`);
  console.log(`${'='.repeat(60)}\n`);

  const results = [];
  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < CSV_DATA.length; i++) {
    const row = CSV_DATA[i];
    const rowNum = i + 1;

    console.log(`\n[${rowNum}/${CSV_DATA.length}] ${row.leadMagnetName}`);
    console.log(`  Slug: ${row.slug}`);

    if (dryRun) {
      console.log(`  [DRY RUN] Would create lead magnet: "${row.leadMagnetName}"`);
      console.log(`  [DRY RUN] Would create funnel with slug: "${row.slug}"`);
      console.log(`  [DRY RUN] Would publish funnel`);
      results.push({
        row: rowNum,
        name: row.leadMagnetName,
        slug: row.slug,
        status: 'dry-run',
      });
      continue;
    }

    try {
      // Step 1: Create Lead Magnet
      console.log(`  Creating lead magnet...`);
      const lmData = await apiCall('POST', '/api/lead-magnet', {
        title: row.leadMagnetName,
        archetype: 'focused-toolkit',
        concept: {
          title: row.leadMagnetName,
          painSolved: row.headline,
          deliveryFormat: 'toolkit',
        },
        extractedContent: {
          title: row.leadMagnetName,
          format: 'toolkit',
          structure: [{
            sectionName: 'Overview',
            contents: [row.subHeadline],
          }],
          nonObviousInsight: '',
          personalExperience: '',
          proof: '',
          commonMistakes: [],
          differentiation: '',
        },
      });

      const leadMagnetId = lmData.leadMagnet?.id || lmData.id;
      if (!leadMagnetId) {
        throw new Error('No lead magnet ID returned: ' + JSON.stringify(lmData));
      }
      console.log(`  ✓ Lead magnet created: ${leadMagnetId}`);

      // Step 2: Create Funnel Page
      await sleep(300);
      console.log(`  Creating funnel page...`);
      const funnelData = await apiCall('POST', '/api/funnel', {
        leadMagnetId: leadMagnetId,
        targetType: 'lead_magnet',
        slug: row.slug,
        optinHeadline: row.headline,
        optinSubline: row.subHeadline,
        optinButtonText: 'Get Free Access',
        thankyouHeadline: "You're in! Access your resource below.",
        theme: 'dark',
        primaryColor: '#6366f1',
        backgroundStyle: 'gradient',
      });

      const funnelId = funnelData.funnel?.id || funnelData.id;
      if (!funnelId) {
        throw new Error('No funnel ID returned: ' + JSON.stringify(funnelData));
      }
      console.log(`  ✓ Funnel created: ${funnelId}`);

      // Step 3: Publish
      await sleep(300);
      console.log(`  Publishing...`);
      const publishData = await apiCall('POST', `/api/funnel/${funnelId}/publish`, {
        publish: true,
      });

      const publicUrl = publishData.publicUrl || publishData.funnel?.publicUrl || 'N/A';
      console.log(`  ✓ Published: ${publicUrl}`);

      results.push({
        row: rowNum,
        name: row.leadMagnetName,
        slug: row.slug,
        leadMagnetId,
        funnelId,
        publicUrl,
        status: 'success',
      });
      successCount++;

    } catch (err) {
      console.error(`  ✗ ERROR: ${err.message}`);
      results.push({
        row: rowNum,
        name: row.leadMagnetName,
        slug: row.slug,
        status: 'error',
        error: err.message,
      });
      errorCount++;
    }

    // Delay between rows
    if (!dryRun && i < CSV_DATA.length - 1) {
      await sleep(500);
    }
  }

  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  MIGRATION ${dryRun ? 'DRY RUN' : ''} COMPLETE`);
  console.log(`  Success: ${successCount} | Errors: ${errorCount} | Total: ${CSV_DATA.length}`);
  console.log(`${'='.repeat(60)}\n`);

  // Print results table
  console.table(results.map(r => ({
    '#': r.row,
    Name: r.name.substring(0, 40),
    Slug: r.slug,
    Status: r.status,
    'Lead Magnet ID': r.leadMagnetId || '-',
    'Funnel ID': r.funnelId || '-',
    'Public URL': r.publicUrl || '-',
  })));

  // Save to window for later access
  window.migrationResults = results;
  console.log('\nResults saved to window.migrationResults');

  return results;
}

// Print instructions
console.log('Migration script loaded!');
console.log('');
console.log('Commands:');
console.log('  migrate({ dryRun: true })   — Preview (no changes)');
console.log('  migrate({ dryRun: false })  — Execute for real');
console.log('  window.migrationResults     — View results after run');
