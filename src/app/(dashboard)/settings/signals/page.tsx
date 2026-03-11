import { Card, CardContent, CardHeader, CardTitle } from '@magnetlab/magnetui';
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
      <Card className="border-border">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Settings2 className="h-5 w-5 text-primary" />
            <CardTitle>Signal Engine</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">
            Configure ICP targeting, keyword monitoring, and company page tracking for your signal
            engine.
          </p>

          <SignalConfig />

          <div id="keywords">
            <KeywordMonitors />
          </div>

          <div id="companies">
            <CompanyMonitors />
          </div>
        </CardContent>
      </Card>

      <Card id="competitors" className="border-border">
        <CardContent className="pt-6">
          <CompetitorMonitoring />
        </CardContent>
      </Card>
    </div>
  );
}
