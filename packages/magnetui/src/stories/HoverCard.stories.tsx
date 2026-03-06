import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { HoverCard, HoverCardTrigger, HoverCardContent } from '../components/hover-card';
import { Avatar, AvatarFallback, AvatarImage } from '../components/avatar';
import { Button } from '../components/button';

const meta: Meta<typeof HoverCard> = {
  title: 'Base/HoverCard',
  component: HoverCard,
};
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <HoverCard>
      <HoverCardTrigger asChild>
        <Button variant="link" className="px-0">@janedoe</Button>
      </HoverCardTrigger>
      <HoverCardContent>
        <div className="flex gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src="https://api.dicebear.com/7.x/initials/svg?seed=JD" />
            <AvatarFallback>JD</AvatarFallback>
          </Avatar>
          <div className="space-y-1">
            <h4 className="text-sm font-semibold">Jane Doe</h4>
            <p className="text-sm text-muted-foreground">
              Product designer and content creator.
            </p>
            <p className="text-xs text-muted-foreground">Joined December 2023</p>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  ),
};
