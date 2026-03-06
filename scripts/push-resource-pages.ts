#!/usr/bin/env npx tsx
/**
 * push-resource-pages.ts
 *
 * Writes polished_content to 9 lead magnets that have rich KB coverage.
 * Each resource page is drawn from actual knowledge base entries.
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/push-resource-pages.ts
 */

const SUPABASE_URL = 'https://qvawbxpijxlwdkolmjrs.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_KEY) {
  console.error('ERROR: SUPABASE_SERVICE_ROLE_KEY required');
  process.exit(1);
}

interface PolishedBlock {
  type: string;
  content?: string;
  style?: string;
  title?: string;
  detail?: string;
  number?: number;
  category?: string;
  headers?: string[];
  rows?: string[][];
}

interface PolishedSection {
  id: string;
  sectionName: string;
  introduction: string;
  blocks: PolishedBlock[];
  keyTakeaway: string;
}

interface PolishedContent {
  version: number;
  polishedAt: string;
  title: string;
  heroSummary: string;
  sections: PolishedSection[];
  metadata: { wordCount: number; readingTimeMinutes: number };
}

const pages: { id: string; slug: string; content: PolishedContent }[] = [
  // ─────────────────────────────────────────────────────────────
  // 1. OFFER GENERATOR
  // ─────────────────────────────────────────────────────────────
  {
    id: '526d823b-aad6-49a0-a0d9-419518d2eaa8',
    slug: 'offer-generator',
    content: {
      version: 1,
      polishedAt: new Date().toISOString(),
      title: 'The High-Ticket Offer Playbook: How to Package Services That Sell Themselves',
      heroSummary: 'The intro offer framework that took one agency from zero to $900K/month in 12 months — and how to apply it to your business today.',
      sections: [
        {
          id: 'offer-intro',
          sectionName: 'The Intro Offer: Your Most Powerful Sales Lever',
          introduction: 'Most service businesses try to sell their core offer on the first call. That is the hardest possible sale to make. The intro offer changes the game.',
          blocks: [
            {
              type: 'stat-card',
              content: '$2,500',
              title: 'Sweet Spot Price',
              detail: 'One-time purchase that leads directly into your high-ticket backend service'
            },
            {
              type: 'stat-card',
              content: '1 in 10',
              title: 'Conversion Rate',
              detail: 'Roughly 1 in 10 intro offer clients convert to high-ticket retainers'
            },
            {
              type: 'stat-card',
              content: '$900K/mo',
              title: 'Agency Result',
              detail: '"We will beat your existing conversion rate or it\'s free" — grew to $900K/month in 12 months'
            },
            {
              type: 'paragraph',
              content: 'The intro offer structure: a one-time purchase at ~$2,500 that leads directly into your main high-ticket service. You **guarantee the intro offer** in a way you would never guarantee the core service. You deliver it for ~$500 cost so margins are strong. And you use it as a client filter — only the best intro offer clients get invited to the backend.'
            },
            {
              type: 'callout',
              style: 'info',
              content: 'The fundamental constraint for most businesses is usually not the offer or messaging — it is simply not reaching enough people with your message. The intro offer solves this by lowering the barrier to entry dramatically.'
            }
          ],
          keyTakeaway: 'The intro offer is not a discount. It is a strategic entry point that lets prospects experience your work with minimal risk while you qualify them for your core service.'
        },
        {
          id: 'offer-anatomy',
          sectionName: 'Anatomy of a Winning Intro Offer',
          introduction: 'Not all intro offers are created equal. Here is what separates the ones that print money from the ones that waste your time.',
          blocks: [
            {
              type: 'numbered-item',
              number: 1,
              title: 'Deliver a Tangible Outcome',
              content: 'The intro offer must produce a concrete, measurable result — not a "strategy" or "audit."',
              detail: 'Example: "We will build a landing page that beats your existing conversion rate" is tangible. "We will audit your marketing" is not. The prospect needs to be able to point at something when it is done.',
              category: 'Structure'
            },
            {
              type: 'numbered-item',
              number: 2,
              title: 'Guarantee It Aggressively',
              content: 'You can guarantee intro offers in ways you would never guarantee your core service.',
              detail: 'Because the scope is small and controllable, you can offer money-back or performance guarantees. This removes all risk from the buyer — which is why the $2,500 price point converts so well.',
              category: 'Structure'
            },
            {
              type: 'numbered-item',
              number: 3,
              title: 'Keep Delivery Cost Under $500',
              content: 'If it costs you $500 to deliver a $2,500 offer, your margins fund everything else.',
              detail: 'The non-automatable parts should be high-impact but time-bounded: client interview, strategic concepting, quality review. Everything else (setup, templates, configuration) should be systematized.',
              category: 'Structure'
            },
            {
              type: 'numbered-item',
              number: 4,
              title: 'Design the Upsell Path',
              content: 'The intro offer should naturally reveal the need for your core service.',
              detail: 'When the intro offer is complete, the client should think: "This was great — but I need this at a much larger scale." That is when you present the retainer.',
              category: 'Structure'
            },
            {
              type: 'callout',
              style: 'warning',
              content: '**DFY vs. Education:** When "I don\'t have time" is the dominant objection, it signals the market wants execution, not education. The DFY model removes the implementation burden and commands higher fees.'
            }
          ],
          keyTakeaway: 'A good intro offer has three properties: tangible outcome, aggressive guarantee, and a natural bridge to your core service.'
        },
        {
          id: 'offer-examples',
          sectionName: 'Intro Offer Examples by Industry',
          introduction: 'Here are proven intro offer structures across different service categories.',
          blocks: [
            {
              type: 'table',
              headers: ['Industry', 'Intro Offer', 'Price', 'Backend Service'],
              rows: [
                ['CRO Agency', '"Beat your conversion rate or it\'s free"', '$2,500', '$15K/mo retainer'],
                ['Content Agency', 'Build lead magnet + funnel + 1 week of content', '$2,500', '$5K/mo content retainer'],
                ['LinkedIn Agency', 'Profile optimization + 5 posts + HeyReach setup', '$2,500', '$3K/mo management'],
                ['SEO Agency', 'Technical audit + fix top 10 issues', '$1,500', '$5K/mo ongoing SEO'],
                ['Coaching', '"GTM Sprint" — 4-week implementation program', '$2,500', '$2K/mo mastermind']
              ]
            },
            {
              type: 'paragraph',
              content: 'Notice the pattern: every intro offer produces a **visible deliverable** in a short timeframe. The client walks away with something they can show their team, their board, or their partners. That tangible proof is what sells the backend.'
            },
            {
              type: 'callout',
              style: 'success',
              content: '**SaaS Bundling Opportunity:** Agencies can bundle white-labeled SaaS subscriptions into their intro offer. HeyReach agency plans at $1,000/month for 50 accounts — resell at $100/month per client alongside your service. MagnetLab works the same way. This creates recurring revenue on top of your service fees.'
            }
          ],
          keyTakeaway: 'The best intro offers are industry-specific, outcome-guaranteed, and naturally lead into a higher-value relationship.'
        },
        {
          id: 'offer-qualifying',
          sectionName: 'Qualifying Prospects Before the Offer',
          introduction: 'Not every prospect deserves your intro offer. Here is how to filter fast.',
          blocks: [
            {
              type: 'paragraph',
              content: 'A reliable pre-qualifying signal: can the business owner give a clear, one-sentence description of what they sell and who they sell it to? If they cannot, they are not ready for your help — they need to figure out their own offer first.'
            },
            {
              type: 'list',
              content: '- **Revenue filter**: Are they at the right revenue stage for your service? Each revenue band creates a fundamentally different buyer.\n- **Decision-maker access**: Are you talking to the person who can say yes and pay?\n- **Implementation capacity**: Do they have a team to implement, or will they bottleneck everything?\n- **Problem awareness**: Do they know they have the problem you solve, or do you need to educate them first?'
            },
            {
              type: 'callout',
              style: 'info',
              content: '**CEO Messaging Tip:** Frame your offer as a resource their team can implement — not something they personally need to do. CEOs buy delegation, not more work for themselves.'
            },
            {
              type: 'paragraph',
              content: 'Payment plans remove false disqualification. A $2,500 offer can be broken into 3 installments of $997. Do not disqualify prospects based on geography or perceived budget — let them self-select.'
            }
          ],
          keyTakeaway: 'The intro offer is a filter, not a net. You want clients who are ready to implement and have the authority to buy the backend.'
        },
        {
          id: 'offer-action',
          sectionName: 'Your Next Step: Generate Your Offer',
          introduction: 'Use the AI Offer Generator to build your intro offer structure in minutes.',
          blocks: [
            {
              type: 'paragraph',
              content: 'The AI Offer Generator takes your service, ICP, and pricing context and produces a structured intro offer with guarantee language, pricing suggestions, and upsell path. It draws from the same frameworks that built offers generating $7M+ in revenue.'
            },
            {
              type: 'paragraph',
              content: 'Check your email for the registration link — you get 10 free credits to generate and refine your offer.'
            }
          ],
          keyTakeaway: 'Stop guessing at your offer structure. Let the AI apply proven frameworks to your specific business and audience.'
        }
      ],
      metadata: { wordCount: 0, readingTimeMinutes: 0 }
    }
  },

  // ─────────────────────────────────────────────────────────────
  // 2. NICHE FINDER
  // ─────────────────────────────────────────────────────────────
  {
    id: 'a229b224-252f-4536-9427-dfbda30a968b',
    slug: 'niche-finder',
    content: {
      version: 1,
      polishedAt: new Date().toISOString(),
      title: 'The Niche Selection Framework: How to Pick a Market That Pays',
      heroSummary: 'Almost every client we work with is not niched down enough. Here is the framework for finding the niche that matches your expertise, your personality, and your revenue goals.',
      sections: [
        {
          id: 'niche-fears',
          sectionName: 'The 3 Fears That Keep You Too Broad',
          introduction: 'Niching down is simple in theory and terrifying in practice. Here are the three fears — and why each one is wrong.',
          blocks: [
            {
              type: 'accordion',
              title: 'Fear #1: "What if there aren\'t enough clients?"',
              content: 'The reality is there are more than enough clients in almost any deep niche. A single-service SEO agency serving only addiction treatment centers runs one of the best businesses we have seen — strong niche, strong margins, zero competition from generalists. You do not need millions of prospects. You need 20-50 clients paying premium prices.'
            },
            {
              type: 'accordion',
              title: 'Fear #2: "What if other potential clients don\'t contact me?"',
              content: 'They will not. That is the point. When you niche down, you stop attracting tire-kickers and start attracting buyers. The clients you "lose" are the ones who would have wasted your time anyway. Specificity repels the wrong people and magnetically attracts the right ones.'
            },
            {
              type: 'accordion',
              title: 'Fear #3: "What if this niche doesn\'t work?"',
              content: 'Then you change it. Changing your niche 4-5 times does not matter — nobody is scrutinizing your profile history. The cost of staying too broad is much higher than the cost of testing a niche and pivoting. You can test a niche in 90 days with LinkedIn content alone.'
            },
            {
              type: 'callout',
              style: 'success',
              content: '**The Truth:** Almost every client comes in not niched down enough. They stay one level above where they actually should be. The businesses doing $50K+/month in services have all committed to a specific niche — it is not a coincidence.'
            }
          ],
          keyTakeaway: 'The fear of niching is always bigger than the reality. You can test and pivot quickly — but staying broad is a slow death.'
        },
        {
          id: 'niche-revenue',
          sectionName: 'Revenue Band Niching: The Hidden Dimension',
          introduction: 'Most people niche by industry. The best operators also niche by revenue stage — and it changes everything about your messaging.',
          blocks: [
            {
              type: 'paragraph',
              content: 'Each revenue stage creates a **fundamentally different buyer** with different problems, language, mindset, and priorities. A brand doing $50K/month is barely a business. A brand doing $1M/month is buttoned-up. They speak differently, care about different things, and respond to completely different messaging.'
            },
            {
              type: 'table',
              headers: ['Revenue Stage', 'Mindset', 'What They Buy'],
              rows: [
                ['$0-$10K/mo', 'Survival mode, wearing all hats', 'Quick wins, templates, done-for-you basics'],
                ['$10K-$50K/mo', 'Found product-market fit, scaling up', 'Systems, automation, first hires guidance'],
                ['$50K-$200K/mo', 'Team building, process optimization', 'Strategy, leadership, enterprise tools'],
                ['$200K-$1M/mo', 'Delegation, market expansion', 'High-level advisory, M&A, partnerships'],
                ['$1M+/mo', 'Optimization, exit planning', 'Board-level advisory, efficiency gains']
              ]
            },
            {
              type: 'callout',
              style: 'warning',
              content: '**SaaS Example:** The $2-20M ARR range contains radically different businesses. Identify the specific revenue stage you like working with most, get the best results from, and that your personality and experience fit. Do not try to serve the entire range.'
            }
          ],
          keyTakeaway: 'Industry niching is table stakes. Revenue band niching is what separates good positioning from great positioning.'
        },
        {
          id: 'niche-writing',
          sectionName: 'Writing IS Targeting',
          introduction: 'On LinkedIn, you do not need to explicitly state your niche parameters. Your writing does the targeting for you.',
          blocks: [
            {
              type: 'paragraph',
              content: 'If you think deeply about your ideal client and write content that addresses their specific situation, language, and problems, the right people will self-select. The LinkedIn algorithm uses the words in your post to determine who to show it to — specificity of language determines your audience more than any profile setting.'
            },
            {
              type: 'callout',
              style: 'info',
              content: '**For coaches serving personal/emotional niches:** The targeting mechanism is not job filters — it is writing. Internal specificity (age range, income level, relationship duration) shapes language that magnetically attracts the right people without you ever stating your niche explicitly.'
            },
            {
              type: 'paragraph',
              content: 'A post that says "grow your business" reaches nobody specific. A post that says "how B2B agency owners close 6-figure retainers without cold calling" reaches exactly your ICP. **The niche is in the language, not the label.**'
            },
            {
              type: 'callout',
              style: 'warning',
              content: '**Niche vs. Viral:** For niche businesses, going viral is not necessarily beneficial unless you have a large audience of ideal clients. The goal should be getting the right people\'s attention, not maximum reach.'
            }
          ],
          keyTakeaway: 'Your content is your targeting mechanism. Write for one specific person and the algorithm will find more people like them.'
        },
        {
          id: 'niche-action',
          sectionName: 'Your Next Step: Find Your Niche',
          introduction: 'The AI Niche Finder helps you identify the intersection of your expertise, your ideal client, and market demand.',
          blocks: [
            {
              type: 'paragraph',
              content: 'Answer a few questions about your experience, your best clients, and your revenue goals. The AI will suggest specific niches with rationale for each — including revenue band recommendations and positioning language you can use immediately.'
            },
            {
              type: 'paragraph',
              content: 'Check your email for the registration link — you get 10 free credits to explore different niche options.'
            }
          ],
          keyTakeaway: 'The best niche is the one where your expertise, your personality, and market demand overlap. The AI helps you find that intersection fast.'
        }
      ],
      metadata: { wordCount: 0, readingTimeMinutes: 0 }
    }
  },

  // ─────────────────────────────────────────────────────────────
  // 3. LEAD MAGNET CREATOR
  // ─────────────────────────────────────────────────────────────
  {
    id: '692260f1-f872-42b1-8125-bfbf39953280',
    slug: 'lead-magnet-creator',
    content: {
      version: 1,
      polishedAt: new Date().toISOString(),
      title: 'From Concept to Published Lead Magnet: The Complete Build Guide',
      heroSummary: 'You already have the raw material for multiple lead magnets — you just don\'t realize it. Here is how to extract, package, and publish a lead magnet that converts.',
      sections: [
        {
          id: 'creator-raw',
          sectionName: 'You Already Have the Raw Material',
          introduction: 'Most business owners think they need to create a lead magnet from scratch. The truth is your best content already exists — it just needs packaging.',
          blocks: [
            {
              type: 'paragraph',
              content: 'Sources to mine: **call recordings, onboarding docs, audits, templates, frameworks, swipe files, training materials.** Solution proposals you have sent to prospects, software you have built internally, prompts you use daily, team discussions about process improvements — all of these are lead magnets waiting to be packaged.'
            },
            {
              type: 'callout',
              style: 'success',
              content: '**The Golden Rule:** Your best lead magnet topic is whatever you explain on a sales call that makes your ideal client\'s eyes light up. If they lean in and say "tell me more" — that is your lead magnet.'
            },
            {
              type: 'list',
              content: '- Your client onboarding checklist → "The [Industry] Launch Checklist"\n- Your internal audit template → "The [Problem] Diagnostic Tool"\n- Your team\'s process documentation → "The [Result] Framework"\n- Your sales call talking points → "The [Number] Questions Every [ICP] Should Ask"\n- Your swipe file → "The [Industry] Swipe File Database"'
            }
          ],
          keyTakeaway: 'Stop creating from scratch. Package what you already know and use with clients every day.'
        },
        {
          id: 'creator-format',
          sectionName: 'Choosing Your Format: Static vs. Interactive',
          introduction: 'The format determines whether your lead magnet gets consumed or ignored. Choose based on your ICP, not your preference.',
          blocks: [
            {
              type: 'paragraph',
              content: 'Modern lead magnets should be **small, quick painkillers** — not exhaustive 50-page resources. Your prospect has 2 minutes of attention. The format should deliver value in that window.'
            },
            {
              type: 'table',
              headers: ['Format', 'When to Use', 'Build Time'],
              rows: [
                ['Checklist / Template', 'ICP wants to implement immediately', '1-2 hours'],
                ['Framework / Playbook', 'ICP wants strategic understanding', '2-4 hours'],
                ['Interactive Quiz', 'ICP wants personalized diagnosis', '1-2 hours with AI'],
                ['Custom GPT / AI Tool', 'ICP wants ongoing utility', '30 min with AI'],
                ['Calculator', 'ICP needs to justify ROI internally', '1-2 hours with AI'],
                ['Swipe File', 'ICP wants proven examples to copy', '2-3 hours']
              ]
            },
            {
              type: 'callout',
              style: 'warning',
              content: '**Design Agency Caveat:** Traditional lead magnet approaches (swipe files, templates) do not work well for design agencies because they attract 99% other designers, not potential clients. If your deliverable IS the lead magnet format, choose a different approach.'
            },
            {
              type: 'callout',
              style: 'info',
              content: '**Recommendation-output consistency matters.** If your ideation suggests a quiz but you build a static PDF, you create a frustrating mismatch. The format you promise should be the format you deliver.'
            }
          ],
          keyTakeaway: 'Interactive formats (quizzes, GPTs, calculators) convert higher because they deliver personalized value. Use them when your ICP is tech-savvy.'
        },
        {
          id: 'creator-hero-volume',
          sectionName: 'The Hero + Volume Strategy',
          introduction: 'You need two things: one flagship asset that builds trust, and a high-frequency posting cadence that feeds the algorithm.',
          blocks: [
            {
              type: 'paragraph',
              content: 'The full system is built around two core pillars: **(1) five different lead magnets** and **(2) an enriched ICP list.** The hero lead magnet is your primary conversion asset — the one you are known for. The volume magnets are variations, spin-offs, and complementary resources that keep your content pipeline full.'
            },
            {
              type: 'stat-card',
              content: '25+',
              title: 'Times Reused',
              detail: 'A single high-performing lead magnet can be reposted 25+ times with headline variations'
            },
            {
              type: 'paragraph',
              content: 'Small headline changes can significantly impact performance. Include concrete numbers, position as case studies, or mention a specific industry. The same lead magnet with "5 Agency Growth Levers" vs. "How We Added $40K MRR in 90 Days" will perform completely differently.'
            },
            {
              type: 'callout',
              style: 'success',
              content: '**Niche vs. Viral:** Viral lead magnets attract massive volumes of unqualified leads. For niche B2B, you want targeted magnets that attract fewer but higher-quality prospects. Quality always beats quantity when your average deal size is $5K+.'
            }
          ],
          keyTakeaway: 'Build one great lead magnet, then multiply it. A hero asset with 25+ headline variations gives you months of content from a single creation effort.'
        },
        {
          id: 'creator-action',
          sectionName: 'Your Next Step: Build Your Lead Magnet',
          introduction: 'The AI Lead Magnet Creator takes your concept and builds the complete asset — formatted, structured, and ready to publish.',
          blocks: [
            {
              type: 'paragraph',
              content: 'The Creator is the second tool in the three-tool workflow: (1) **Ideator** generates concepts, (2) **Creator** builds the actual asset, (3) **Post Creator** writes the LinkedIn post to promote it. Together they take you from blank page to published lead magnet in under an hour.'
            },
            {
              type: 'paragraph',
              content: 'Check your email for the registration link — you get 10 free credits to build and refine your lead magnet.'
            }
          ],
          keyTakeaway: 'The hardest part is starting. The AI Creator removes the blank-page problem and gives you a structured first draft to refine.'
        }
      ],
      metadata: { wordCount: 0, readingTimeMinutes: 0 }
    }
  },

  // ─────────────────────────────────────────────────────────────
  // 4. LEAD MAGNET POST WRITER
  // ─────────────────────────────────────────────────────────────
  {
    id: 'a7386629-265b-47ad-b209-683849f4b959',
    slug: 'lead-magnet-post-writer',
    content: {
      version: 1,
      polishedAt: new Date().toISOString(),
      title: 'LinkedIn Posts That Drive Opt-Ins: The Promotion Playbook',
      heroSummary: 'Creating a lead magnet is only 30% of the work. Here is how to write LinkedIn posts that turn your lead magnet into a steady stream of email subscribers.',
      sections: [
        {
          id: 'post-writer-no-links',
          sectionName: 'The #1 Rule: No Links in Organic Posts',
          introduction: 'This single mistake kills more lead magnet campaigns than any other.',
          blocks: [
            {
              type: 'callout',
              style: 'warning',
              content: '**Links kill organic reach.** LinkedIn actively suppresses posts with external links. A post with a link gets shown to a fraction of your audience compared to the same post without one. This is the single most important thing to understand about LinkedIn lead magnet promotion.'
            },
            {
              type: 'paragraph',
              content: 'The solution: use a **"comment to get" workflow.** Tell people to comment a keyword to receive the resource. Each post should have a different keyword depending on the resource offered — so you know exactly what problem they are trying to solve. An automation tool (like LeadShark or MagnetLab) delivers the asset to anyone who comments.'
            },
            {
              type: 'paragraph',
              content: 'The only time you add a direct link is when running the post as a **Thought Leader Ad** — because the link penalty does not apply to paid promotion. This is the hack: post organically without a link, let it gain traction, then boost it as a TLA with the link added.'
            }
          ],
          keyTakeaway: 'Never put links in organic LinkedIn posts. Use comment-to-get for organic, direct links only in Thought Leader Ads.'
        },
        {
          id: 'post-writer-tla',
          sectionName: 'Thought Leader Ads: The Amplification Engine',
          introduction: 'Thought Leader Ads are the only LinkedIn ad format worth running for B2B lead generation.',
          blocks: [
            {
              type: 'paragraph',
              content: 'TLAs look native, leverage your existing social proof, require no new creative, and are slightly annoying to set up — which creates a moat. Most of your competitors are not running them, which means lower CPMs and higher engagement rates.'
            },
            {
              type: 'numbered-item',
              number: 1,
              title: 'Post Organically First',
              content: 'Publish your lead magnet post without any links. Let it collect initial engagement.',
              detail: 'The organic engagement signals to LinkedIn that this is quality content — which improves ad performance when you boost it.',
              category: 'Workflow'
            },
            {
              type: 'numbered-item',
              number: 2,
              title: 'Boost as Thought Leader Ad',
              content: 'Once the post has some traction, set it up as a TLA with "Engagement Clicks" as your optimization goal.',
              detail: 'Choose Engagement Clicks — not impressions, not website visits. The engagement-optimized campaign combined with "comment to get" hacks the algorithm\'s optimization loop.',
              category: 'Workflow'
            },
            {
              type: 'numbered-item',
              number: 3,
              title: 'Edit to Add Link',
              content: 'After boosting, edit the organic post to add your direct opt-in page link.',
              detail: 'The link penalty does not apply to paid promotion. Now the post has both the comment-to-get workflow AND a direct link for people who prefer to click through immediately.',
              category: 'Workflow'
            }
          ],
          keyTakeaway: 'The TLA workflow gives you the best of both worlds: organic reach from the comment-to-get hook, plus paid amplification with a direct link.'
        },
        {
          id: 'post-writer-headlines',
          sectionName: 'Headline Variations That Convert',
          introduction: 'A single lead magnet can be posted 25+ times over years with different headlines. The headline is the variable that matters most.',
          blocks: [
            {
              type: 'list',
              content: '- **Include concrete numbers:** "The 7-Step Framework" beats "A Framework for Growth"\n- **Position as case studies:** "How We Added $40K MRR in 90 Days" beats "Revenue Growth Tips"\n- **Mention the specific industry:** "For B2B Agency Owners" beats "For Business Owners"\n- **Lead with the outcome:** "Book 10 Calls This Month" beats "Improve Your Sales Process"\n- **Use loss aversion:** "The $50K Mistake Most Agencies Make" beats "Common Agency Mistakes"'
            },
            {
              type: 'paragraph',
              content: 'The AI content pipeline generates progressively better lead magnet posts over time by ingesting your call transcripts and building a knowledge base of what resonates with your audience. The more you write, the better the AI gets at matching your voice and your ICP\'s language.'
            }
          ],
          keyTakeaway: 'Reuse your best lead magnet 25+ times with headline variations. Each variation tests a different angle and reveals what your audience responds to.'
        },
        {
          id: 'post-writer-action',
          sectionName: 'Your Next Step: Generate Your Promotion Post',
          introduction: 'The AI Post Writer creates LinkedIn posts specifically designed to promote your lead magnet — with built-in hooks, comment-to-get CTAs, and headline optimization.',
          blocks: [
            {
              type: 'paragraph',
              content: 'Check your email for the registration link — you get 10 free credits to generate promotion post variations for your lead magnet.'
            }
          ],
          keyTakeaway: 'The best promotion post is the one that makes your ICP stop scrolling and comment. The AI writes that post for you.'
        }
      ],
      metadata: { wordCount: 0, readingTimeMinutes: 0 }
    }
  },

  // ─────────────────────────────────────────────────────────────
  // 5. PROFILE OPTIMIZER
  // ─────────────────────────────────────────────────────────────
  {
    id: '72a5a70c-64ac-428b-965e-86c662ad0b2a',
    slug: 'profile-optimizer',
    content: {
      version: 1,
      polishedAt: new Date().toISOString(),
      title: 'Turn Your LinkedIn Profile Into a Lead Machine',
      heroSummary: 'Profile viewers are a massively underutilized source of leads. Here is how to optimize your profile so every view becomes a potential conversation.',
      sections: [
        {
          id: 'profile-personal',
          sectionName: 'Personal Profile > Company Page (Always)',
          introduction: 'If you are spending time on your company LinkedIn page, stop. Personal profiles are the only thing that matters.',
          blocks: [
            {
              type: 'paragraph',
              content: 'Business LinkedIn pages are essentially worthless for lead generation — they typically have very few followers and do not appear in people\'s feeds. **Personal LinkedIn profiles are far more effective.** People connect with people, not logos. Your personal brand is your company\'s most powerful marketing asset on LinkedIn.'
            },
            {
              type: 'callout',
              style: 'info',
              content: 'The recommended AI tool priority order tells you everything: (1) DM Chat Helper, (2) **Profile Optimizer**, (3) Transcript Post Idea Grabber, (4) Post Generator, (5) Post Finalizer. Your profile is the second most important thing to get right — right after your DM game.'
            }
          ],
          keyTakeaway: 'Invest 100% of your LinkedIn effort into your personal profile. Company pages are a distraction.'
        },
        {
          id: 'profile-featured',
          sectionName: 'The Featured Section: Your Secret Weapon',
          introduction: 'Most people fill their Featured section with articles nobody reads. Here is what actually converts.',
          blocks: [
            {
              type: 'callout',
              style: 'success',
              content: '**A short video testimonial outperforms PDF case studies every time.** It reads as more authentic and harder to fabricate. Next time you are on a call with a client who has good results, ask if you can start a Loom recording. From one such conversation, you can generate five or more posts AND a featured testimonial.'
            },
            {
              type: 'list',
              content: '- **Slot 1:** Video testimonial from your best client (60-90 seconds)\n- **Slot 2:** Your highest-performing lead magnet post\n- **Slot 3:** A case study post with specific numbers\n- **Avoid:** Generic company pitch decks, long-form articles, company page links'
            }
          ],
          keyTakeaway: 'Feature video testimonials and high-performing posts. Everything else is noise.'
        },
        {
          id: 'profile-views',
          sectionName: 'Profile Views: The Most Underutilized Lead Source',
          introduction: 'People on LinkedIn are shy. They view your profile because they are interested — but they will not message you first. Your job is to start the conversation.',
          blocks: [
            {
              type: 'paragraph',
              content: 'Profile viewers are leaving **intent signals** — they are effectively saying "I\'m interested" without saying it. By reaching out first, you are just giving them the platform to respond. This is called **manufacturing inbounds.**'
            },
            {
              type: 'callout',
              style: 'info',
              content: '**Intent Signal Hierarchy:** Connection request > Profile view > Post engagement. A connection request carries a stronger intent signal than a profile view, which carries a stronger signal than a like or comment.'
            },
            {
              type: 'numbered-item',
              number: 1,
              title: 'Qualify the Viewer',
              content: 'Before messaging, check if they match your ICP criteria.',
              detail: 'Geographic location, role (founder/CEO/decision maker), company size (check the People tab — not the listed range, companies often misreport), content activity, follower count, LinkedIn Premium badge.',
              category: 'Process'
            },
            {
              type: 'numbered-item',
              number: 2,
              title: 'Message Within Minutes',
              content: 'When you catch a prospect early — right after they viewed your profile — they are likely still online.',
              detail: 'A live qualifying conversation dramatically compresses the sales cycle. The timing advantage is everything — wait 24 hours and the moment is gone.',
              category: 'Process'
            },
            {
              type: 'numbered-item',
              number: 3,
              title: 'Use the Profile View Opener',
              content: 'A proven 4-step opener for profile view responses.',
              detail: '(1) Acknowledge the intent: "I never know if these profile views are real or AI lol." (2) Express your opinion/differentiate. (3) Ask a question to lower resistance. (4) Give a hint/multiple choice answer.',
              category: 'Process'
            }
          ],
          keyTakeaway: 'Every profile view is a warm lead signaling interest. Respond fast with a genuine opener and you will compress sales cycles from weeks to days.'
        },
        {
          id: 'profile-action',
          sectionName: 'Your Next Step: Optimize Your Profile',
          introduction: 'The AI Profile Optimizer rewrites your headline, about section, and featured strategy based on your ICP and offer.',
          blocks: [
            {
              type: 'paragraph',
              content: 'Clients consistently say the AI-generated profile copy is notably better than what they wrote themselves — and they implement it immediately. The optimizer focuses on conversion, not vanity: every section is designed to make profile viewers want to start a conversation.'
            },
            {
              type: 'paragraph',
              content: 'Check your email for the registration link — you get 10 free credits to optimize your profile.'
            }
          ],
          keyTakeaway: 'Your profile is your 24/7 landing page. The AI makes sure it converts viewers into conversations.'
        }
      ],
      metadata: { wordCount: 0, readingTimeMinutes: 0 }
    }
  },

  // ─────────────────────────────────────────────────────────────
  // 6. POST GENERATOR
  // ─────────────────────────────────────────────────────────────
  {
    id: '4720b202-7702-48ad-9725-f30ab4a34fa4',
    slug: 'post-generator',
    content: {
      version: 1,
      polishedAt: new Date().toISOString(),
      title: 'The LinkedIn Content Strategy Playbook: Writing Posts That Attract Your ICP',
      heroSummary: 'LinkedIn shifted from a social graph to a content graph in 2025. Here is how the algorithm actually works now — and how to write posts that reach your ideal clients.',
      sections: [
        {
          id: 'postgen-algorithm',
          sectionName: 'The Algorithm Shift You Need to Understand',
          introduction: 'In January 2025, LinkedIn fundamentally changed how content gets distributed. If you are still using 2023 tactics, you are invisible.',
          blocks: [
            {
              type: 'paragraph',
              content: 'LinkedIn moved from a **social graph model** (show content to your connections) to a **content graph model** (show content to people interested in the topic) — following TikTok\'s approach. This means a brand-new account can grow very fast. It also means you need to post higher volume and iterate faster.'
            },
            {
              type: 'callout',
              style: 'info',
              content: '**The Key Implication:** LinkedIn uses the words in your post to determine who to show it to. Writing IS targeting. Specificity of language determines your audience — not your follower count, not your connection network. This is the biggest shift in LinkedIn history.'
            },
            {
              type: 'paragraph',
              content: 'Organic reach is down dramatically for everyone right now — even accounts with 50K+ followers are seeing poor engagement on regular posts. The solution is not to post less. The solution is to **combine organic posting with Thought Leader Ads** to guarantee distribution.'
            }
          ],
          keyTakeaway: 'The content graph means anyone can reach anyone. Your words are your targeting mechanism. Write for your ICP and the algorithm finds them.'
        },
        {
          id: 'postgen-sourcing',
          sectionName: 'Where Your Best Posts Come From',
          introduction: 'The best LinkedIn content is not "content." It is conversations, insights, and frameworks repurposed from your real work.',
          blocks: [
            {
              type: 'numbered-item',
              number: 1,
              title: 'Write Between Calls',
              content: 'Use the gap on your calendar immediately after a call to write about something you just said.',
              detail: 'You will never have fresher, more authentic material than right after a real conversation. The energy, the phrasing, the examples — all of it is more genuine than sitting down to "create content."',
              category: 'Source'
            },
            {
              type: 'numbered-item',
              number: 2,
              title: 'Mine Your Transcripts',
              content: 'Every sales call transcript yields 10+ post ideas via AI extraction.',
              detail: 'Ingest transcripts into an AI Brain (like MagnetLab\'s knowledge base), and it identifies the moments worth turning into posts — the insights, the objections, the frameworks you explained.',
              category: 'Source'
            },
            {
              type: 'numbered-item',
              number: 3,
              title: 'Turn Client Wins Into Case Studies',
              content: 'Next time a client shares good results, ask to start a Loom recording.',
              detail: 'From one such conversation, you can typically generate five or more posts. Real results with specific numbers always outperform theoretical advice.',
              category: 'Source'
            },
            {
              type: 'callout',
              style: 'success',
              content: '**The 9-Page Prompt:** Tim\'s LinkedIn post prompt alone is nine pages long. The prompt IS the product. When the AI knows your voice, your ICP, and your knowledge base, it generates posts that sound like you — not like generic AI content.'
            }
          ],
          keyTakeaway: 'The best content comes from real conversations. Let AI do the packaging — you provide the substance.'
        },
        {
          id: 'postgen-network',
          sectionName: 'Growing Your Network Strategically',
          introduction: 'Content without network is a tree falling in an empty forest. Here is how to grow your audience with the right people.',
          blocks: [
            {
              type: 'paragraph',
              content: 'Add **25-30 targeted connections per day.** Roughly 30% will accept. Lead magnet posts that generate comments get amplified by LinkedIn\'s algorithm to second-degree connections — which is why the comment-to-get workflow compounds over time.'
            },
            {
              type: 'list',
              content: '- Target connections who match your ICP (not random growth)\n- Use Linked Helper 2 ($15/month) — desktop app runs locally, significantly safer than cloud-based alternatives because LinkedIn cannot easily distinguish its actions from human behavior\n- Personalize connection requests with a reference to their content or company\n- Accept all inbound connection requests from potential ICPs — they are intent signals'
            }
          ],
          keyTakeaway: 'Grow your network with 25-30 targeted connections daily. Combined with regular posting, this creates exponential reach into your ICP.'
        },
        {
          id: 'postgen-action',
          sectionName: 'Your Next Step: Generate Your Posts',
          introduction: 'The AI Post Generator creates LinkedIn posts matched to your voice, your ICP, and your knowledge base.',
          blocks: [
            {
              type: 'paragraph',
              content: 'Check your email for the registration link — you get 10 free credits to generate posts that sound like you, not like AI.'
            }
          ],
          keyTakeaway: 'Stop staring at a blank page. Feed the AI your expertise and let it generate posts that attract your ideal clients.'
        }
      ],
      metadata: { wordCount: 0, readingTimeMinutes: 0 }
    }
  },

  // ─────────────────────────────────────────────────────────────
  // 7. POST FINALIZER
  // ─────────────────────────────────────────────────────────────
  {
    id: 'e2cbd56a-7c6b-4840-a946-4f06fa8ba2ec',
    slug: 'post-finalizer',
    content: {
      version: 1,
      polishedAt: new Date().toISOString(),
      title: 'The LinkedIn Post Polish Checklist: Final Touches That Maximize Engagement',
      heroSummary: 'The difference between a post that gets 50 views and one that gets 5,000 is often in the final edit. Here is the checklist for polishing posts before you hit publish.',
      sections: [
        {
          id: 'final-hook',
          sectionName: 'The Hook: Your 3-Second Window',
          introduction: 'Your hook determines whether someone reads your post or keeps scrolling. You have about 3 seconds to earn their attention.',
          blocks: [
            {
              type: 'list',
              content: '- **Lead with the outcome, not the process:** "We booked 10 calls in 7 days" beats "Here\'s our lead gen process"\n- **Use specific numbers:** "The $40K mistake" beats "A costly mistake"\n- **Create a knowledge gap:** "Most agencies get this wrong" makes people want to know what "this" is\n- **Avoid clickbait promises you cannot deliver:** Trust is everything on LinkedIn\n- **Keep it to 1-2 lines:** The hook should be immediately visible without clicking "see more"'
            },
            {
              type: 'callout',
              style: 'info',
              content: '**The Content Graph Effect:** LinkedIn uses your hook words to determine who to show the post to. A hook that says "B2B agency owners" literally tells the algorithm to show it to B2B agency owners. Be specific in your language — it is your targeting mechanism.'
            }
          ],
          keyTakeaway: 'Your hook is both your headline and your targeting. Make it specific, numbered, and outcome-focused.'
        },
        {
          id: 'final-body',
          sectionName: 'Body Polish: Readability Over Cleverness',
          introduction: 'LinkedIn is read on mobile. Every formatting choice should prioritize scannability.',
          blocks: [
            {
              type: 'numbered-item',
              number: 1,
              title: 'One Idea Per Line',
              content: 'Break long paragraphs into single-sentence lines. White space is your friend on mobile.',
              category: 'Format'
            },
            {
              type: 'numbered-item',
              number: 2,
              title: 'Remove All Filler Words',
              content: '"Very," "really," "just," "actually," "basically" — cut them all. Every word should earn its place.',
              category: 'Format'
            },
            {
              type: 'numbered-item',
              number: 3,
              title: 'Lead With Action Verbs',
              content: '"Build your funnel" beats "You should think about building your funnel." Direct language converts.',
              category: 'Format'
            },
            {
              type: 'numbered-item',
              number: 4,
              title: 'Check the "See More" Cut',
              content: 'Preview your post on mobile. Make sure the hook + first line are compelling enough to tap "see more."',
              category: 'Format'
            },
            {
              type: 'callout',
              style: 'warning',
              content: '**Do NOT add external links in organic posts.** Links kill organic reach. If you want to link to a resource, put it in the first comment or use a "comment [KEYWORD] to get it" workflow.'
            }
          ],
          keyTakeaway: 'Polish for mobile scannability. If you cannot skim it in 10 seconds, it is too dense.'
        },
        {
          id: 'final-cta',
          sectionName: 'The CTA: Driving Action Without Killing Reach',
          introduction: 'Your call-to-action determines whether engagement turns into pipeline. But the wrong CTA can tank your reach.',
          blocks: [
            {
              type: 'table',
              headers: ['CTA Type', 'Reach Impact', 'When to Use'],
              rows: [
                ['Comment a keyword', 'Positive — drives engagement', 'Lead magnet offers'],
                ['Ask a question', 'Positive — drives comments', 'Thought leadership posts'],
                ['Tag someone', 'Neutral to positive', 'When genuinely relevant'],
                ['Click this link', 'Negative — kills reach', 'Only in Thought Leader Ads'],
                ['DM me', 'Neutral', 'High-intent offers only']
              ]
            },
            {
              type: 'paragraph',
              content: 'Each post should have a different keyword depending on the resource offered — so you know exactly what problem the commenter is trying to solve. "Comment LEADS for the lead gen checklist" vs. "Comment PITCH for the pitch template." This segmentation is gold for follow-up messaging.'
            }
          ],
          keyTakeaway: 'Comment-based CTAs boost reach AND capture intent. Link-based CTAs kill reach — save them for paid promotion.'
        },
        {
          id: 'final-action',
          sectionName: 'Your Next Step: Polish Your Posts',
          introduction: 'The AI Post Finalizer applies this entire checklist automatically — optimizing hooks, formatting, CTAs, and readability.',
          blocks: [
            {
              type: 'paragraph',
              content: 'Check your email for the registration link — you get 10 free credits to polish your posts before publishing.'
            }
          ],
          keyTakeaway: 'A polished post takes 5 minutes of editing but can 10x your reach. The AI does it in seconds.'
        }
      ],
      metadata: { wordCount: 0, readingTimeMinutes: 0 }
    }
  },

  // ─────────────────────────────────────────────────────────────
  // 8. DM SCRIPT GPT
  // ─────────────────────────────────────────────────────────────
  {
    id: 'a0a2cc3a-c97b-4124-a49b-1b465a9331e0',
    slug: 'dm-script-gpt',
    content: {
      version: 1,
      polishedAt: new Date().toISOString(),
      title: 'The LinkedIn DM Playbook: Scripts That Start Real Conversations',
      heroSummary: 'The DM Chat Helper is our most popular tool by an order of magnitude. Here is why — and the messaging framework behind it.',
      sections: [
        {
          id: 'dm-why',
          sectionName: 'Why DMs Beat Everything Else',
          introduction: 'Posts build awareness. DMs build pipeline. The fastest path to a booked call is a well-timed, well-crafted DM.',
          blocks: [
            {
              type: 'stat-card',
              content: '~20%',
              title: 'Positive Response Rate',
              detail: 'From connected profiles when offering lead magnets via DM'
            },
            {
              type: 'paragraph',
              content: 'People on LinkedIn are **shy.** They often have a genuine need but will not DM first — even when they have shown multiple intent signals (profile views, post engagement, connection requests). Your job is to **manufacture inbounds** by starting the conversation first.'
            },
            {
              type: 'callout',
              style: 'info',
              content: '**Manufacturing Inbounds:** The intent signals prospects leave are effectively them saying "I\'m interested" without saying it. By reaching out first, you are just giving them the platform to respond. It is not cold outreach — it is warm follow-up on behavior they already exhibited.'
            }
          ],
          keyTakeaway: 'DMs convert intent signals into conversations. A ~20% positive response rate from warm prospects beats any other channel.'
        },
        {
          id: 'dm-formula',
          sectionName: 'The 4-Step DM Opener Formula',
          introduction: 'Generic openers get ignored. This formula creates an instant emotional connection and opens the door to a qualifying conversation.',
          blocks: [
            {
              type: 'numbered-item',
              number: 1,
              title: 'Acknowledge the Intent',
              content: 'Reference the specific action they took — profile view, comment, connection request.',
              detail: 'Example: "I never know if these profile views are real or AI lol." This is disarming, relatable, and opens the door for them to explain why they visited.',
              category: 'Formula'
            },
            {
              type: 'numbered-item',
              number: 2,
              title: 'Express Your Opinion',
              content: 'Share a specific, relatable viewpoint that differentiates you from every other DM in their inbox.',
              detail: 'Generic questions get ignored. Sharing a specific, relatable viewpoint creates an instant emotional connection. **Your opinion is your differentiator.** This is what makes them think "this person gets it."',
              category: 'Formula'
            },
            {
              type: 'numbered-item',
              number: 3,
              title: 'Ask a Question',
              content: 'Ask a single qualifying question to lower the resistance to replying.',
              detail: 'The question should be easy to answer but strategically chosen to qualify them. Something they can respond to in one sentence.',
              category: 'Formula'
            },
            {
              type: 'numbered-item',
              number: 4,
              title: 'Give a Hint (Multiple Choice)',
              content: 'Follow the question with two answer options. Both options lead to a qualifying discussion.',
              detail: 'This puts "guardrails" on the conversation — both answer options qualify them. It also lowers the cognitive effort required to reply. Instead of composing a response, they just pick A or B.',
              category: 'Formula'
            },
            {
              type: 'callout',
              style: 'success',
              content: '**This is "personalization at scale."** The formula is repeatable, but each message feels personal because you reference their specific action and share a genuine opinion. It works whether you send 5 DMs a day or 50.'
            }
          ],
          keyTakeaway: 'Acknowledge intent → share opinion → ask question → multiple choice hint. This 4-step formula turns shy profile viewers into active conversations.'
        },
        {
          id: 'dm-segmentation',
          sectionName: 'Messaging by Persona',
          introduction: 'The way you write to a CEO is completely different from how you write to a marketing manager. Segment your messaging.',
          blocks: [
            {
              type: 'table',
              headers: ['Persona', 'Messaging Style', 'What They Care About'],
              rows: [
                ['CEO / Founder', 'Extremely succinct, outcome-focused', 'Revenue impact, delegation, speed'],
                ['VP / Director', 'Data-backed, ROI-oriented', 'Team performance, reporting to board'],
                ['Marketing Manager', 'Tactical, implementation-focused', 'Tools, workflows, proving value to boss'],
                ['Solopreneur', 'Conversational, peer-to-peer', 'Quick wins, time savings, simplicity']
              ]
            },
            {
              type: 'callout',
              style: 'warning',
              content: '**Revenue Band Language:** Each revenue stage creates a fundamentally different buyer. If you write for $50K/month businesses, the $1M/month businesses will not resonate — and vice versa. Segment your DM campaigns by revenue band, not just job title.'
            },
            {
              type: 'paragraph',
              content: '**CEO-specific tip:** Frame offers as resources their team can implement — not things they personally need to do. CEOs buy delegation, not more work. "Your team can implement this in a week" beats "You should try this approach."'
            }
          ],
          keyTakeaway: 'Segment DMs by persona AND revenue band. Generic messaging is the fastest way to get ignored.'
        },
        {
          id: 'dm-delivery',
          sectionName: 'Message Mechanics That Signal "Human"',
          introduction: 'How you send the message matters as much as what you say.',
          blocks: [
            {
              type: 'list',
              content: '- **Split into multiple short messages** — do not send a wall of text. 2-3 short messages signal "human." One long message signals "automated."\n- **Start with LinkedIn, then layer email** — get the messaging right on LinkedIn first, then add cold email once you know what resonates.\n- **Respond fast** — when you catch a prospect right after they viewed your profile, they are likely still online. A live qualifying conversation compresses the sales cycle dramatically.\n- **Use deliberate imperfection** — a minor typo or casual phrasing makes you seem more real. Over-polished messages get flagged as bot activity.'
            }
          ],
          keyTakeaway: 'Short messages, fast responses, casual tone. The goal is to feel like a person, not a campaign.'
        },
        {
          id: 'dm-action',
          sectionName: 'Your Next Step: Get Your DM Scripts',
          introduction: 'The DM Chat Helper is the most popular tool in the suite — paste in an entire DM conversation and it tells you what to say next.',
          blocks: [
            {
              type: 'paragraph',
              content: 'Unlike static scripts, the AI reads the full conversation context and generates the next message based on where the conversation actually is. It applies the 4-step formula, adjusts for persona, and maintains your voice.'
            },
            {
              type: 'paragraph',
              content: 'Check your email for the registration link — you get 10 free credits.'
            }
          ],
          keyTakeaway: 'Stop guessing what to say next. Paste the conversation and let the AI craft the perfect follow-up.'
        }
      ],
      metadata: { wordCount: 0, readingTimeMinutes: 0 }
    }
  },

  // ─────────────────────────────────────────────────────────────
  // 9. COLD EMAIL MASTERMIND
  // ─────────────────────────────────────────────────────────────
  {
    id: 'b80bdffc-3663-4042-a806-85476f0c0a6c',
    slug: 'cold-email-mastermind',
    content: {
      version: 1,
      polishedAt: new Date().toISOString(),
      title: 'The B2B Cold Email Playbook: Infrastructure, Copy, and Deliverability',
      heroSummary: 'AI-personalized cold email referencing a specific LinkedIn post can generate ~8% reply rates — unheard of for cold email. Here is the full system.',
      sections: [
        {
          id: 'cold-infra',
          sectionName: 'Infrastructure: Why Most Cold Email Fails Before Send',
          introduction: 'The #1 reason cold email fails is not bad copy — it is bad infrastructure. Your emails are landing in spam and you do not even know it.',
          blocks: [
            {
              type: 'callout',
              style: 'warning',
              content: '**Why Not Instantly or SmartLead:** Both tools use "warm-up pools" with many senders who have not properly set up their domains. This degrades overall pool quality. More restrictive warm-up pools = better deliverability. Choose tools with higher standards for who enters the pool.'
            },
            {
              type: 'paragraph',
              content: '**Warm-up explained:** Your email domains send automated emails back and forth with other accounts in a pool to signal to Gmail/Google that you are a legitimate sender. This process takes 2-4 weeks before you should send any real campaigns.'
            },
            {
              type: 'accordion',
              title: 'Should I buy pre-warmed domains?',
              content: 'Warm them up yourself in almost all cases. Pre-warmed domains only provide value if targeting enterprise clients who have domain age restrictions. For SMB outreach, a fresh domain warmed for 3-4 weeks performs just as well.'
            },
            {
              type: 'accordion',
              title: 'What about enterprise email filters?',
              content: 'For enterprise buyers, they have sophisticated email filters. You need to buy aged domains and use other technical workarounds. The volume is lower but the deal sizes justify the additional infrastructure cost.'
            },
            {
              type: 'paragraph',
              content: 'Recommended tech stack: **LinkedIn DMs via HeyReach, Cold Email via PlusVibe, Email Account Setup via ZapMail.** This combination gives you the best deliverability and the most control over your sending infrastructure.'
            }
          ],
          keyTakeaway: 'Get your infrastructure right before writing a single email. Bad deliverability wastes every dollar you spend on copy and data.'
        },
        {
          id: 'cold-copy',
          sectionName: 'Copy: The Lead Magnet-First Approach',
          introduction: 'The first goal of cold email is getting a reply — NOT booking a call. This changes everything about how you write.',
          blocks: [
            {
              type: 'stat-card',
              content: '~8%',
              title: 'Reply Rate',
              detail: 'AI-personalized cold email referencing a specific LinkedIn post — "unheard of" for cold email'
            },
            {
              type: 'stat-card',
              content: '75%',
              title: 'Positive Replies',
              detail: 'Of all replies received, 75% were positive (requested more info)'
            },
            {
              type: 'stat-card',
              content: '0%',
              title: 'Bounce Rate',
              detail: 'Proper infrastructure + verified email lists = zero bounces'
            },
            {
              type: 'paragraph',
              content: 'The playbook: offer your lead magnet in the first email. Ask for a "yes" reply. Automation sends the opt-in link on reply. This keeps the initial email **link-free** (critical for deliverability) and gets the prospect into your nurture sequence simultaneously.'
            },
            {
              type: 'callout',
              style: 'success',
              content: '**Campaign Benchmark:** 1,500 emails sent → 4% overall reply rate → 3% net reply rate → 75% of replies positive → 33 people requested more info → 0% bounce rate. This is the benchmark to aim for with properly set up infrastructure.'
            },
            {
              type: 'callout',
              style: 'info',
              content: '**Rule of Thumb:** Expect one meaningful response per 200 emails sent. Plan your volumes accordingly — if you need 10 conversations per month, you need to send ~2,000 emails per month.'
            }
          ],
          keyTakeaway: 'Lead with value (your lead magnet), ask for a reply (not a meeting), and keep the first email link-free. This simple shift transforms cold email performance.'
        },
        {
          id: 'cold-personalization',
          sectionName: 'AI Personalization: The Competitive Edge',
          introduction: 'The key to 8% reply rates is not better templates — it is AI-powered personalization that references real, meaningful details.',
          blocks: [
            {
              type: 'paragraph',
              content: 'The competitive advantage comes from enriching leads with hyper-specific contextual data using tools like Clay. The AI references a specific recent LinkedIn post, a company milestone, or a hiring signal — details that make the email appear personally researched.'
            },
            {
              type: 'callout',
              style: 'warning',
              content: '**The referenced detail must actually be relevant and meaningful.** "I saw you posted on LinkedIn recently" is useless. "I noticed your post about struggling with lead gen for your SEO agency — we built a tool specifically for that" is meaningful. Generic personalization is worse than no personalization because it signals laziness.'
            },
            {
              type: 'list',
              content: '- **LinkedIn post reference**: Most powerful signal — shows you actually read their content\n- **Hiring signal**: "I noticed you are hiring a [role]" implies you understand their growth stage\n- **Company news**: Recent funding, product launch, expansion\n- **Tech stack**: BuiltWith/Wappalyzer data about tools they use\n- **Mutual connections**: Shared network creates implicit trust'
            }
          ],
          keyTakeaway: 'AI personalization at scale is the unlock. One meaningful detail per email is all you need — but it has to be genuinely relevant.'
        },
        {
          id: 'cold-multichannel',
          sectionName: 'Multi-Channel: Why Email Alone Is Not Enough',
          introduction: 'Different buyers prefer different channels. The highest-performing outbound systems layer LinkedIn and email together.',
          blocks: [
            {
              type: 'paragraph',
              content: 'Some prospects do not check LinkedIn DMs. Some ignore email. Some are only reachable through InMail. By running LinkedIn DMs (HeyReach), cold email (PlusVibe), and organic content simultaneously, you increase the probability of reaching someone when they are "in market."'
            },
            {
              type: 'callout',
              style: 'info',
              content: '**Start with LinkedIn, then layer email.** Get the messaging right on LinkedIn first (where you get faster feedback), then replicate what works via cold email. This de-risks your email campaigns and improves reply rates from day one.'
            }
          ],
          keyTakeaway: 'Email + LinkedIn + Content = the full outbound system. Each channel reinforces the others and catches prospects the other channels miss.'
        },
        {
          id: 'cold-action',
          sectionName: 'Your Next Step: Master Cold Email',
          introduction: 'The AI Cold Email Mastermind helps you write personalized cold email sequences, optimize subject lines, and structure your campaigns.',
          blocks: [
            {
              type: 'paragraph',
              content: 'Check your email for the registration link — you get 10 free credits to generate cold email sequences tailored to your ICP.'
            }
          ],
          keyTakeaway: 'Cold email is a system, not a skill. The AI helps you build the system — from infrastructure to copy to follow-up sequences.'
        }
      ],
      metadata: { wordCount: 0, readingTimeMinutes: 0 }
    }
  }
];

async function main() {
  console.log(`Pushing ${pages.length} resource pages to Supabase...\n`);

  let success = 0;
  let failed = 0;

  for (const page of pages) {
    process.stdout.write(`  [${page.slug}] `);

    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/lead_magnets?id=eq.${page.id}`,
      {
        method: 'PATCH',
        headers: {
          apikey: SUPABASE_KEY!,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({ polished_content: page.content }),
      }
    );

    if (res.ok) {
      console.log(`✓ Updated`);
      success++;
    } else {
      const err = await res.text();
      console.log(`✗ Failed (${res.status}): ${err}`);
      failed++;
    }
  }

  console.log(`\nDone: ${success} updated, ${failed} failed`);
}

main().catch(console.error);
