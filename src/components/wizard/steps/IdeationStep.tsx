'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Check, Star, Zap, Trophy } from 'lucide-react';
import type { IdeationResult, LeadMagnetConcept } from '@/lib/types/lead-magnet';
import { ARCHETYPE_NAMES } from '@/lib/types/lead-magnet';
import { cn } from '@/lib/utils';
import { SwipeFileInspiration } from '@/components/swipe-file/SwipeFileInspiration';

interface IdeationStepProps {
  result: IdeationResult;
  onSelect: (index: number) => void;
  onBack: () => void;
}

function getRecommendationBadge(
  index: number,
  recommendations: IdeationResult['recommendations']
) {
  if (index === recommendations.shipThisWeek.conceptIndex) {
    return { label: 'Ship This Week', icon: Zap, color: 'bg-green-500' };
  }
  if (index === recommendations.highestEngagement.conceptIndex) {
    return { label: 'Highest Engagement', icon: Star, color: 'bg-yellow-500' };
  }
  if (index === recommendations.bestAuthorityBuilder.conceptIndex) {
    return { label: 'Authority Builder', icon: Trophy, color: 'bg-purple-500' };
  }
  return null;
}

function ConceptCard({
  concept,
  index,
  isSelected,
  badge,
  onSelect,
}: {
  concept: LeadMagnetConcept;
  index: number;
  isSelected: boolean;
  badge: ReturnType<typeof getRecommendationBadge>;
  onSelect: () => void;
}) {
  const viralScore = Object.values(concept.viralCheck).filter(Boolean).length;

  return (
    <motion.button
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      onClick={onSelect}
      className={cn(
        'relative w-full rounded-xl border p-5 text-left transition-all hover:border-primary',
        isSelected ? 'border-primary bg-primary/5 ring-2 ring-primary' : 'bg-card'
      )}
    >
      {badge && (
        <div
          className={cn(
            'absolute -top-2 right-4 flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-white',
            badge.color
          )}
        >
          <badge.icon className="h-3 w-3" />
          {badge.label}
        </div>
      )}

      <div className="mb-2 text-xs font-medium text-muted-foreground">
        {ARCHETYPE_NAMES[concept.archetype]}
      </div>

      <h3 className="mb-2 text-lg font-semibold">{concept.title}</h3>

      <p className="mb-3 text-sm text-muted-foreground">{concept.painSolved}</p>

      {concept.groundedIn && (
        <p className="mb-3 text-xs text-primary/80 italic">Based on: {concept.groundedIn}</p>
      )}

      <div className="mb-3 flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Viral Score:</span>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className={cn(
                'h-2 w-2 rounded-full',
                i <= viralScore ? 'bg-primary' : 'bg-muted'
              )}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-1">
        {concept.viralCheck.highValue && (
          <span className="rounded bg-green-500/10 px-2 py-0.5 text-xs text-green-600">
            $50+ Value
          </span>
        )}
        {concept.viralCheck.urgentPain && (
          <span className="rounded bg-red-500/10 px-2 py-0.5 text-xs text-red-600">
            Urgent Pain
          </span>
        )}
        {concept.viralCheck.actionableUnder1h && (
          <span className="rounded bg-blue-500/10 px-2 py-0.5 text-xs text-blue-600">
            Quick Win
          </span>
        )}
      </div>

      {isSelected && (
        <div className="absolute right-3 top-3">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Check className="h-4 w-4" />
          </div>
        </div>
      )}
    </motion.button>
  );
}

export function IdeationStep({ result, onSelect, onBack }: IdeationStepProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const handleSelect = (index: number) => {
    setSelectedIndex(index);
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
          <h1 className="text-3xl font-bold">Choose your lead magnet</h1>
          <p className="mt-2 text-muted-foreground">
            We generated 10 concepts based on your expertise. Pick the one that excites you most.
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
      <SwipeFileInspiration type="lead-magnets" limit={3} />

      <div className="grid gap-4 md:grid-cols-2">
        {result.concepts.map((concept, index) => (
          <ConceptCard
            key={index}
            concept={concept}
            index={index}
            isSelected={selectedIndex === index}
            badge={getRecommendationBadge(index, result.recommendations)}
            onSelect={() => handleSelect(index)}
          />
        ))}
      </div>

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
            Continue with &quot;{result.concepts[selectedIndex].title}&quot;
          </button>
        </motion.div>
      )}
    </div>
  );
}
