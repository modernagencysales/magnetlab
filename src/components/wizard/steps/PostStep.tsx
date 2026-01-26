'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Check, Copy, CheckCircle2 } from 'lucide-react';
import type { PostWriterResult, PostVariation } from '@/lib/types/lead-magnet';
import { cn } from '@/lib/utils';
import { SwipeFileInspiration } from '@/components/swipe-file/SwipeFileInspiration';

interface PostStepProps {
  result: PostWriterResult;
  onSelect: (index: number) => void;
  onBack: () => void;
}

function getEvaluationScore(evaluation: PostVariation['evaluation']): number {
  let score = 0;
  if (evaluation.hookStrength === 'strong') score += 2;
  else if (evaluation.hookStrength === 'medium') score += 1;
  if (evaluation.credibilityClear) score += 1;
  if (evaluation.problemResonance === 'high') score += 2;
  else if (evaluation.problemResonance === 'medium') score += 1;
  if (evaluation.contentsSpecific) score += 1;
  if (evaluation.toneMatch === 'aligned') score += 1;
  if (evaluation.aiClicheFree) score += 2;
  return score;
}

function PostCard({
  variation,
  index,
  isSelected,
  onSelect,
  onCopy,
  copied,
}: {
  variation: PostVariation;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  onCopy: () => void;
  copied: boolean;
}) {
  const score = getEvaluationScore(variation.evaluation);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className={cn(
        'relative rounded-xl border p-5 transition-all',
        isSelected ? 'border-primary bg-primary/5 ring-2 ring-primary' : 'bg-card'
      )}
    >
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-secondary px-3 py-1 text-sm font-medium">
            {variation.hookType}
          </span>
          <div className="flex items-center gap-1">
            <span className="text-sm text-muted-foreground">Quality:</span>
            <div className="flex">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className={cn(
                    'h-3 w-3 rounded-full border',
                    i <= Math.ceil(score / 2)
                      ? 'border-primary bg-primary'
                      : 'border-muted'
                  )}
                />
              ))}
            </div>
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onCopy();
          }}
          className="flex items-center gap-1 rounded-lg bg-secondary px-3 py-1.5 text-sm hover:bg-secondary/80"
        >
          {copied ? (
            <>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" />
              Copy
            </>
          )}
        </button>
      </div>

      {/* Post content */}
      <div
        className="mb-4 max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg bg-background p-4 text-sm leading-relaxed"
        style={{ fontFamily: 'system-ui, sans-serif' }}
      >
        {variation.post}
      </div>

      {/* Why this angle */}
      <p className="mb-4 text-sm italic text-muted-foreground">{variation.whyThisAngle}</p>

      {/* Evaluation badges */}
      <div className="mb-4 flex flex-wrap gap-2">
        <span
          className={cn(
            'rounded px-2 py-0.5 text-xs',
            variation.evaluation.hookStrength === 'strong'
              ? 'bg-green-500/10 text-green-600'
              : variation.evaluation.hookStrength === 'medium'
              ? 'bg-yellow-500/10 text-yellow-600'
              : 'bg-red-500/10 text-red-600'
          )}
        >
          Hook: {variation.evaluation.hookStrength}
        </span>
        {variation.evaluation.credibilityClear && (
          <span className="rounded bg-blue-500/10 px-2 py-0.5 text-xs text-blue-600">
            Credibility Clear
          </span>
        )}
        {variation.evaluation.aiClicheFree && (
          <span className="rounded bg-purple-500/10 px-2 py-0.5 text-xs text-purple-600">
            AI-Cliché Free
          </span>
        )}
        {variation.evaluation.contentsSpecific && (
          <span className="rounded bg-green-500/10 px-2 py-0.5 text-xs text-green-600">
            Specific
          </span>
        )}
      </div>

      {/* Select button */}
      <button
        onClick={onSelect}
        className={cn(
          'w-full rounded-lg py-3 font-medium transition-colors',
          isSelected
            ? 'bg-primary text-primary-foreground'
            : 'bg-secondary hover:bg-secondary/80'
        )}
      >
        {isSelected ? (
          <span className="flex items-center justify-center gap-2">
            <Check className="h-4 w-4" />
            Selected
          </span>
        ) : (
          'Select This Post'
        )}
      </button>
    </motion.div>
  );
}

export function PostStep({ result, onSelect, onBack }: PostStepProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleCopy = async (index: number) => {
    await navigator.clipboard.writeText(result.variations[index].post);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleContinue = () => {
    if (selectedIndex !== null) {
      onSelect(selectedIndex);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">Choose your LinkedIn post</h1>
          <p className="mt-2 text-muted-foreground">
            We generated 3 variations with different hooks. Pick the one that resonates most.
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

      {/* Swipe File Inspiration */}
      <SwipeFileInspiration type="posts" limit={3} />

      {/* Recommendation */}
      <div className="rounded-lg bg-primary/10 p-4">
        <div className="mb-1 text-sm font-medium text-primary">Our Recommendation</div>
        <p className="text-sm">{result.recommendation}</p>
      </div>

      {/* Post variations */}
      <div className="space-y-4">
        {result.variations.map((variation, index) => (
          <PostCard
            key={index}
            variation={variation}
            index={index}
            isSelected={selectedIndex === index}
            onSelect={() => setSelectedIndex(index)}
            onCopy={() => handleCopy(index)}
            copied={copiedIndex === index}
          />
        ))}
      </div>

      {/* DM Template */}
      <div className="rounded-xl border bg-card p-5">
        <h3 className="mb-2 font-semibold">DM Template</h3>
        <p className="text-sm text-muted-foreground">
          Send this to people who comment &quot;{result.ctaWord}&quot;:
        </p>
        <div className="mt-2 rounded-lg bg-muted p-3 text-sm">{result.dmTemplate}</div>
      </div>

      {/* Continue button */}
      {selectedIndex !== null && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="sticky bottom-4"
        >
          <button
            onClick={handleContinue}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-6 py-4 text-lg font-semibold text-primary-foreground shadow-lg"
          >
            Continue to Publishing
          </button>
        </motion.div>
      )}
    </div>
  );
}
