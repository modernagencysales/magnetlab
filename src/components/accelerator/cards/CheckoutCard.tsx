'use client';

/** CheckoutCard. Displays tool provisioning checkout details with tier, features, price, and a checkout link. Never imports server-only modules. */

// ─── Types ────────────────────────────────────────────────

export interface CheckoutData {
  title?: string;
  tier?: string;
  features?: string[];
  price?: string;
  checkoutUrl?: string;
}

interface CheckoutCardProps {
  data: CheckoutData | undefined;
  onApply?: (type: string, data: unknown) => void;
}

// ─── Component ────────────────────────────────────────────

export default function CheckoutCard({ data, onApply }: CheckoutCardProps) {
  if (!data) return null;

  const handleProceed = () => {
    onApply?.('checkout', data);
    if (data.checkoutUrl) {
      window.open(data.checkoutUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="rounded-lg border bg-card p-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {data.title ?? 'Tool Provisioning'}
        </h3>
        {data.tier && (
          <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
            {data.tier}
          </span>
        )}
      </div>

      {/* Features */}
      {data.features && data.features.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {data.features.map((feature, idx) => (
            <li
              key={idx}
              className="flex items-start gap-2 text-xs text-zinc-600 dark:text-zinc-400"
            >
              <svg
                aria-hidden="true"
                width="12"
                height="12"
                viewBox="0 0 12 12"
                className="mt-0.5 shrink-0 text-violet-500"
              >
                <circle cx="6" cy="6" r="5" fill="currentColor" />
                <path
                  d="M4 6l1.5 1.5L8 5"
                  stroke="white"
                  strokeWidth="1.2"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Price */}
      {data.price && (
        <p className="mt-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">{data.price}</p>
      )}

      {/* CTA */}
      {data.checkoutUrl ? (
        <button
          onClick={handleProceed}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-md bg-violet-600 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-1"
        >
          <svg
            aria-hidden="true"
            width="12"
            height="12"
            viewBox="0 0 12 12"
            className="text-white/70"
          >
            <rect
              x="1"
              y="3"
              width="10"
              height="7"
              rx="1.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
            />
            <path
              d="M3 3V2.5a3 3 0 016 0V3"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          </svg>
          Proceed to Checkout
        </button>
      ) : (
        <p className="mt-3 text-xs text-zinc-400">No checkout URL available.</p>
      )}
    </div>
  );
}
