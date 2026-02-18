import { ComponentType } from 'react';
import CreateLandingPage from './create-landing-page';
import ConnectEmailList from './connect-email-list';
import Zapier from './zapier';
import MakeGuide from './make';
import N8n from './n8n';
import DirectApi from './direct-api';
import WebhookReferenceAI from './webhook-reference-ai';
import CustomizeFunnel from './customize-funnel';
import EmailSequences from './email-sequences';
import Tracking from './tracking';
import Troubleshooting from './troubleshooting';

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

guides['zapier'] = {
  metadata: {
    title: 'Connect with Zapier',
    description: 'Connect MagnetLab to your email platform using Zapier.',
  },
  component: Zapier,
};

guides['make'] = {
  metadata: {
    title: 'Connect with Make',
    description: 'Connect MagnetLab to your email platform using Make.',
  },
  component: MakeGuide,
};

guides['n8n'] = {
  metadata: {
    title: 'Connect with n8n',
    description: 'Connect MagnetLab to your email platform using n8n.',
  },
  component: N8n,
};

guides['direct-api'] = {
  metadata: {
    title: 'Direct API / Webhook',
    description: 'Receive lead data via HTTP webhook.',
  },
  component: DirectApi,
};

guides['webhook-reference-ai'] = {
  metadata: {
    title: 'AI-Friendly Webhook Reference',
    description: 'Copy-paste reference for AI assistants to help with webhook setup.',
  },
  component: WebhookReferenceAI,
};

guides['customize-funnel'] = {
  metadata: {
    title: 'Customize Your Funnel',
    description: 'Fine-tune your landing page appearance, copy, and qualification.',
  },
  component: CustomizeFunnel,
};

guides['email-sequences'] = {
  metadata: {
    title: 'Email Sequences',
    description: 'Set up automated email drip sequences for new leads.',
  },
  component: EmailSequences,
};

guides['tracking'] = {
  metadata: {
    title: 'Tracking & Attribution',
    description: 'Track conversions with Meta Pixel, LinkedIn, and UTM parameters.',
  },
  component: Tracking,
};

guides['troubleshooting'] = {
  metadata: {
    title: 'Troubleshooting',
    description: 'Common issues and how to fix them.',
  },
  component: Troubleshooting,
};
