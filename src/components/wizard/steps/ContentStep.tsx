'use client';

import { useState } from 'react';
import { ArrowLeft, Check, Loader2, Sparkles, Copy, ChevronDown, ChevronUp } from 'lucide-react';
import type { ExtractedContent } from '@/lib/types/lead-magnet';

interface ContentStepProps {
  content: ExtractedContent;
  onApprove: () => void;
  onBack: () => void;
  loading: boolean;
}

// Helper to normalize items that might be strings or objects with various property names.
// The AI may return objects like {item, explanation}, {mistake, explanation}, {error, reason}, etc.
// This function handles any object by extracting the first two string values.
function normalizeItem(item: string | Record<string, unknown>): string {
  if (typeof item === 'string') return item;
  if (item && typeof item === 'object') {
    // Get all string values from the object
    const values = Object.values(item).filter((v): v is string => typeof v === 'string' && v.length > 0);
    if (values.length >= 2) {
      // Two values: format as "first: second" (e.g., "mistake: explanation")
      return `${values[0]}: ${values[1]}`;
    }
    if (values.length === 1) {
      return values[0];
    }
    // No string values found, fall back to JSON
    return JSON.stringify(item);
  }
  return String(item);
}

export function ContentStep({ content, onApprove, onBack, loading }: ContentStepProps) {
  const [showFullContent, setShowFullContent] = useState(false);
  const [copied, setCopied] = useState(false);

  // Generate the full lead magnet document text
  const generateFullContent = () => {
    let text = `# ${content.title}\n\n`;
    text += `*Format: ${content.format}*\n\n`;
    text += `---\n\n`;
    text += `## Key Insight\n\n${content.nonObviousInsight}\n\n`;

    content.structure.forEach((section) => {
      text += `## ${section.sectionName}\n\n`;
      section.contents.forEach((item) => {
        text += `- ${normalizeItem(item)}\n`;
      });
      text += '\n';
    });

    if (content.personalExperience) {
      text += `## Personal Experience\n\n${content.personalExperience}\n\n`;
    }

    text += `## Proof & Results\n\n${content.proof}\n\n`;

    if (content.commonMistakes.length > 0) {
      text += `## Common Mistakes This Prevents\n\n`;
      content.commonMistakes.forEach((mistake) => {
        text += `- ${normalizeItem(mistake)}\n`;
      });
      text += '\n';
    }

    text += `## What Makes This Different\n\n${content.differentiation}\n`;

    return text;
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(generateFullContent());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = generateFullContent();
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">Your Lead Magnet</h1>
          <p className="mt-2 text-muted-foreground">
            Here&apos;s the structured content we created from your expertise.
            Review and approve to generate your LinkedIn post.
          </p>
        </div>
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
      </div>

      <div className="space-y-6 rounded-xl border bg-card p-6">
        {/* Title */}
        <div>
          <h2 className="text-2xl font-bold">{content.title}</h2>
          <div className="mt-1 text-sm text-muted-foreground">
            Format: {content.format}
          </div>
        </div>

        {/* Key Insight */}
        <div className="rounded-lg bg-primary/10 p-4">
          <div className="mb-1 text-sm font-medium text-primary">Key Insight</div>
          <p>{content.nonObviousInsight}</p>
        </div>

        {/* Sections */}
        <div className="space-y-4">
          {content.structure.map((section, index) => (
            <div key={index}>
              <h3 className="mb-2 font-semibold">{section.sectionName}</h3>
              <ul className="space-y-1">
                {section.contents.map((item, itemIndex) => (
                  <li key={itemIndex} className="flex items-start gap-2 text-sm">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>{normalizeItem(item)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Personal Experience */}
        {content.personalExperience && (
          <div className="rounded-lg bg-blue-500/10 p-4">
            <div className="mb-1 text-sm font-medium text-blue-600">Personal Experience</div>
            <p className="text-sm">{content.personalExperience}</p>
          </div>
        )}

        {/* Proof */}
        <div className="rounded-lg bg-green-500/10 p-4">
          <div className="mb-1 text-sm font-medium text-green-600">Proof & Results</div>
          <p className="text-sm">{content.proof}</p>
        </div>

        {/* Common Mistakes */}
        {content.commonMistakes.length > 0 && (
          <div>
            <div className="mb-2 text-sm font-medium">Common Mistakes This Prevents</div>
            <div className="flex flex-wrap gap-2">
              {content.commonMistakes.map((mistake, index) => (
                <span
                  key={index}
                  className="rounded-full bg-destructive/10 px-3 py-1 text-sm text-destructive"
                >
                  {normalizeItem(mistake)}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Differentiation */}
        <div className="border-t pt-4">
          <div className="mb-1 text-sm font-medium">What Makes This Different</div>
          <p className="text-sm text-muted-foreground">{content.differentiation}</p>
        </div>
      </div>

      {/* Full Content Preview (expandable) */}
      <div className="rounded-xl border bg-card">
        <button
          onClick={() => setShowFullContent(!showFullContent)}
          className="flex w-full items-center justify-between p-4 text-left"
        >
          <span className="font-medium">View Full Content (Copy/Paste Ready)</span>
          {showFullContent ? (
            <ChevronUp className="h-5 w-5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-5 w-5 text-muted-foreground" />
          )}
        </button>
        {showFullContent && (
          <div className="border-t">
            <div className="flex justify-end border-b p-2">
              <button
                onClick={copyToClipboard}
                className="flex items-center gap-2 rounded-lg bg-secondary px-3 py-1.5 text-sm font-medium hover:bg-secondary/80"
              >
                {copied ? (
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
            <div className="max-h-[300px] overflow-y-auto p-4">
              <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                {generateFullContent()}
              </pre>
            </div>
          </div>
        )}
      </div>

      <button
        onClick={onApprove}
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-6 py-4 text-lg font-semibold text-primary-foreground disabled:opacity-50"
      >
        {loading ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            Generating LinkedIn posts...
          </>
        ) : (
          <>
            <Sparkles className="h-5 w-5" />
            Approve & Generate LinkedIn Post
          </>
        )}
      </button>
    </div>
  );
}
