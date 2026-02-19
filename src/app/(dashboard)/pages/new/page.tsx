'use client';

import Link from 'next/link';
import { Globe, ExternalLink, BookOpen } from 'lucide-react';

export default function PagesNew() {
  return (
    <div className="container mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-semibold text-center mb-2">Create a Page</h1>
      <p className="text-center text-muted-foreground mb-8">
        What kind of page do you want to build?
      </p>

      <div className="space-y-4">
        <Link
          href="/create/page-quick"
          className="flex items-start gap-4 rounded-xl border bg-card p-6 hover:border-primary/50 hover:bg-card/80 transition-all group"
        >
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
            <Globe className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-medium group-hover:text-primary transition-colors">
              Landing page for your lead magnet
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Create an opt-in page with AI-generated copy for your content, guide, or tool.
            </p>
          </div>
        </Link>

        <Link
          href="/assets/external/new?createPage=true"
          className="flex items-start gap-4 rounded-xl border bg-card p-6 hover:border-primary/50 hover:bg-card/80 transition-all group"
        >
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-orange-500/10 group-hover:bg-orange-500/20 transition-colors">
            <ExternalLink className="h-5 w-5 text-orange-500" />
          </div>
          <div>
            <h3 className="font-medium group-hover:text-primary transition-colors">
              Landing page for an external resource
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Build a MagnetLab opt-in page even if your lead magnet is hosted elsewhere (Google Drive, Gumroad, your website, etc.)
            </p>
          </div>
        </Link>

        <Link
          href="/assets/libraries/new"
          className="flex items-start gap-4 rounded-xl border bg-card p-6 hover:border-primary/50 hover:bg-card/80 transition-all group"
        >
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-blue-500/10 group-hover:bg-blue-500/20 transition-colors">
            <BookOpen className="h-5 w-5 text-blue-500" />
          </div>
          <div>
            <h3 className="font-medium group-hover:text-primary transition-colors">
              Resource library page
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Bundle multiple resources into a single shareable page.
            </p>
          </div>
        </Link>
      </div>
    </div>
  );
}
