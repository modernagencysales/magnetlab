# MagnetLab

Create high-converting LinkedIn lead magnets that your ICP will actually love.

## What Makes MagnetLab Different

Unlike generic AI tools that generate the same bland content for everyone, MagnetLab **extracts YOUR unique expertise** through archetype-specific questions. The result is authentic content that only you could create.

## Features

- **10 Proven Archetypes**: Choose from battle-tested lead magnet formats (breakdowns, systems, toolkits, calculators, and more)
- **AI-Guided Extraction**: Our system asks the right questions to pull out your unique value
- **Anti-Cliche Post Writing**: 3 LinkedIn post variations that sound like you, not AI
- **Thumbnail Generation**: LinkedIn-optimized images (1200x627)
- **LeadShark Automation**: Schedule posts and auto-DM commenters

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Database**: Supabase (Postgres + Auth)
- **AI**: Anthropic Claude (Sonnet 4 + Opus 4.5)
- **Styling**: Tailwind CSS + shadcn/ui
- **Screenshots**: Playwright
- **Payments**: Stripe
- **LinkedIn**: LeadShark API

## Getting Started

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/magnetlab.git
   cd magnetlab
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy the environment variables:
   ```bash
   cp .env.example .env.local
   ```

4. Fill in your environment variables in `.env.local`

5. Set up the database:
   ```bash
   npx supabase start
   npx supabase db push
   ```

6. Run the development server:
   ```bash
   npm run dev
   ```

7. Open [http://localhost:3000](http://localhost:3000)

## Environment Variables

See `.env.example` for all required environment variables:

- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (server-side only)
- `ANTHROPIC_API_KEY` - Claude API key
- `NEXTAUTH_URL` - Your app URL
- `NEXTAUTH_SECRET` - NextAuth.js secret
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` - Google OAuth
- `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` - Stripe billing
- `LEADSHARK_API_KEY` - LeadShark API

## Project Structure

```
magnetlab/
├── src/
│   ├── app/
│   │   ├── (marketing)/     # Landing page
│   │   ├── (auth)/          # Login
│   │   ├── (dashboard)/     # Main app (create, library, analytics, settings)
│   │   └── api/             # API routes
│   ├── components/
│   │   ├── wizard/          # 6-step lead magnet wizard
│   │   ├── dashboard/       # Dashboard components
│   │   └── ui/              # Shared UI components
│   └── lib/
│       ├── ai/              # AI engine (extraction, post writing)
│       ├── integrations/    # External APIs (Stripe)
│       ├── services/        # Internal services (thumbnails)
│       ├── types/           # TypeScript types
│       └── utils/           # Utilities
└── supabase/
    └── migrations/          # Database migrations
```

## Pricing

- **Free**: 2 lead magnets/month, basic AI
- **Pro ($49/mo)**: 15 lead magnets, scheduling, automation
- **Unlimited ($149/mo)**: Unlimited everything, premium AI

## License

Proprietary - All rights reserved
