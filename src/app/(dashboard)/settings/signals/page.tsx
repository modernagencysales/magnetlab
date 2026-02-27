import { Settings2 } from 'lucide-react';
import { SignalConfig } from '@/components/settings/SignalConfig';
import { KeywordMonitors } from '@/components/settings/KeywordMonitors';
import { CompanyMonitors } from '@/components/settings/CompanyMonitors';
import { CompetitorMonitoring } from '@/components/settings/CompetitorMonitoring';

export const metadata = {
  title: 'Signal Engine | MagnetLab Settings',
};

export default function SignalsPage() {
  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-card p-6 transition-colors">
        <div className="mb-4 flex items-center gap-3">
          <Settings2 className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Signal Engine</h2>
        </div>
        <p className="mb-2 text-sm text-muted-foreground">
          Configure ICP targeting, keyword monitoring, and company page tracking for your signal engine.
        </p>

        <SignalConfig />

        <div id="keywords">
          <KeywordMonitors />
        </div>

        <div id="companies">
          <CompanyMonitors />
        </div>
      </div>

      <div id="competitors" className="rounded-lg border bg-card p-6 transition-colors">
        <CompetitorMonitoring />
      </div>
    </div>
  );
}
