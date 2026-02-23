import type { Metadata } from 'next';
import { ContentOpsGuide } from '@/components/help/ContentOpsGuide';

export const metadata: Metadata = {
  title: 'Content Operations Guide | MagnetLab',
  description:
    'Daily and weekly routines for AI-powered content production, troubleshooting, and style feedback tips.',
};

export default function HelpPage() {
  return <ContentOpsGuide />;
}
