'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

interface OptinPageProps {
  funnelId: string;
  headline: string;
  subline: string | null;
  buttonText: string;
  socialProof: string | null;
  username: string;
  slug: string;
}

export function OptinPage({
  funnelId,
  headline,
  subline,
  buttonText,
  socialProof,
  username,
  slug,
}: OptinPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/public/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          funnelPageId: funnelId,
          email,
          name: name || undefined,
          utmSource: searchParams.get('utm_source') || undefined,
          utmMedium: searchParams.get('utm_medium') || undefined,
          utmCampaign: searchParams.get('utm_campaign') || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to submit');
      }

      const { leadId } = await response.json();

      // Redirect to thank-you page
      router.push(`/p/${username}/${slug}/thankyou?leadId=${leadId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
      style={{ background: '#09090B' }}
    >
      <div className="w-full max-w-md space-y-8 text-center">
        {/* Headline */}
        <h1
          className="text-3xl md:text-4xl font-semibold leading-tight"
          style={{ color: '#FAFAFA' }}
        >
          {headline}
        </h1>

        {/* Subline */}
        {subline && (
          <p
            className="text-lg leading-relaxed"
            style={{ color: '#A1A1AA' }}
          >
            {subline}
          </p>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name (optional)"
            className="w-full rounded-lg px-4 py-3 text-sm outline-none transition-colors"
            style={{
              background: '#09090B',
              border: '1px solid #27272A',
              color: '#FAFAFA',
            }}
          />

          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email..."
            required
            className="w-full rounded-lg px-4 py-3 text-sm outline-none transition-colors"
            style={{
              background: '#09090B',
              border: '1px solid #27272A',
              color: '#FAFAFA',
            }}
          />

          {error && (
            <p className="text-sm" style={{ color: '#F87171' }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || !email}
            className="w-full rounded-lg px-4 py-3 text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            style={{
              background: '#8B5CF6',
              color: '#FAFAFA',
            }}
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {buttonText}
          </button>
        </form>

        {/* Social Proof */}
        {socialProof && (
          <p
            className="text-sm"
            style={{ color: '#71717A' }}
          >
            {socialProof}
          </p>
        )}
      </div>

      {/* Powered by */}
      <div className="mt-12">
        <a
          href="https://magnetlab.app"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs transition-colors hover:opacity-80"
          style={{ color: '#52525B' }}
        >
          Powered by MagnetLab
        </a>
      </div>
    </div>
  );
}
