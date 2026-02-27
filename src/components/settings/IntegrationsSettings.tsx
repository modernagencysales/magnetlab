'use client';

import { Link2 } from 'lucide-react';
import { LinkedInSettings } from '@/components/settings/LinkedInSettings';
import { ResendSettings } from '@/components/settings/ResendSettings';
import { ConductorSettings } from '@/components/settings/ConductorSettings';
import { FathomSettings } from '@/components/settings/FathomSettings';
import { EmailMarketingSettings } from '@/components/settings/EmailMarketingSettings';
import { GoHighLevelSettings } from '@/components/settings/GoHighLevelSettings';
import { HeyReachSettings } from '@/components/settings/HeyReachSettings';
import { TrackingPixelSettings } from '@/components/settings/TrackingPixelSettings';
import { IClosedWidgetSettings } from '@/components/settings/IClosedWidgetSettings';

interface Integration {
  service: string;
  is_active: boolean;
  last_verified_at: string | null;
  metadata?: Record<string, unknown>;
}

interface IntegrationsSettingsProps {
  integrations: Integration[];
}

export function IntegrationsSettings({ integrations }: IntegrationsSettingsProps) {
  const resendIntegration = integrations.find((i) => i.service === 'resend');
  const conductorIntegration = integrations.find((i) => i.service === 'conductor');
  const fathomIntegration = integrations.find((i) => i.service === 'fathom');
  const unipileIntegration = integrations.find((i) => i.service === 'unipile');
  const gohighlevelIntegration = integrations.find((i) => i.service === 'gohighlevel');
  const heyreachIntegration = integrations.find((i) => i.service === 'heyreach');

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-card p-6 transition-colors">
        <div className="mb-4 flex items-center gap-3">
          <Link2 className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Integrations</h2>
        </div>

        <LinkedInSettings
          isConnected={unipileIntegration?.is_active ?? false}
          accountName={(unipileIntegration?.metadata as { unipile_account_name?: string } | undefined)?.unipile_account_name ?? null}
        />

        <div id="email" className="mt-6 pt-6 border-t">
          <ResendSettings
            isConnected={resendIntegration?.is_active ?? false}
            lastVerifiedAt={resendIntegration?.last_verified_at ?? null}
            metadata={resendIntegration?.metadata as { fromEmail?: string; fromName?: string } | undefined}
          />
        </div>

        <div id="conductor" className="mt-6 pt-6 border-t">
          <ConductorSettings
            isConnected={conductorIntegration?.is_active ?? false}
            lastVerifiedAt={conductorIntegration?.last_verified_at ?? null}
            metadata={conductorIntegration?.metadata as { endpointUrl?: string } | undefined}
          />
        </div>

        <div id="analytics" className="mt-6 pt-6 border-t">
          <FathomSettings
            isConnected={fathomIntegration?.is_active ?? false}
          />
        </div>

        <div id="marketing" className="mt-6 pt-6 border-t">
          <EmailMarketingSettings integrations={integrations} />
        </div>

        <div id="crm" className="mt-6 pt-6 border-t">
          <h3 className="text-sm font-semibold mb-1">CRM</h3>
          <p className="text-xs text-muted-foreground mb-3">
            Push leads to your CRM when they opt in to your funnels.
          </p>
          <GoHighLevelSettings
            isConnected={gohighlevelIntegration?.is_active ?? false}
            lastVerifiedAt={gohighlevelIntegration?.last_verified_at ?? null}
          />
        </div>

        <div id="delivery" className="mt-6 pt-6 border-t">
          <h3 className="text-sm font-semibold mb-1">LinkedIn Delivery</h3>
          <p className="text-xs text-muted-foreground mb-3">
            Deliver lead magnets to leads via LinkedIn DM campaigns.
          </p>
          <HeyReachSettings
            isConnected={heyreachIntegration?.is_active ?? false}
            lastVerifiedAt={heyreachIntegration?.last_verified_at ?? null}
          />
        </div>

        <div id="pixels" className="mt-6 pt-6 border-t">
          <h3 className="text-sm font-semibold mb-1">Tracking Pixels</h3>
          <p className="text-xs text-muted-foreground mb-3">
            Add conversion tracking to your funnel pages. Events fire both client-side and server-side for maximum accuracy.
          </p>
          <TrackingPixelSettings integrations={integrations} />
        </div>

        <div id="widgets" className="mt-6 pt-6 border-t">
          <h3 className="text-sm font-semibold mb-1">Widgets</h3>
          <p className="text-xs text-muted-foreground mb-3">
            Add floating widgets to your content pages.
          </p>
          <div className="space-y-4 mt-4">
            <IClosedWidgetSettings
              integration={integrations.find((i) => i.service === 'iclosed_widget')}
            />
          </div>
        </div>

      </div>
    </div>
  );
}
