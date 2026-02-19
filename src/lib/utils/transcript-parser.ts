/**
 * Parse unique speaker names from common transcript formats.
 *
 * Handles:
 * - "Speaker Name: dialogue text"
 * - "[00:01:23] Speaker Name: dialogue text"
 * - "Speaker Name (00:01:23): dialogue text"
 */
export function parseSpeakerNames(rawTranscript: string): string[] {
  const speakers = new Set<string>();
  const lines = rawTranscript.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Pattern 1: "Name: text" (most common, from Attio, Grain, etc.)
    const simple = trimmed.match(/^([A-Z][^:]{1,48}):\s/);
    if (simple) {
      speakers.add(simple[1].trim());
      continue;
    }

    // Pattern 2: "[timestamp] Name: text"
    const timestamped = trimmed.match(/^\[[\d:.]+\]\s*([A-Z][^:]{1,48}):\s/);
    if (timestamped) {
      speakers.add(timestamped[1].trim());
      continue;
    }

    // Pattern 3: "Name (timestamp): text"
    const parenTimestamp = trimmed.match(/^([A-Z][^(]{1,48})\s*\([\d:.]+\):\s/);
    if (parenTimestamp) {
      speakers.add(parenTimestamp[1].trim());
    }
  }

  return Array.from(speakers).sort();
}
