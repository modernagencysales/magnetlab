'use client';

/** Outreach campaign creation form. Preset selection + message templates. */

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Label,
  Input,
  Textarea,
  Button,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@magnetlab/magnetui';
import { logError } from '@/lib/utils/logger';
import * as outreachCampaignsApi from '@/frontend/api/outreach-campaigns';
import type { CreateOutreachCampaignInput } from '@/frontend/api/outreach-campaigns';

// ─── Types ───────────────────────────────────────────────────────────────────

interface OutreachCampaignFormProps {
  onSubmit: (campaignId: string) => void;
}

// ─── Preset options ───────────────────────────────────────────────────────────

const PRESET_OPTIONS = [
  {
    value: 'warm_connect',
    label: 'Warm Connect — View profile → wait 1 day → connect → message on accept',
  },
  {
    value: 'direct_connect',
    label: 'Direct Connect — View profile → connect immediately → message on accept',
  },
  {
    value: 'nurture',
    label: 'Nurture — View profile → wait 3 days → connect → message on accept',
  },
] as const;

// ─── Component ────────────────────────────────────────────────────────────────

export function OutreachCampaignForm({ onSubmit }: OutreachCampaignFormProps) {
  const [name, setName] = useState('');
  const [preset, setPreset] = useState<CreateOutreachCampaignInput['preset']>('warm_connect');
  const [unipileAccountId, setUnipileAccountId] = useState('');
  const [connectMessage, setConnectMessage] = useState('');
  const [firstMessageTemplate, setFirstMessageTemplate] = useState('');
  const [followUpTemplate, setFollowUpTemplate] = useState('');
  const [followUpDelayDays, setFollowUpDelayDays] = useState(3);
  const [withdrawDelayDays, setWithdrawDelayDays] = useState(7);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const input: CreateOutreachCampaignInput = {
        name: name.trim(),
        preset,
        unipile_account_id: unipileAccountId.trim(),
        first_message_template: firstMessageTemplate.trim(),
        connect_message: connectMessage.trim() || undefined,
        follow_up_template: followUpTemplate.trim() || undefined,
        follow_up_delay_days: followUpDelayDays,
        withdraw_delay_days: withdrawDelayDays,
      };
      const result = await outreachCampaignsApi.createCampaign(input);
      onSubmit(result.campaign.id);
    } catch (err) {
      logError('OutreachCampaignForm/submit', err);
      setError(err instanceof Error ? err.message : 'Failed to create campaign');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>Campaign Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="campaign-name">Campaign Name</Label>
            <Input
              id="campaign-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Agency Founders — March 2026"
              required
            />
          </div>

          {/* Preset */}
          <div className="space-y-2">
            <Label htmlFor="preset">Sequence Preset</Label>
            <Select
              value={preset}
              onValueChange={(v) => setPreset(v as CreateOutreachCampaignInput['preset'])}
            >
              <SelectTrigger id="preset">
                <SelectValue placeholder="Select a preset" />
              </SelectTrigger>
              <SelectContent>
                {PRESET_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Unipile Account ID */}
          <div className="space-y-2">
            <Label htmlFor="unipile-account-id">Unipile Account ID</Label>
            <Input
              id="unipile-account-id"
              value={unipileAccountId}
              onChange={(e) => setUnipileAccountId(e.target.value)}
              placeholder="Enter Unipile account ID"
              required
            />
          </div>

          {/* Connect Message */}
          <div className="space-y-2">
            <Label htmlFor="connect-message">Connection Note (optional)</Label>
            <Textarea
              id="connect-message"
              value={connectMessage}
              onChange={(e) => setConnectMessage(e.target.value)}
              placeholder="Optional connection note"
              rows={3}
            />
          </div>

          {/* First Message Template */}
          <div className="space-y-2">
            <Label htmlFor="first-message-template">First Message</Label>
            <Textarea
              id="first-message-template"
              value={firstMessageTemplate}
              onChange={(e) => setFirstMessageTemplate(e.target.value)}
              placeholder="Hey {{name}}, ..."
              rows={4}
              required
            />
            <p className="text-xs text-muted-foreground">
              Use {'{{name}}'} and {'{{company}}'} for personalization
            </p>
          </div>

          {/* Follow-up Template */}
          <div className="space-y-2">
            <Label htmlFor="follow-up-template">Follow-up Message (optional)</Label>
            <Textarea
              id="follow-up-template"
              value={followUpTemplate}
              onChange={(e) => setFollowUpTemplate(e.target.value)}
              placeholder="Hey {{name}}, just following up..."
              rows={3}
            />
          </div>

          {/* Timing */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="follow-up-delay">Follow-up Delay (days)</Label>
              <Input
                id="follow-up-delay"
                type="number"
                min={1}
                value={followUpDelayDays}
                onChange={(e) => setFollowUpDelayDays(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="withdraw-delay">Withdraw Delay (days)</Label>
              <Input
                id="withdraw-delay"
                type="number"
                min={1}
                value={withdrawDelayDays}
                onChange={(e) => setWithdrawDelayDays(Number(e.target.value))}
              />
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {/* Submit */}
          <Button type="submit" disabled={isLoading} className="w-full">
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isLoading ? 'Creating...' : 'Create Campaign'}
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}
