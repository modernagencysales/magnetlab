import type { EditPattern } from '@/lib/types/content-pipeline';

interface EditHistoryRow {
  auto_classified_changes: { patterns: Array<{ pattern: string; description: string }> } | null;
  created_at: string;
}

/**
 * Aggregates classified edit patterns from edit history rows into a
 * deduplicated, ranked list of EditPattern objects with confidence scores.
 *
 * - Merges duplicate patterns by counting occurrences
 * - Keeps the latest description for each pattern
 * - Confidence = min(count / 10, 1) — caps at 1.0 after 10 occurrences
 * - Tracks first/last seen timestamps
 * - Sorts by count descending
 */
export function aggregateEditPatterns(edits: EditHistoryRow[]): EditPattern[] {
  const patternMap = new Map<
    string,
    { descriptions: string[]; count: number; first_seen: string; last_seen: string }
  >();

  for (const edit of edits) {
    if (!edit.auto_classified_changes?.patterns) continue;
    for (const p of edit.auto_classified_changes.patterns) {
      const existing = patternMap.get(p.pattern);
      if (existing) {
        existing.count++;
        existing.descriptions.push(p.description);
        if (edit.created_at > existing.last_seen) existing.last_seen = edit.created_at;
        if (edit.created_at < existing.first_seen) existing.first_seen = edit.created_at;
      } else {
        patternMap.set(p.pattern, {
          descriptions: [p.description],
          count: 1,
          first_seen: edit.created_at,
          last_seen: edit.created_at,
        });
      }
    }
  }

  return Array.from(patternMap.entries())
    .map(([pattern, data]) => ({
      pattern,
      description: data.descriptions[data.descriptions.length - 1],
      confidence: Math.min(data.count / 10, 1),
      count: data.count,
      first_seen: data.first_seen,
      last_seen: data.last_seen,
    }))
    .sort((a, b) => b.count - a.count);
}
