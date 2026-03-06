import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { Toaster, toast } from '../components/toaster';
import { Button } from '../components/button';

const meta: Meta<typeof Toaster> = {
  title: 'Composite/Toaster',
  component: Toaster,
  decorators: [
    (Story) => (
      <>
        <Story />
        <Toaster />
      </>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof Toaster>;

export const Default: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      <Button variant="outline" onClick={() => toast('This is a default toast')}>
        Default
      </Button>
      <Button variant="outline" onClick={() => toast.success('Operation completed successfully')}>
        Success
      </Button>
      <Button variant="outline" onClick={() => toast.error('Something went wrong')}>
        Error
      </Button>
      <Button variant="outline" onClick={() => toast.warning('Please review before continuing')}>
        Warning
      </Button>
      <Button variant="outline" onClick={() => toast.info('New update available')}>
        Info
      </Button>
      <Button
        variant="outline"
        onClick={() =>
          toast('Event has been created', {
            description: 'Monday, January 3rd at 6:00pm',
            action: { label: 'Undo', onClick: () => {} },
          })
        }
      >
        With Action
      </Button>
    </div>
  ),
};
