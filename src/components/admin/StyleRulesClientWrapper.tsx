/**
 * StyleRulesClientWrapper. Thin client boundary that holds style rules state
 * and passes refresh callback to StyleRulesSection.
 * Receives initialRules from the server page; refreshes via client fetch on changes.
 */

'use client';

import { useState, useCallback } from 'react';
import StyleRulesSection from './StyleRulesSection';

interface StyleRule {
  id: string;
  pattern_name: string;
  rule_text: string;
  frequency: number;
  confidence: number;
  status: 'proposed' | 'approved' | 'rejected';
  proposed_at: string;
  reviewed_at: string | null;
}

interface StyleRulesClientWrapperProps {
  initialRules: StyleRule[];
}

export default function StyleRulesClientWrapper({ initialRules }: StyleRulesClientWrapperProps) {
  const [rules, setRules] = useState<StyleRule[]>(initialRules);

  const refreshRules = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/style-rules?status=all');
      if (res.ok) {
        const data = await res.json();
        setRules(data.rules ?? []);
      }
    } catch (err) {
      console.error('[StyleRulesClientWrapper] Failed to refresh rules:', err);
    }
  }, []);

  return <StyleRulesSection rules={rules} onRefresh={refreshRules} />;
}
