'use client';

import { useState } from 'react';
import { ArrowLeft, Copy, Check, CheckCircle2, Loader2, FileText, MessageSquare, Send, Globe } from 'lucide-react';
import Link from 'next/link';
import type { ExtractedContent, PostVariation, LeadMagnetConcept } from '@/lib/types/lead-magnet';

interface PublishStepProps {
  content: ExtractedContent;
  post: PostVariation;
  dmTemplate: string;
  ctaWord: string;
  concept: LeadMagnetConcept;
  onBack: () => void;
  draftId?: string | null;
}

export function PublishStep({
  content,
  post,
  dmTemplate,
  ctaWord,
  concept,
  onBack,
  draftId,
}: PublishStepProps) {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savedLeadMagnetId, setSavedLeadMagnetId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Generate the full lead magnet document text
  const generateFullContent = () => {
    let text = `# ${content.title}\n\n`;
    text += `*Format: ${content.format}*\n\n`;
    text += `---\n\n`;
    text += `## Key Insight\n\n${content.nonObviousInsight}\n\n`;

    content.structure.forEach((section) => {
      text += `## ${section.sectionName}\n\n`;
      section.contents.forEach((item) => {
        text += `- ${item}\n`;
      });
      text += '\n';
    });

    text += `## Proof & Results\n\n${content.proof}\n\n`;

    if (content.commonMistakes.length > 0) {
      text += `## Common Mistakes This Prevents\n\n`;
      content.commonMistakes.forEach((mistake) => {
        text += `- ${mistake}\n`;
      });
      text += '\n';
    }

    text += `## What Makes This Different\n\n${content.differentiation}\n`;

    return text;
  };

  const copyToClipboard = async (text: string, section: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSection(section);
      setTimeout(() => setCopiedSection(null), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopiedSection(section);
      setTimeout(() => setCopiedSection(null), 2000);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);

    try {
      const response = await fetch('/api/lead-magnet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: content.title,
          archetype: concept.archetype,
          concept,
          extractedContent: content,
          linkedinPost: post.post,
          postVariations: [post],
          dmTemplate,
          ctaWord,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save');
      }

      const data = await response.json();
      setSavedLeadMagnetId(data.id);
      setSaved(true);

      // Clean up the auto-saved draft
      if (draftId) {
        fetch('/api/wizard-draft', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: draftId }),
        }).catch(() => {}); // fire-and-forget
      }
    } catch (error) {
      console.error('Save error:', error);
      setSaveError(error instanceof Error ? error.message : 'Failed to save. You can still copy the content below.');
    } finally {
      setSaving(false);
    }
  };

  const fullContent = generateFullContent();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Your Lead Magnet is Ready!</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Copy your content and LinkedIn post. Paste them wherever you&apos;d like to share.
          </p>
        </div>
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
      </div>

      {/* Save to Library */}
      <div className="rounded-lg border bg-card p-5 transition-colors">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {saved ? (
              <CheckCircle2 className="h-6 w-6 text-green-500" />
            ) : (
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">
                1
              </div>
            )}
            <div>
              <h3 className="font-semibold">Save to Library</h3>
              <p className="text-xs text-muted-foreground">Optional - save for future reference</p>
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={saving || saved}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : saved ? (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Saved
              </>
            ) : (
              'Save'
            )}
          </button>
        </div>
        {saveError && (
          <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <p className="text-sm text-amber-800 dark:text-amber-200">{saveError}</p>
          </div>
        )}
      </div>

      {/* Funnel Page Builder - shows after save */}
      {saved && savedLeadMagnetId && (
        <div className="rounded-lg border bg-card p-5 transition-colors">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Globe className="h-6 w-6 text-violet-500" />
              <div>
                <h3 className="font-semibold">Create Opt-in Page</h3>
                <p className="text-xs text-muted-foreground">
                  Build a landing page to capture leads directly
                </p>
              </div>
            </div>
            <Link
              href={`/magnets/${savedLeadMagnetId}?tab=funnel`}
              className="flex items-center gap-2 rounded-lg bg-violet-500 px-4 py-2 text-sm font-medium text-white hover:bg-violet-600 transition-colors"
            >
              Configure Funnel Page &rarr;
            </Link>
          </div>
        </div>
      )}

      {/* Lead Magnet Content */}
      <div className="rounded-lg border bg-card">
        <div className="flex items-center justify-between border-b p-4">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Lead Magnet Content</h3>
          </div>
          <button
            onClick={() => copyToClipboard(fullContent, 'content')}
            className="flex items-center gap-2 rounded-lg bg-secondary px-3 py-1.5 text-sm font-medium hover:bg-secondary/80 transition-colors"
          >
            {copiedSection === 'content' ? (
              <>
                <Check className="h-4 w-4 text-green-500" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Copy All
              </>
            )}
          </button>
        </div>
        <div className="max-h-[400px] overflow-y-auto p-4">
          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-muted-foreground">
            {fullContent}
          </pre>
        </div>
      </div>

      {/* LinkedIn Post */}
      <div className="rounded-lg border bg-card">
        <div className="flex items-center justify-between border-b p-4">
          <div className="flex items-center gap-2">
            <Send className="h-5 w-5 text-blue-500" />
            <h3 className="font-semibold">LinkedIn Post</h3>
          </div>
          <button
            onClick={() => copyToClipboard(post.post, 'post')}
            className="flex items-center gap-2 rounded-lg bg-secondary px-3 py-1.5 text-sm font-medium hover:bg-secondary/80 transition-colors"
          >
            {copiedSection === 'post' ? (
              <>
                <Check className="h-4 w-4 text-green-500" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Copy Post
              </>
            )}
          </button>
        </div>
        <div className="p-4">
          <div className="rounded-lg bg-muted/50 p-4">
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
              {post.post}
            </pre>
          </div>
          <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
            <span>Hook: <span className="font-medium text-foreground">{post.hookType}</span></span>
            <span>CTA word: <span className="font-medium text-foreground">&quot;{ctaWord}&quot;</span></span>
          </div>
        </div>
      </div>

      {/* DM Template */}
      <div className="rounded-lg border bg-card">
        <div className="flex items-center justify-between border-b p-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-green-500" />
            <h3 className="font-semibold">DM Template</h3>
            <span className="text-xs text-muted-foreground">
              (Send to people who comment &quot;{ctaWord}&quot;)
            </span>
          </div>
          <button
            onClick={() => copyToClipboard(dmTemplate, 'dm')}
            className="flex items-center gap-2 rounded-lg bg-secondary px-3 py-1.5 text-sm font-medium hover:bg-secondary/80 transition-colors"
          >
            {copiedSection === 'dm' ? (
              <>
                <Check className="h-4 w-4 text-green-500" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Copy DM
              </>
            )}
          </button>
        </div>
        <div className="p-4">
          <div className="rounded-lg bg-muted/50 p-4">
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
              {dmTemplate}
            </pre>
          </div>
        </div>
      </div>

      {/* Next Steps */}
      <div className="rounded-lg bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 p-6">
        <h3 className="font-semibold text-violet-900 dark:text-violet-100">Next Steps</h3>
        <ol className="mt-3 space-y-2 text-sm text-violet-800 dark:text-violet-200">
          <li className="flex items-start gap-2">
            <span className="font-semibold text-primary">1.</span>
            Copy the lead magnet content and paste it into a Google Doc or your preferred tool
          </li>
          <li className="flex items-start gap-2">
            <span className="font-semibold text-primary">2.</span>
            Make the document publicly accessible and copy the share link
          </li>
          <li className="flex items-start gap-2">
            <span className="font-semibold text-primary">3.</span>
            Post the LinkedIn content and respond to &quot;{ctaWord}&quot; comments with the DM template
          </li>
        </ol>
      </div>

      {saved && (
        <div className="flex justify-center">
          <Link
            href="/magnets"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            View Lead Magnets
          </Link>
        </div>
      )}
    </div>
  );
}
