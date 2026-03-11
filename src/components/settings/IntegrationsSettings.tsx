'use client';

import { Link2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, Separator } from '@magnetlab/magnetui';
import { LinkedInSettings } from '@/components/settings/LinkedInSettings';
import { ResendSettings } from '@/components/settings/ResendSettings';
import { ConductorSettings } from '@/components/settings/ConductorSettings';
import { FathomSettings } from '@/components/settings/FathomSettings';
import { EmailMarketingSettings } from '@/components/settings/EmailMarketingSettings';
import { GoHighLevelSettings } from '@/components/settings/GoHighLevelSettings';
import { KajabiSettings } from '@/components/settings/KajabiSettings';
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
  const kajabiIntegration = integrations.find((i) => i.service === 'kajabi');
  const heyreachIntegration = integrations.find((i) => i.service === 'heyreach');

  return (
    <div className="space-y-6">
      <Card className="border-border">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Link2 className="h-5 w-5 text-primary" />
            <CardTitle>Integrations</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <LinkedInSettings
            isConnected={unipileIntegration?.is_active ?? false}
            accountName={
              (unipileIntegration?.metadata as { unipile_account_name?: string } | undefined)
                ?.unipile_account_name ?? null
            }
          />

          <Separator />
          <div id="email">
            <ResendSettings
              isConnected={resendIntegration?.is_active ?? false}
              lastVerifiedAt={resendIntegration?.last_verified_at ?? null}
              metadata={
                resendIntegration?.metadata as { fromEmail?: string; fromName?: string } | undefined
              }
            />
          </div>

          <Separator />
          <div id="conductor">
            <ConductorSettings
              isConnected={conductorIntegration?.is_active ?? false}
              lastVerifiedAt={conductorIntegration?.last_verified_at ?? null}
              metadata={conductorIntegration?.metadata as { endpointUrl?: string } | undefined}
            />
          </div>

          <Separator />
          <div id="analytics">
            <FathomSettings isConnected={fathomIntegration?.is_active ?? false} />
          </div>

          <Separator />
          <div id="marketing">
            <EmailMarketingSettings integrations={integrations} />
          </div>

          <Separator />
          <div id="crm">
            <h3 className="text-sm font-semibold mb-2">CRM</h3>
            <p className="text-xs text-muted-foreground mb-4">
              Push leads to your CRM when they opt in to your funnels.
            </p>
            <GoHighLevelSettings
              isConnected={gohighlevelIntegration?.is_active ?? false}
              lastVerifiedAt={gohighlevelIntegration?.last_verified_at ?? null}
            />
            <KajabiSettings
              isConnected={kajabiIntegration?.is_active ?? false}
              lastVerifiedAt={kajabiIntegration?.last_verified_at ?? null}
            />
          </div>

          <Separator />
          <div id="delivery">
            <h3 className="text-sm font-semibold mb-2">LinkedIn Delivery</h3>
            <p className="text-xs text-muted-foreground mb-4">
              Deliver lead magnets to leads via LinkedIn DM campaigns.
            </p>
            <HeyReachSettings
              isConnected={heyreachIntegration?.is_active ?? false}
              lastVerifiedAt={heyreachIntegration?.last_verified_at ?? null}
            />
          </div>

          <Separator />
          <div id="pixels">
            <h3 className="text-sm font-semibold mb-2">Tracking Pixels</h3>
            <p className="text-xs text-muted-foreground mb-4">
              Add conversion tracking to your funnel pages. Events fire both client-side and
              server-side for maximum accuracy.
            </p>
            <TrackingPixelSettings integrations={integrations} />
          </div>

          <Separator />
          <div id="widgets">
            <h3 className="text-sm font-semibold mb-2">Widgets</h3>
            <p className="text-xs text-muted-foreground mb-4">
              Add floating widgets to your content pages.
            </p>
            <div className="space-y-4 mt-4">
              <IClosedWidgetSettings
                integration={integrations.find((i) => i.service === 'iclosed_widget')}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
