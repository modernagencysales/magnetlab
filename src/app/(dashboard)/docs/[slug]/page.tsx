import { notFound } from 'next/navigation';
import { guides } from '@/components/docs/guides';
import type { Metadata } from 'next';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const guide = guides[slug];

  if (!guide) {
    return { title: 'Not Found | MagnetLab' };
  }

  return {
    title: `${guide.metadata.title} | MagnetLab Docs`,
    description: guide.metadata.description,
  };
}

export default async function GuideSlugPage({ params }: Props) {
  const { slug } = await params;
  const guide = guides[slug];

  if (!guide) {
    notFound();
  }

  const GuideComponent = guide.component;

  return <GuideComponent />;
}
