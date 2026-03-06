import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { EmptyState } from '../components/empty-state';
import { Button } from '../components/button';
import { FileText, Inbox, Search, Plus } from 'lucide-react';

const meta: Meta<typeof EmptyState> = {
  title: 'Primitives/EmptyState',
  component: EmptyState,
};
export default meta;
type Story = StoryObj<typeof EmptyState>;

export const Default: Story = {
  args: {
    icon: <FileText />,
    title: 'No documents',
    description: 'Get started by creating your first document.',
    action: <Button size="sm"><Plus className="h-4 w-4" /> Create Document</Button>,
  },
};

export const NoResults: Story = {
  args: {
    icon: <Search />,
    title: 'No results found',
    description: 'Try adjusting your search or filter to find what you\'re looking for.',
  },
};

export const EmptyInbox: Story = {
  args: {
    icon: <Inbox />,
    title: 'All caught up!',
    description: 'You have no new notifications.',
  },
};

export const WithCustomAction: Story = {
  args: {
    icon: <FileText />,
    title: 'No lead magnets yet',
    description: 'Create your first lead magnet to start capturing leads.',
    action: (
      <div className="flex gap-2">
        <Button variant="outline" size="sm">Learn More</Button>
        <Button size="sm"><Plus className="h-4 w-4" /> Create</Button>
      </div>
    ),
  },
};
