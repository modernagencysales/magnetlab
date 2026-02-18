import { ComponentType } from 'react';

export interface GuideMetadata {
  title: string;
  description: string;
}

export const guides: Record<string, { metadata: GuideMetadata; component: ComponentType }> = {};
