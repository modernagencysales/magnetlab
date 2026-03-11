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

// ─── SVG Module Icons ────────────────────────────────────

function ModuleIcon({ id }: { id: ModuleId }) {
  const cls = 'text-violet-600';
  const s = 16;
  switch (id) {
    case 'm0': // ICP — crosshair
      return (
        <svg aria-hidden="true" width={s} height={s} viewBox="0 0 16 16" className={cls}>
          <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="8" cy="8" r="2.5" fill="currentColor" />
          <path
            d="M8 1v3M8 12v3M1 8h3M12 8h3"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'm1': // Lead magnets — magnet
      return (
        <svg aria-hidden="true" width={s} height={s} viewBox="0 0 16 16" className={cls}>
          <path
            d="M4 3v5a4 4 0 008 0V3"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path d="M4 3h2v2H4zM10 3h2v2h-2z" fill="currentColor" />
        </svg>
      );
    case 'm2': // TAM — map
      return (
        <svg aria-hidden="true" width={s} height={s} viewBox="0 0 16 16" className={cls}>
          <path
            d="M2 3l4 2v8l-4-2zM6 5l4-2v8l-4 2zM10 3l4 2v8l-4-2z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'm3': // LinkedIn — chat bubble
      return (
        <svg aria-hidden="true" width={s} height={s} viewBox="0 0 16 16" className={cls}>
          <path
            d="M2 3h12v8H6l-3 2v-2H2z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path
            d="M5 6.5h6M5 8.5h4"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'm4': // Cold email — envelope
      return (
        <svg aria-hidden="true" width={s} height={s} viewBox="0 0 16 16" className={cls}>
          <rect
            x="1.5"
            y="3.5"
            width="13"
            height="9"
            rx="1.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path
            d="M1.5 4.5l6.5 4 6.5-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'm5': // Ads — megaphone
      return (
        <svg aria-hidden="true" width={s} height={s} viewBox="0 0 16 16" className={cls}>
          <path
            d="M2 6h2v4H2zM4 6l8-3v10L4 10z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path
            d="M12 5.5h1.5a1 1 0 011 1v3a1 1 0 01-1 1H12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
          />
        </svg>
      );
    case 'm6': // Operations — gear
      return (
        <svg aria-hidden="true" width={s} height={s} viewBox="0 0 16 16" className={cls}>
          <circle cx="8" cy="8" r="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.4 1.4M11.55 11.55l1.4 1.4M3.05 12.95l1.4-1.4M11.55 4.45l1.4-1.4"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'm7': // Content — pencil
      return (
        <svg aria-hidden="true" width={s} height={s} viewBox="0 0 16 16" className={cls}>
          <path
            d="M10.5 2.5l3 3L5.5 13.5H2.5v-3z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path d="M9 4l3 3" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      );
    default:
      return null;
  }
}

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
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50">
                <ModuleIcon id={id} />
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
