import { Suspense } from 'react';
import { KnowledgeContent } from '@/components/knowledge/KnowledgeContent';

export const metadata = {
  title: 'Knowledge | MagnetLab',
  description: 'Your transcripts and AI knowledge base',
};

export default function KnowledgePage() {
  return (
    <Suspense>
      <KnowledgeContent />
    </Suspense>
  );
}
