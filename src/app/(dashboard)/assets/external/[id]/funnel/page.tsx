'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { FunnelBuilder } from '@/components/funnel';
import type { FunnelPage, QualificationQuestion } from '@/lib/types/funnel';
import * as funnelApi from '@/frontend/api/funnel';
import * as externalResourcesApi from '@/frontend/api/external-resources';
import * as userApi from '@/frontend/api/user';
import * as integrationsApi from '@/frontend/api/integrations';

interface ExternalResource {
  id: string;
  title: string;
  url: string;
  icon: string;
}

export default function ExternalResourceFunnelPage() {
  const params = useParams();
  const router = useRouter();
  const resourceId = params.id as string;

  const [resource, setResource] = useState<ExternalResource | null>(null);
  const [funnel, setFunnel] = useState<FunnelPage | null>(null);
  const [questions, setQuestions] = useState<QualificationQuestion[]>([]);
  const [username, setUsername] = useState<string | null>(null);
  const [connectedEmailProviders, setConnectedEmailProviders] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [resourceData, userData, funnelData, emailProvidersData] = await Promise.all([
          externalResourcesApi.getExternalResource(resourceId).catch(() => null),
          userApi.getUsername().catch(() => ({ username: null })),
          funnelApi
            .getFunnelByTarget({ externalResourceId: resourceId })
            .catch(() => ({ funnel: null })),
          integrationsApi.getEmailMarketingConnected().catch(() => ({ providers: [] })),
        ]);

        if (!resourceData) {
          router.push('/pages');
          return;
        }

        setResource(resourceData as ExternalResource);
        setUsername(userData.username);
        setConnectedEmailProviders(emailProvidersData.providers || []);

        if (funnelData.funnel) {
          setFunnel(funnelData.funnel as FunnelPage);

          try {
            const questionsData = await funnelApi.getQuestions(
              (funnelData.funnel as { id: string }).id
            );
            setQuestions((questionsData.questions || []) as QualificationQuestion[]);
          } catch {
            // ignore
          }
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [resourceId, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin text-muted-foreground" size={32} />
      </div>
    );
  }

  if (!resource) {
    return null;
  }

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6">
        <div className="mb-2 text-sm font-medium text-muted-foreground">
          External Resource Funnel
        </div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <span className="text-2xl">{resource.icon}</span>
          {resource.title}
        </h1>
      </div>

      <FunnelBuilder
        externalResource={resource}
        existingFunnel={funnel}
        existingQuestions={questions}
        username={username}
        connectedEmailProviders={connectedEmailProviders}
      />
    </div>
  );
}
