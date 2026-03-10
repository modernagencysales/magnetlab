/**
 * Signal Digest Service
 * Pure functions for building daily digest entries and formatting Slack messages.
 */

export interface DigestEntry {
  name: string;
  headline: string | null;
  compound_score: number;
  signal_count: number;
  linkedin_url: string;
  top_signals: string[];
}

export function buildDigestEntries(
  leads: Array<{
    first_name: string | null;
    last_name: string | null;
    headline: string | null;
    compound_score: number;
    signal_count: number;
    linkedin_url: string;
    signal_events?: Array<{ signal_type: string }>;
  }>
): DigestEntry[] {
  return leads.map((lead) => {
    const name = [lead.first_name, lead.last_name].filter(Boolean).join(' ') || 'Unknown';
    const topSignals = [...new Set((lead.signal_events || []).map((e) => e.signal_type))].slice(
      0,
      3
    );

    return {
      name,
      headline: lead.headline,
      compound_score: lead.compound_score,
      signal_count: lead.signal_count,
      linkedin_url: lead.linkedin_url,
      top_signals: topSignals,
    };
  });
}

export function formatSlackMessage(entries: DigestEntry[], userName?: string): string {
  if (entries.length === 0) {
    return '*Signal Digest*\nNo high-scoring leads today. Keep monitoring!';
  }

  const header = userName ? `*Daily Signal Digest for ${userName}*` : '*Daily Signal Digest*';

  const lines = entries.map((entry, i) => {
    const signals = entry.top_signals.length > 0 ? entry.top_signals.join(', ') : 'no signals';
    return [
      `*${i + 1}. <${entry.linkedin_url}|${entry.name}>* (score: ${entry.compound_score})`,
      entry.headline ? `   _${entry.headline}_` : null,
      `   Signals: ${signals} | Events: ${entry.signal_count}`,
    ]
      .filter(Boolean)
      .join('\n');
  });

  return [header, '', ...lines].join('\n');
}
