import { ComponentType } from 'react';
import CreateLandingPage from './create-landing-page';
import ConnectEmailList from './connect-email-list';

export interface GuideMetadata {
  title: string;
  description: string;
}

export const guides: Record<string, { metadata: GuideMetadata; component: ComponentType }> = {};

guides['create-landing-page'] = {
  metadata: {
    title: 'Create Your Landing Page',
    description: 'Create a landing page for your lead magnet in minutes.',
  },
  component: CreateLandingPage,
};

guides['connect-email-list'] = {
  metadata: {
    title: 'Connect to Your Email List',
    description: 'Send leads to your email platform via webhooks.',
  },
  component: ConnectEmailList,
};
