'use client';

export default function Tracking() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Tracking &amp; Attribution</h1>
      <p className="text-muted-foreground mb-8">
        Track conversions from your ad campaigns with server-side tracking pixels for Meta and
        LinkedIn.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-4">Meta Pixel (Facebook/Instagram)</h2>
      <p className="text-sm mb-4">
        Track conversions from Meta ads with server-side Conversions API.
      </p>
      <ol className="list-decimal list-inside space-y-3 text-sm">
        <li>
          Go to <strong>Settings</strong> &rarr; <strong>Tracking</strong>
        </li>
        <li>
          Under Meta Pixel, enter:
          <ul className="list-disc list-inside space-y-2 text-sm ml-6 mt-2">
            <li>
              <strong>Pixel ID</strong> &mdash; from Meta Events Manager
            </li>
            <li>
              <strong>Access Token</strong> &mdash; from Meta Events Manager &rarr; Settings &rarr;
              Generate Access Token
            </li>
          </ul>
        </li>
        <li>Save</li>
      </ol>
      <p className="text-sm mt-4">MagnetLab fires these events server-side:</p>
      <ul className="list-disc list-inside space-y-2 text-sm mt-2">
        <li>
          <strong>Lead</strong> event on opt-in (
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">lead.created</code>)
        </li>
        <li>
          <strong>CompleteRegistration</strong> event on qualification (
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">lead.qualified</code>)
        </li>
      </ul>

      <h2 className="text-xl font-semibold mt-8 mb-4">LinkedIn Insight Tag</h2>
      <p className="text-sm mb-4">
        Track conversions from LinkedIn ads with server-side CAPI.
      </p>
      <ol className="list-decimal list-inside space-y-3 text-sm">
        <li>
          Go to <strong>Settings</strong> &rarr; <strong>Tracking</strong>
        </li>
        <li>
          Under LinkedIn, enter:
          <ul className="list-disc list-inside space-y-2 text-sm ml-6 mt-2">
            <li>
              <strong>Partner ID</strong> &mdash; from LinkedIn Campaign Manager
            </li>
            <li>
              <strong>Access Token</strong> &mdash; from LinkedIn Campaign Manager API settings
            </li>
          </ul>
        </li>
        <li>Save</li>
      </ol>
      <p className="text-sm mt-4">
        MagnetLab fires conversion events server-side for both opt-in and qualification.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-4">UTM Parameters</h2>
      <p className="text-sm mb-4">
        Track which traffic sources drive the most leads. Append UTM parameters to your landing page
        URL:
      </p>
      <div className="rounded-lg border bg-muted/30 p-4 my-4 overflow-x-auto">
        <code className="text-xs font-mono">
          magnetlab.ai/p/username/slug?utm_source=linkedin&amp;utm_medium=social&amp;utm_campaign=launch
        </code>
      </div>
      <p className="text-sm mb-2">Supported parameters:</p>
      <ul className="list-disc list-inside space-y-2 text-sm">
        <li>
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">utm_source</code>{' '}
          &mdash; where the traffic comes from (linkedin, facebook, email)
        </li>
        <li>
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">utm_medium</code>{' '}
          &mdash; the marketing medium (social, cpc, email)
        </li>
        <li>
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">utm_campaign</code>{' '}
          &mdash; your campaign name
        </li>
      </ul>
      <p className="text-sm mt-4">UTM values are:</p>
      <ul className="list-disc list-inside space-y-2 text-sm mt-2">
        <li>Stored with each lead in MagnetLab</li>
        <li>
          Included in webhook payloads (
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">data.utmSource</code>,{' '}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">data.utmMedium</code>,{' '}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">data.utmCampaign</code>)
        </li>
        <li>Visible in the Leads dashboard</li>
      </ul>

      <h2 className="text-xl font-semibold mt-8 mb-4">Tips</h2>
      <div className="rounded-lg border bg-muted/30 p-4 my-4">
        <ul className="list-disc list-inside space-y-2 text-sm">
          <li>
            Server-side tracking is more reliable than client-side pixels &mdash; it&apos;s not
            blocked by ad blockers
          </li>
          <li>
            You can use UTM parameters with any traffic source, not just paid ads
          </li>
          <li>
            Combine tracking with qualification to measure lead quality, not just volume
          </li>
        </ul>
      </div>
    </div>
  );
}
