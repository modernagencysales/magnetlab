'use client';

/**
 * New Post Campaign page. Auto-setup flow with fallback to manual form.
 * Step 1: Paste post URL -> auto-setup extracts config
 * Step 2: Review AutoSetupCard or fill manual form
 * Step 3: Activate
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { PageContainer, PageTitle, Button, Input, Label, Card, CardContent } from '@magnetlab/magnetui';
import { logError } from '@/lib/utils/logger';
import { useCopilotContext } from '@/components/copilot/useCopilotContext';
import { CampaignForm } from '@/components/post-campaigns/CampaignForm';
import { AutoSetupCard } from '@/components/post-campaigns/AutoSetupCard';
import * as campaignsApi from '@/frontend/api/post-campaigns';
import type { AutoSetupResult, FunnelOption } from '@/frontend/api/post-campaigns';
import type { CreatePostCampaignInput } from '@/lib/types/post-campaigns';

type Step = 'url' | 'auto-setup' | 'manual';

export default function NewPostCampaignPage() {
  useCopilotContext({ page: 'post-campaigns' });
  const router = useRouter();

  const [step, setStep] = useState<Step>('url');
  const [postUrl, setPostUrl] = useState('');
  const [autoLoading, setAutoLoading] = useState(false);
  const [autoResult, setAutoResult] = useState<AutoSetupResult | null>(null);
  const [funnelOptions, setFunnelOptions] = useState<FunnelOption[]>([]);
  const [error, setError] = useState<string | null>(null);

  // ── Auto-setup ────────────────────────────────────────

  const handleAutoSetup = async () => {
    if (!postUrl.trim()) {
      setError('Post URL is required');
      return;
    }
    setError(null);
    setAutoLoading(true);
    try {
      const [setupRes, funnelsRes] = await Promise.all([
        campaignsApi.autoSetup(postUrl.trim()),
        campaignsApi.listFunnelOptions(),
      ]);
      setAutoResult(setupRes.result);
      setFunnelOptions(funnelsRes.funnels);
      setStep('auto-setup');
    } catch (err) {
      logError('post-campaigns/new/auto-setup', err);
      // Fall back to manual form on error
      setStep('manual');
    } finally {
      setAutoLoading(false);
    }
  };

  // ── Create from auto-setup ────────────────────────────

  const handleActivateFromAutoSetup = async (edited: AutoSetupResult) => {
    try {
      const input: CreatePostCampaignInput = {
        name: `Campaign - ${new Date().toLocaleDateString()}`,
        post_url: postUrl.trim(),
        keywords: edited.keywords,
        unipile_account_id: edited.sender_account_id || '',
        dm_template: edited.dm_template,
        connect_message_template: edited.connect_message_template || undefined,
        funnel_page_id: edited.funnel_page_id || undefined,
        auto_accept_connections: true,
        auto_connect_non_requesters: false,
      };
      const { campaign } = await campaignsApi.createCampaign(input);
      await campaignsApi.activateCampaign(campaign.id);
      router.push(`/post-campaigns/${campaign.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create campaign');
      logError('post-campaigns/new/activate', err);
    }
  };

  // ── Create from manual form ───────────────────────────

  const handleManualSubmit = async (input: CreatePostCampaignInput) => {
    const { campaign } = await campaignsApi.createCampaign(input);
    router.push(`/post-campaigns/${campaign.id}`);
  };

  // ── Render ────────────────────────────────────────────

  return (
    <PageContainer maxWidth="lg">
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link
            href="/post-campaigns"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <PageTitle
            title="New Post Campaign"
            description="Set up automated engagement for a LinkedIn post"
          />
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {/* Step 1: URL input */}
        {step === 'url' && (
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="post-url">LinkedIn Post URL</Label>
                <Input
                  id="post-url"
                  value={postUrl}
                  onChange={(e) => setPostUrl(e.target.value)}
                  placeholder="https://www.linkedin.com/feed/update/..."
                />
              </div>
              <div className="flex items-center gap-3">
                <Button onClick={handleAutoSetup} disabled={autoLoading || !postUrl.trim()}>
                  {autoLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="mr-2 h-4 w-4" />
                  )}
                  Auto-Setup with AI
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setStep('manual')}
                >
                  Set Up Manually
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2a: Auto-setup result */}
        {step === 'auto-setup' && autoResult && (
          <AutoSetupCard
            result={autoResult}
            funnelOptions={funnelOptions}
            onActivate={handleActivateFromAutoSetup}
            onExpandForm={() => setStep('manual')}
          />
        )}

        {/* Step 2b: Manual form */}
        {step === 'manual' && (
          <CampaignForm
            initialValues={{
              post_url: postUrl,
              ...(autoResult
                ? {
                    keywords: autoResult.keywords,
                    unipile_account_id: autoResult.sender_account_id || '',
                    dm_template: autoResult.dm_template,
                    connect_message_template: autoResult.connect_message_template || '',
                    funnel_page_id: autoResult.funnel_page_id || '',
                  }
                : {}),
            }}
            onSubmit={handleManualSubmit}
            submitLabel="Create Campaign"
          />
        )}
      </div>
    </PageContainer>
  );
}
