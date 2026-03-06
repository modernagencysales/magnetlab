import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { CopyButton } from '../components/copy-button';

const meta: Meta<typeof CopyButton> = {
  title: 'Composite/CopyButton',
  component: CopyButton,
};
export default meta;
type Story = StoryObj<typeof CopyButton>;

export const Default: Story = {
  args: {
    value: 'https://magnetlab.app/p/jane/lead-magnet',
  },
};

export const WithLabel: Story = {
  args: {
    value: 'https://magnetlab.app/p/jane/lead-magnet',
    label: 'Copy Link',
    copiedLabel: 'Copied!',
    size: 'sm',
    variant: 'outline',
  },
};
