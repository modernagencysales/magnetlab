/**
 * Detect if a post contains a "comment X to get Y" lead magnet CTA.
 * Matches patterns like: "comment GUIDE", "comment below", "drop a YES",
 * "DM me", "type SEND below", etc.
 */
export const LEAD_MAGNET_CTA_PATTERN = /\b(comment\s+["']?\w+["']?|comment\s+below|drop\s+(a\s+)?["']?\w+["']?\s*(below|in\s+the\s+comments)?|DM\s+me\s+["']?\w+["']?|type\s+["']?\w+["']?\s*(below|in\s+the\s+comments)|send\s+me\s+["']?\w+["']?)\b/i;

export function hasLeadMagnetCTA(content: string): boolean {
  return LEAD_MAGNET_CTA_PATTERN.test(content);
}
