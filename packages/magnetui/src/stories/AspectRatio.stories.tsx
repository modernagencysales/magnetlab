import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { AspectRatio } from '../components/aspect-ratio';

const meta: Meta<typeof AspectRatio> = {
  title: 'Base/AspectRatio',
  component: AspectRatio,
};
export default meta;
type Story = StoryObj<typeof AspectRatio>;

export const Ratio16x9: Story = {
  name: '16:9',
  render: () => (
    <div className="w-[450px]">
      <AspectRatio ratio={16 / 9}>
        <div className="flex h-full w-full items-center justify-center rounded-lg bg-muted text-sm text-muted-foreground">
          16:9
        </div>
      </AspectRatio>
    </div>
  ),
};

export const Ratio4x3: Story = {
  name: '4:3',
  render: () => (
    <div className="w-[450px]">
      <AspectRatio ratio={4 / 3}>
        <div className="flex h-full w-full items-center justify-center rounded-lg bg-muted text-sm text-muted-foreground">
          4:3
        </div>
      </AspectRatio>
    </div>
  ),
};

export const Square: Story = {
  render: () => (
    <div className="w-[300px]">
      <AspectRatio ratio={1}>
        <div className="flex h-full w-full items-center justify-center rounded-lg bg-muted text-sm text-muted-foreground">
          1:1
        </div>
      </AspectRatio>
    </div>
  ),
};
