'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { FunnelBuilder } from '@/components/funnel';
import type { FunnelPage, QualificationQuestion } from '@/lib/types/funnel';
import type { Library } from '@/lib/types/library';

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
        const [libraryRes, userRes, funnelsRes, emailProvidersRes] = await Promise.all([
          fetch(`/api/libraries/${libraryId}`),
          fetch('/api/user/username'),
          fetch('/api/funnel/all'),
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
        if (funnelsRes.ok) {
          const funnelsData = await funnelsRes.json();
          const existingFunnel = (funnelsData.funnels || []).find(
            (f: { library_id: string | null; target_type: string }) =>
              f.library_id === libraryId && f.target_type === 'library'
          );

          if (existingFunnel) {
            // Fetch full funnel data with the funnel API
            const funnelRes = await fetch(`/api/funnel/${existingFunnel.id}`);
            if (funnelRes.ok) {
              const funnelData = await funnelRes.json();
              setFunnel(funnelData.funnel);

              // Fetch questions if funnel exists
              if (funnelData.funnel?.id) {
                const questionsRes = await fetch(`/api/funnel/${funnelData.funnel.id}/questions`);
                if (questionsRes.ok) {
                  const questionsData = await questionsRes.json();
                  setQuestions(questionsData.questions || []);
                }
              }
            }
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
