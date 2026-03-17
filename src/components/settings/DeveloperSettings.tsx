'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Key, Copy, Trash2, Plus, Loader2, Check, CheckCircle, XCircle } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Badge,
} from '@magnetlab/magnetui';
import { WebhookSettings } from '@/components/settings/WebhookSettings';
import { logError } from '@/lib/utils/logger';
import * as keysApi from '@/frontend/api/keys';

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  isActive: boolean;
  lastUsedAt: string | null;
  createdAt: string;
}

export function DeveloperSettings() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [apiKeysLoading, setApiKeysLoading] = useState(true);
  const [newKeyName, setNewKeyName] = useState('');
  const [creatingKey, setCreatingKey] = useState(false);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);
  const [keyCopied, setKeyCopied] = useState(false);
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  useEffect(() => {
    const fetchApiKeys = async () => {
      try {
        const data = await keysApi.listKeys();
        setApiKeys((data.keys || []) as ApiKey[]);
      } catch (error) {
        logError('settings/developer', error, { step: 'failed_to_fetch_api_keys' });
      } finally {
        setApiKeysLoading(false);
      }
    };
    fetchApiKeys();
  }, []);

  const handleCreateApiKey = async () => {
    if (!newKeyName.trim()) return;
    setCreatingKey(true);
    setApiKeyError(null);
    setNewlyCreatedKey(null);

    try {
      const data = (await keysApi.createKey(newKeyName.trim())) as {
        id: string;
        key: string;
        name: string;
        prefix: string;
        createdAt: string;
      };
      setNewlyCreatedKey(data.key);
      setNewKeyName('');
      setApiKeys((prev) => [
        {
          id: data.id,
          name: data.name,
          prefix: data.prefix,
          isActive: true,
          lastUsedAt: null,
          createdAt: data.createdAt,
        },
        ...prev,
      ]);
    } catch (error) {
      setApiKeyError(error instanceof Error ? error.message : 'Failed to create API key');
    } finally {
      setCreatingKey(false);
    }
  };

  const handleRevokeApiKey = async (keyId: string, keyName: string) => {
    if (!confirm(`Revoke API key "${keyName}"? This cannot be undone.`)) return;
    setLoading(`revoke-${keyId}`);
    try {
      await keysApi.deleteKey(keyId);
      setApiKeys((prev) => prev.map((k) => (k.id === keyId ? { ...k, isActive: false } : k)));
    } catch (error) {
      logError('settings/developer', error, { step: 'revoke_error' });
    } finally {
      setLoading(null);
    }
  };

  const handleCopyKey = async (key: string) => {
    await navigator.clipboard.writeText(key);
    setKeyCopied(true);
    setTimeout(() => setKeyCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Key className="h-5 w-5 text-primary" />
            <CardTitle>API Keys</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">
            API keys allow programmatic access to your account. Keep them secret and revoke any
            compromised keys immediately.
          </p>

          <div className="mb-6 rounded-lg border border-border p-4">
            <p className="mb-3 text-sm font-medium">Create New API Key</p>
            <div className="flex gap-2">
              <Input
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder="Key name (e.g., Production, Development)"
                maxLength={100}
                className="flex-1"
              />
              <Button onClick={handleCreateApiKey} disabled={creatingKey || !newKeyName.trim()}>
                {creatingKey ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-1" />
                    Create
                  </>
                )}
              </Button>
            </div>

            {apiKeyError && (
              <p className="mt-2 flex items-center gap-2 text-sm text-destructive">
                <XCircle className="h-4 w-4 mr-1" />
                {apiKeyError}
              </p>
            )}

            {newlyCreatedKey && (
              <div className="mt-4 rounded-lg border border-green-500/30 bg-green-500/10 p-4">
                <p className="mb-2 flex items-center gap-2 text-sm font-medium text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  API key created successfully
                </p>
                <p className="mb-3 text-xs text-muted-foreground">
                  Copy this key now. You won&apos;t be able to see it again.
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded bg-background px-3 py-2 text-xs font-mono break-all">
                    {newlyCreatedKey}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopyKey(newlyCreatedKey)}
                  >
                    {keyCopied ? (
                      <>
                        <Check className="h-4 w-4 text-green-500 mr-1" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 mr-1" />
                        Copy
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div>
            <p className="mb-3 text-sm font-medium">Your API Keys</p>
            {apiKeysLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : apiKeys.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No API keys yet. Create one above to get started.
              </p>
            ) : (
              <div className="space-y-2">
                {apiKeys.map((key) => (
                  <div
                    key={key.id}
                    className={`flex items-center justify-between rounded-lg border border-border p-3 ${
                      !key.isActive ? 'opacity-60' : ''
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm truncate">{key.name}</p>
                        {!key.isActive && <Badge variant="red">Revoked</Badge>}
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <code className="text-xs text-muted-foreground font-mono">
                          ml_live_...{key.prefix}
                        </code>
                        <span className="text-xs text-muted-foreground">
                          Created {new Date(key.createdAt).toLocaleDateString()}
                        </span>
                        {key.lastUsedAt && (
                          <span className="text-xs text-muted-foreground">
                            Last used {new Date(key.lastUsedAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                    {key.isActive && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRevokeApiKey(key.id, key.name)}
                        disabled={loading === `revoke-${key.id}`}
                        className="ml-4 text-destructive hover:bg-destructive/10"
                      >
                        {loading === `revoke-${key.id}` ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Trash2 className="h-4 w-4 mr-1" />
                            Revoke
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card id="webhooks">
        <CardContent className="pt-6">
          <WebhookSettings />
        </CardContent>
      </Card>

      <Card id="docs">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Key className="h-5 w-5 text-primary" />
            <CardTitle>API &amp; Content Pipeline Docs</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Documentation for the Content Pipeline API, webhooks, and integrations.
          </p>
          <Link
            href="/docs"
            className="mt-4 inline-block text-sm font-medium text-primary hover:text-primary/80 transition-colors"
          >
            View Full Documentation &rarr;
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
