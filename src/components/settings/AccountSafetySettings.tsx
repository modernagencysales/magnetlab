'use client';

/**
 * AccountSafetySettings. Per-account safety configuration UI.
 * Renders operating hours, daily limits, action delays, and warm-up status
 * for each connected LinkedIn account.
 */

import { useState, useEffect } from 'react';
import { Loader2, Shield, Clock, Gauge, Timer, Activity } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Badge,
  Separator,
  toast,
} from '@magnetlab/magnetui';
import { logError } from '@/lib/utils/logger';
import {
  getAccountSafetySettings,
  updateAccountSafetySettings,
  type AccountSafetySettings as AccountSettings,
  type UpdateAccountSafetyInput,
} from '@/frontend/api/account-safety';
import { OperatingHoursSection } from './safety/OperatingHoursSection';
import { DailyLimitsSection } from './safety/DailyLimitsSection';
import { ActionDelaysSection } from './safety/ActionDelaysSection';
import { WarmUpStatus } from './safety/WarmUpStatus';

// ─── Component ─────────────────────────────────────────────────────────────

export function AccountSafetySettings() {
  const [accounts, setAccounts] = useState<AccountSettings[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, UpdateAccountSafetyInput>>({});

  useEffect(() => {
    loadAccounts();
  }, []);

  async function loadAccounts() {
    try {
      const { accounts: data } = await getAccountSafetySettings();
      setAccounts(data);
      const initial: Record<string, UpdateAccountSafetyInput> = {};
      for (const acct of data) {
        initial[acct.account_id] = {
          operating_hours: { ...acct.operating_hours },
          daily_limits: { ...acct.daily_limits },
          action_delays: { ...acct.action_delays },
        };
      }
      setDrafts(initial);
    } catch (error) {
      logError('settings/account-safety', error, { step: 'load' });
      toast.error('Failed to load account safety settings');
    } finally {
      setLoading(false);
    }
  }

  function updateDraft(accountId: string, partial: Partial<UpdateAccountSafetyInput>) {
    setDrafts((prev) => ({
      ...prev,
      [accountId]: { ...prev[accountId], ...partial },
    }));
  }

  async function handleSave(accountId: string) {
    const draft = drafts[accountId];
    if (!draft) return;

    setSavingId(accountId);
    try {
      await updateAccountSafetySettings(accountId, draft);
      toast.success('Safety settings saved');
    } catch (error) {
      logError('settings/account-safety', error, { step: 'save', accountId });
      toast.error('Failed to save safety settings');
    } finally {
      setSavingId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <Card className="border-border">
        <CardContent className="py-12 text-center">
          <Shield className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">
            No LinkedIn accounts connected. Connect an account in{' '}
            <a href="/settings/integrations" className="text-primary hover:underline">
              Integrations
            </a>{' '}
            to configure safety settings.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {accounts.map((account) => {
        const draft = drafts[account.account_id];
        if (!draft) return null;

        return (
          <Card key={account.account_id} className="border-border">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Shield className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base">{account.account_name}</CardTitle>
                </div>
                <Button
                  size="sm"
                  onClick={() => handleSave(account.account_id)}
                  disabled={savingId === account.account_id}
                >
                  {savingId === account.account_id ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                      Saving...
                    </>
                  ) : (
                    'Save'
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Operating Hours */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold">Operating Hours</h3>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  Actions will only be performed during these hours.
                </p>
                <OperatingHoursSection
                  value={draft.operating_hours!}
                  onChange={(hours) => updateDraft(account.account_id, { operating_hours: hours })}
                />
              </div>

              <Separator />

              {/* Daily Limits */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Gauge className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold">Daily Limits</h3>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  Maximum number of actions per day. Lower limits reduce detection risk.
                </p>
                <DailyLimitsSection
                  value={draft.daily_limits!}
                  onChange={(limits) => updateDraft(account.account_id, { daily_limits: limits })}
                />
              </div>

              <Separator />

              {/* Action Delays */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Timer className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold">Action Delays</h3>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  Random delay between consecutive actions. Longer delays appear more human.
                </p>
                <ActionDelaysSection
                  value={draft.action_delays!}
                  onChange={(delays) => updateDraft(account.account_id, { action_delays: delays })}
                />
              </div>

              <Separator />

              {/* Status (read-only) */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold">Status</h3>
                </div>
                <WarmUpStatus
                  connectedAt={account.account_connected_at}
                  circuitBreaker={account.circuit_breaker}
                />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
