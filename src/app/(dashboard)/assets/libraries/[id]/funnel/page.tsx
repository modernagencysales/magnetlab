'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { FunnelBuilder } from '@/components/funnel';
import type { FunnelPage, QualificationQuestion } from '@/lib/types/funnel';
import type { Library } from '@/lib/types/library';
import * as funnelApi from '@/frontend/api/funnel';

export default function LibraryFunnelPage() {
  const params = useParams();
  const router = useRouter();
  const libraryId = params.id as string;

  const [library, setLibrary] = useState<Library | null>(null);
  const [funnel, setFunnel] = useState<FunnelPage | null>(null);
  const [questions, setQuestions] = useState<QualificationQuestion[]>([]);
  const [username, setUsername] = useState<string | null>(null);
  const [connectedEmailProviders, setConnectedEmailProviders] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch library, user, existing funnel, and connected email providers
        const [libraryRes, userRes, funnelsData, emailProvidersRes] = await Promise.all([
          fetch(`/api/libraries/${libraryId}`),
          fetch('/api/user/username'),
          funnelApi.getAllFunnels().catch(() => ({ funnels: [] })),
          fetch('/api/integrations/email-marketing/connected'),
        ]);

        if (!libraryRes.ok) {
          router.push('/pages');
          return;
        }

        const libraryData = await libraryRes.json();
        setLibrary(libraryData.library);

        if (userRes.ok) {
          const userData = await userRes.json();
          setUsername(userData.username);
        }

        // Find existing funnel targeting this library
        const funnelsList = funnelsData.funnels || [];
        const existingFunnel = (funnelsList as { library_id: string | null; target_type: string }[]).find(
          (f) => f.library_id === libraryId && f.target_type === 'library'
        );

        if (existingFunnel) {
          try {
            const funnelData = await funnelApi.getFunnel(existingFunnel.id);
            setFunnel(funnelData.funnel as FunnelPage);

            if (funnelData.funnel && typeof funnelData.funnel === 'object' && 'id' in funnelData.funnel) {
              const questionsData = await funnelApi.getQuestions((funnelData.funnel as { id: string }).id);
              setQuestions((questionsData.questions || []) as QualificationQuestion[]);
            }
          } catch {
            // ignore
          }
        }

        if (emailProvidersRes.ok) {
          const emailData = await emailProvidersRes.json();
          setConnectedEmailProviders(emailData.providers || []);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [libraryId, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin text-muted-foreground" size={32} />
      </div>
    );
  }

  if (!library) {
    return null;
  }

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6">
        <div className="mb-2 text-sm font-medium text-muted-foreground">
          Library Funnel
        </div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <span className="text-2xl">{library.icon}</span>
          {library.name}
        </h1>
      </div>

      <FunnelBuilder
        library={library}
        existingFunnel={funnel}
        existingQuestions={questions}
        username={username}
        connectedEmailProviders={connectedEmailProviders}
      />
    </div>
  );
}
