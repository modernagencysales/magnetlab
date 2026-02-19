'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { FunnelBuilder } from '@/components/funnel';
import type { FunnelPage, QualificationQuestion } from '@/lib/types/funnel';

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [resourceRes, userRes, funnelRes] = await Promise.all([
          fetch(`/api/external-resources/${resourceId}`),
          fetch('/api/user/username'),
          fetch(`/api/funnel?externalResourceId=${resourceId}`),
        ]);

        if (!resourceRes.ok) {
          router.push('/pages');
          return;
        }

        const resourceData = await resourceRes.json();
        setResource(resourceData.resource);

        if (userRes.ok) {
          const userData = await userRes.json();
          setUsername(userData.username);
        }

        if (funnelRes.ok) {
          const funnelData = await funnelRes.json();
          if (funnelData.funnel) {
            setFunnel(funnelData.funnel);

            // Fetch questions if funnel exists
            const questionsRes = await fetch(`/api/funnel/${funnelData.funnel.id}/questions`);
            if (questionsRes.ok) {
              const questionsData = await questionsRes.json();
              setQuestions(questionsData.questions || []);
            }
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
      />
    </div>
  );
}
