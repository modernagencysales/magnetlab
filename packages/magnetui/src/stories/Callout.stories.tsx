import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { Callout } from '../components/callout';

const meta: Meta<typeof Callout> = {
  title: 'Composite/Callout',
  component: Callout,
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'info', 'warning', 'error', 'success'],
    },
  },
};
export default meta;
type Story = StoryObj<typeof Callout>;

export const Default: Story = {
  args: {
    title: 'Note',
    children: 'This is a default callout for general information.',
  },
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-col gap-4 max-w-lg">
      <Callout variant="info" title="Info">
        Your account has been verified successfully.
      </Callout>
      <Callout variant="warning" title="Warning">
        Your trial expires in 3 days. Upgrade now to keep access.
      </Callout>
      <Callout variant="error" title="Error">
        Failed to save changes. Please try again.
      </Callout>
      <Callout variant="success" title="Success">
        Lead magnet published and live on your page.
      </Callout>
      <Callout variant="default" title="Note">
        This is a default callout for general information.
      </Callout>
    </div>
  ),
};
