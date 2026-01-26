'use client';

interface OptinPageEditorProps {
  headline: string;
  setHeadline: (value: string) => void;
  subline: string;
  setSubline: (value: string) => void;
  buttonText: string;
  setButtonText: (value: string) => void;
  socialProof: string;
  setSocialProof: (value: string) => void;
  slug: string;
  setSlug: (value: string) => void;
}

export function OptinPageEditor({
  headline,
  setHeadline,
  subline,
  setSubline,
  buttonText,
  setButtonText,
  socialProof,
  setSocialProof,
  slug,
  setSlug,
}: OptinPageEditorProps) {
  const handleSlugChange = (value: string) => {
    // Only allow lowercase letters, numbers, and hyphens
    const sanitized = value
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-');
    setSlug(sanitized);
  };

  return (
    <div className="space-y-5">
      {/* URL Slug */}
      <div>
        <label className="block text-sm font-medium mb-1.5">
          Page URL Slug
        </label>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">/p/username/</span>
          <input
            type="text"
            value={slug}
            onChange={(e) => handleSlugChange(e.target.value)}
            className="flex-1 rounded-lg border border-border bg-muted/50 dark:bg-muted/20 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
            placeholder="my-lead-magnet"
          />
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          This will be your public page URL. Use lowercase letters, numbers, and hyphens only.
        </p>
      </div>

      {/* Headline */}
      <div>
        <label className="block text-sm font-medium mb-1.5">
          Headline
          <span className="ml-1 text-muted-foreground font-normal">(8-10 words ideal)</span>
        </label>
        <input
          type="text"
          value={headline}
          onChange={(e) => setHeadline(e.target.value)}
          className="w-full rounded-lg border border-border bg-muted/50 dark:bg-muted/20 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
          placeholder="The Exact Template That Generated $100K in Sales"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          {headline.split(' ').filter(w => w).length} words
        </p>
      </div>

      {/* Subline */}
      <div>
        <label className="block text-sm font-medium mb-1.5">
          Subline
          <span className="ml-1 text-muted-foreground font-normal">(15-25 words)</span>
        </label>
        <textarea
          value={subline}
          onChange={(e) => setSubline(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-border bg-muted/50 dark:bg-muted/20 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors resize-none"
          placeholder="Stop guessing what to say. Use the same approach that helped 500+ consultants book qualified calls."
        />
        <p className="mt-1 text-xs text-muted-foreground">
          {subline.split(' ').filter(w => w).length} words
        </p>
      </div>

      {/* Social Proof */}
      <div>
        <label className="block text-sm font-medium mb-1.5">
          Social Proof
          <span className="ml-1 text-muted-foreground font-normal">(optional)</span>
        </label>
        <input
          type="text"
          value={socialProof}
          onChange={(e) => setSocialProof(e.target.value)}
          className="w-full rounded-lg border border-border bg-muted/50 dark:bg-muted/20 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
          placeholder="Used by 2,400+ consultants to book qualified sales calls"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Numbers work best. E.g., &quot;Downloaded by 5,000+ marketers&quot;
        </p>
      </div>

      {/* Button Text */}
      <div>
        <label className="block text-sm font-medium mb-1.5">
          Button Text
        </label>
        <input
          type="text"
          value={buttonText}
          onChange={(e) => setButtonText(e.target.value)}
          className="w-full rounded-lg border border-border bg-muted/50 dark:bg-muted/20 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
          placeholder="Get Free Access"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Keep it action-oriented. 2-4 words.
        </p>
      </div>
    </div>
  );
}
