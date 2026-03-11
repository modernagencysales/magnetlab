'use client';

/** EnrollmentCTA. Sales page shown to unenrolled users.
 *  Displays product overview, 8-module list, $997 pricing, and Stripe checkout button.
 *  Never imports NextRequest, NextResponse, or cookies. */

import { useState } from 'react';
import { MODULE_IDS, MODULE_NAMES } from '@/lib/types/accelerator';
import type { ModuleId } from '@/lib/types/accelerator';
import { startEnrollment } from '@/frontend/api/accelerator';

// ─── Constants ───────────────────────────────────────────

const MODULE_DESCRIPTIONS: Record<ModuleId, string> = {
  m0: 'Define your ideal client with the Caroline Framework',
  m1: 'Create lead magnets, funnels, and email sequences',
  m2: 'Build a segmented, enriched Total Addressable Market',
  m3: 'Set up LinkedIn DM campaigns',
  m4: 'Launch cold email infrastructure and campaigns',
  m5: 'Plan and optimize LinkedIn Ads',
  m6: 'Build daily rhythms and weekly reviews',
  m7: 'Create a content engine with scheduling',
};

const MODULE_ICONS: Record<ModuleId, string> = {
  m0: '🎯',
  m1: '🧲',
  m2: '🗺️',
  m3: '💬',
  m4: '📧',
  m5: '📣',
  m6: '⚙️',
  m7: '✍️',
};

// ─── Component ───────────────────────────────────────────

export default function EnrollmentCTA() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEnroll = async () => {
    setLoading(true);
    setError(null);

    try {
      const { url } = await startEnrollment();
      if (!url) throw new Error('No checkout URL returned');
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      {/* ─── Header ─── */}
      <div className="mb-12 text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-violet-100 px-4 py-1.5 text-sm font-medium text-violet-700">
          AI-Powered GTM Program
        </div>
        <h1 className="mb-4 text-4xl font-bold tracking-tight text-gray-900">GTM Accelerator</h1>
        <p className="mx-auto max-w-2xl text-lg text-gray-600">
          A structured 8-module program that takes you from positioning to a fully operating
          go-to-market machine — with an AI co-pilot guiding every step.
        </p>
      </div>

      {/* ─── Module Grid ─── */}
      <div className="mb-12 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {MODULE_IDS.map((id, index) => (
          <div key={id} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50 text-base">
                {MODULE_ICONS[id]}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-violet-500">
                  Module {index}
                </span>
              </div>
            </div>
            <h3 className="mb-1 font-semibold text-gray-900">{MODULE_NAMES[id]}</h3>
            <p className="text-sm text-gray-500">{MODULE_DESCRIPTIONS[id]}</p>
          </div>
        ))}
      </div>

      {/* ─── Pricing & CTA ─── */}
      <div className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-purple-50 p-8 text-center">
        <p className="mb-1 text-sm font-medium uppercase tracking-wide text-violet-600">
          One-time investment
        </p>
        <div className="mb-2 flex items-baseline justify-center gap-1">
          <span className="text-5xl font-bold text-gray-900">$997</span>
        </div>
        <p className="mb-8 text-sm text-gray-500">
          Full program access — all 8 modules, AI co-pilot, SOPs, and deliverable reviews
        </p>

        {error && (
          <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
        )}

        <button
          onClick={handleEnroll}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-8 py-4 text-base font-semibold text-white shadow-lg transition-all hover:bg-violet-700 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Redirecting to checkout…
            </>
          ) : (
            'Get Started — $997'
          )}
        </button>

        <p className="mt-4 text-xs text-gray-400">Secure checkout powered by Stripe</p>
      </div>
    </div>
  );
}
