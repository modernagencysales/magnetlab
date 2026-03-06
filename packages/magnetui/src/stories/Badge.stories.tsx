import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { Badge } from '../components/badge';

const meta: Meta<typeof Badge> = {
  title: 'Base/Badge',
  component: Badge,
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'orange', 'blue', 'green', 'red', 'purple', 'gray', 'count', 'outline'],
    },
  },
};
export default meta;
type Story = StoryObj<typeof Badge>;

export const Default: Story = {
  args: { children: 'Badge' },
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="default">Default</Badge>
      <Badge variant="orange">Orange</Badge>
      <Badge variant="blue">Blue</Badge>
      <Badge variant="green">Green</Badge>
      <Badge variant="red">Red</Badge>
      <Badge variant="purple">Purple</Badge>
      <Badge variant="gray">Gray</Badge>
      <Badge variant="count">12</Badge>
      <Badge variant="outline">Outline</Badge>
    </div>
  ),
};

export const StatusTags: Story = {
  name: 'As Status Tags',
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge variant="green">Published</Badge>
      <Badge variant="orange">Draft</Badge>
      <Badge variant="blue">Scheduled</Badge>
      <Badge variant="red">Rejected</Badge>
      <Badge variant="purple">Review</Badge>
      <Badge variant="gray">Archived</Badge>
    </div>
  ),
};
