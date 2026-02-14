'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2, CheckCircle, XCircle, Video } from 'lucide-react';

import { logError } from '@/lib/utils/logger';

interface FathomSettingsProps {
  isConnected: boolean;
  lastSyncedAt: string | null;
}

export function FathomSettings({ isConnected, lastSyncedAt }: FathomSettingsProps) {
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const searchParams = useSearchParams();

  // Check URL params for OAuth callback feedback
  useEffect(() => {
    const fathomParam = searchParams.get('fathom');
    if (fathomParam === 'connected') {
      setFeedback({ type: 'success', message: 'Fathom connected successfully! Transcripts will sync every 30 minutes.' });
    } else if (fathomParam === 'error') {
      const reason = searchParams.get('reason') || 'Unknown error';
      setFeedback({ type: 'error', message: `Failed to connect Fathom: ${reason}` });
    }
  }, [searchParams]);

  const handleConnect = () => {
    window.location.href = '/api/integrations/fathom/authorize';
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect Fathom? Transcript syncing will stop.')) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/integrations/fathom/disconnect', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to disconnect');
      }

      window.location.reload();
    } catch (error) {
      logError('settings/fathom', error, { step: 'disconnect_error' });
      setFeedback({ type: 'error', message: 'Failed to disconnect Fathom' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-4 rounded-lg border p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10">
            <Video className="h-5 w-5 text-violet-500" />
          </div>
          <div>
            <p className="font-medium">Fathom</p>
            <p className="text-xs text-muted-foreground">
              Auto-sync meeting transcripts to your content pipeline
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
            Your Fathom account is connected. Transcripts sync automatically every 30 minutes.
          </p>

          {lastSyncedAt && (
            <p className="text-xs text-muted-foreground">
              Last synced: {new Date(lastSyncedAt).toLocaleString()}
            </p>
          )}

          <button
            onClick={handleDisconnect}
            disabled={loading}
            className="text-sm text-red-500 hover:text-red-600 transition-colors font-medium"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                Disconnecting...
              </span>
            ) : (
              'Disconnect'
            )}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Connect your Fathom account to automatically import meeting transcripts into your content pipeline. No Zapier needed.
          </p>

          <button
            onClick={handleConnect}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Connect Fathom
          </button>
        </div>
      )}

      {feedback && (
        <p className={`mt-3 flex items-center gap-2 text-sm ${
          feedback.type === 'success' ? 'text-green-600' : 'text-red-500'
        }`}>
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
