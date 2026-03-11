'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2, CheckCircle, XCircle, Linkedin } from 'lucide-react';
import { Button } from '@magnetlab/magnetui';

import { logError } from '@/lib/utils/logger';
import * as linkedInApi from '@/frontend/api/linkedin';

interface LinkedInSettingsProps {
  isConnected: boolean;
  accountName: string | null;
}

export function LinkedInSettings({ isConnected, accountName }: LinkedInSettingsProps) {
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );
  const searchParams = useSearchParams();

  useEffect(() => {
    const linkedinParam = searchParams.get('linkedin');
    if (linkedinParam === 'connected') {
      setFeedback({
        type: 'success',
        message: 'LinkedIn connected successfully! You can now publish posts directly.',
      });
    } else if (linkedinParam === 'error') {
      const reason = searchParams.get('reason') || 'Unknown error';
      setFeedback({ type: 'error', message: `Failed to connect LinkedIn: ${reason}` });
    }
  }, [searchParams]);

  const handleConnect = () => {
    window.location.href = '/api/linkedin/connect';
  };

  const handleDisconnect = async () => {
    if (
      !confirm('Are you sure you want to disconnect LinkedIn? Post publishing will stop working.')
    ) {
      return;
    }

    setLoading(true);
    try {
      await linkedInApi.disconnectLinkedIn();
      window.location.reload();
    } catch (error) {
      logError('settings/linkedin', error, { step: 'disconnect_error' });
      setFeedback({ type: 'error', message: 'Failed to disconnect LinkedIn' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-4 rounded-lg border border-border p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
            <Linkedin className="h-5 w-5 text-blue-500" />
          </div>
          <div>
            <p className="font-medium">LinkedIn (Unipile)</p>
            <p className="text-xs text-muted-foreground">
              Connect your LinkedIn account to publish posts directly
            </p>
          </div>
        </div>
        {isConnected && (
          <span className="flex items-center gap-1 text-xs text-green-600">
            <CheckCircle className="h-3 w-3" />
            Connected
          </span>
        )}
      </div>

      {isConnected ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Your LinkedIn account is connected{accountName ? ` as ${accountName}` : ''}. Posts will
            be published directly to LinkedIn.
          </p>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleDisconnect}
            disabled={loading}
            className="text-destructive hover:opacity-80"
          >
            {loading ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                Disconnecting...
              </>
            ) : (
              'Disconnect'
            )}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Connect your LinkedIn account to publish posts from the content pipeline directly to
            LinkedIn.
          </p>

          <Button onClick={handleConnect}>Connect LinkedIn</Button>
        </div>
      )}

      {feedback && (
        <p
          className={`mt-3 flex items-center gap-2 text-sm ${
            feedback.type === 'success' ? 'text-green-600' : 'text-destructive'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle className="h-4 w-4" />
          ) : (
            <XCircle className="h-4 w-4" />
          )}
          {feedback.message}
        </p>
      )}
    </div>
  );
}
