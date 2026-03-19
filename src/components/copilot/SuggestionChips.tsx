/** SuggestionChips. Clickable prompt suggestion chips for the copilot homepage. Constraint: Client-only, no data fetching. */

'use client';

import type { Suggestion } from '@/frontend/hooks/api/useHomepageData';

// ─── Props ────────────────────────────────────────────────

interface SuggestionChipsProps {
  suggestions: Suggestion[];
  onSelect: (action: string) => void;
}

// ─── Component ────────────────────────────────────────────

export function SuggestionChips({ suggestions, onSelect }: SuggestionChipsProps) {
  return (
    <div className="flex flex-wrap gap-2 justify-center max-w-lg mx-auto">
      {suggestions.map((suggestion) => (
        <button
          key={suggestion.action}
          onClick={() => onSelect(suggestion.action)}
          className="bg-card border border-border rounded-full px-4 py-2 text-sm text-muted-foreground hover:bg-accent cursor-pointer transition-colors"
        >
          {suggestion.label}
        </button>
      ))}
    </div>
  );
}
