'use client';

import Link from 'next/link';
import { Zap, Layers, GitBranch, Code } from 'lucide-react';

const integrationTools = [
  {
    title: 'Zapier',
    href: '/docs/zapier',
    description: 'Best for beginners. No code required.',
    icon: Zap,
  },
  {
    title: 'Make',
    href: '/docs/make',
    description: 'More flexible. Great for complex automations.',
    icon: Layers,
  },
  {
    title: 'n8n',
    href: '/docs/n8n',
    description: 'Self-hosted option. Full control.',
    icon: GitBranch,
  },
  {
    title: 'Direct API',
    href: '/docs/direct-api',
    description: 'Build your own integration.',
    icon: Code,
  },
];

export default function ConnectEmailList() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Connect to Your Email List</h1>
      <p className="text-muted-foreground mb-8">
        When someone fills out your landing page form, MagnetLab sends their info to a webhook URL
        you configure. Connect this to Zapier, Make, n8n, or your own API to add leads to your email
        list automatically.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-4">How It Works</h2>
      <div className="rounded-lg border bg-muted/30 p-4 my-4">
        <p className="text-sm text-center">
          Visitor fills form &rarr; MagnetLab stores the lead &rarr; Webhook fires to your URL
          &rarr; Your automation tool adds them to your email list
        </p>
      </div>

      <h2 className="text-xl font-semibold mt-8 mb-4">Step 1: Set Up Your Webhook</h2>
      <ol className="list-decimal list-inside space-y-3 text-sm">
        <li>
          Go to{' '}
          <Link href="/settings" className="text-violet-600 dark:text-violet-400 hover:underline">
            Settings
          </Link>{' '}
          &rarr; <strong>Webhooks</strong>
        </li>
        <li>
          Click <strong>Add Webhook</strong>
        </li>
        <li>Give it a name (e.g., &ldquo;Mailchimp sync&rdquo;)</li>
        <li>Paste the webhook URL from your automation tool (must be HTTPS)</li>
        <li>
          Click <strong>Save</strong>
        </li>
      </ol>

      <h2 className="text-xl font-semibold mt-8 mb-4">Step 2: Test It</h2>
      <ol className="list-decimal list-inside space-y-3 text-sm">
        <li>
          Click the <strong>Test</strong> button next to your webhook
        </li>
        <li>Check your automation tool &mdash; it should receive a test payload</li>
        <li>If it works, you&apos;re connected!</li>
      </ol>

      <h2 className="text-xl font-semibold mt-8 mb-4">Step 3: Map the Fields</h2>
      <p className="text-sm mb-4">
        In your automation tool, map these fields from the webhook payload:
      </p>
      <div className="overflow-x-auto my-4">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 pr-4 font-semibold">Webhook Field</th>
              <th className="text-left py-2 pr-4 font-semibold">What It Contains</th>
              <th className="text-left py-2 font-semibold">Map To</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b">
              <td className="py-2 pr-4">
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                  data.email
                </code>
              </td>
              <td className="py-2 pr-4">Lead&apos;s email address</td>
              <td className="py-2">Email field</td>
            </tr>
            <tr className="border-b">
              <td className="py-2 pr-4">
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                  data.name
                </code>
              </td>
              <td className="py-2 pr-4">Lead&apos;s name</td>
              <td className="py-2">Name / First Name field</td>
            </tr>
            <tr className="border-b">
              <td className="py-2 pr-4">
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                  data.leadMagnetTitle
                </code>
              </td>
              <td className="py-2 pr-4">Which lead magnet they opted into</td>
              <td className="py-2">Tag or custom field</td>
            </tr>
            <tr className="border-b">
              <td className="py-2 pr-4">
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                  data.isQualified
                </code>
              </td>
              <td className="py-2 pr-4">true / false / null</td>
              <td className="py-2">Segment or tag</td>
            </tr>
            <tr>
              <td className="py-2 pr-4">
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                  data.utmSource
                </code>
              </td>
              <td className="py-2 pr-4">Traffic source</td>
              <td className="py-2">Custom field</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 className="text-xl font-semibold mt-8 mb-4">Choose Your Integration Tool</h2>
      <div className="grid gap-4 sm:grid-cols-2 my-4">
        {integrationTools.map((tool) => {
          const Icon = tool.icon;
          return (
            <Link
              key={tool.href}
              href={tool.href}
              className="rounded-lg border bg-card p-4 transition-colors hover:border-violet-500/50 hover:bg-violet-500/5"
            >
              <Icon size={20} className="text-violet-500" />
              <h3 className="text-sm font-semibold mt-2">{tool.title}</h3>
              <p className="text-xs text-muted-foreground mt-1">{tool.description}</p>
            </Link>
          );
        })}
      </div>

      <h2 className="text-xl font-semibold mt-8 mb-4">Need Help from an AI?</h2>
      <div className="rounded-lg border bg-muted/30 p-4 my-4">
        <p className="text-sm">
          Copy our AI-friendly webhook reference and paste it into ChatGPT, Claude, or any AI
          &mdash; it has everything needed to help you set up the integration.
        </p>
        <p className="text-sm mt-2">
          <Link
            href="/docs/webhook-reference-ai"
            className="text-violet-600 dark:text-violet-400 hover:underline"
          >
            View Webhook Reference for AI &rarr;
          </Link>
        </p>
      </div>
    </div>
  );
}
