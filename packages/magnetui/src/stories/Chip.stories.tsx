import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { Chip } from '../components/chip';

const meta: Meta<typeof Chip> = {
  title: 'Composite/Chip',
  component: Chip,
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'blue', 'green', 'orange', 'red', 'purple', 'outline'],
    },
    size: {
      control: 'select',
      options: ['sm', 'default', 'lg'],
    },
  },
};
export default meta;
type Story = StoryObj<typeof Chip>;

export const Default: Story = {
  args: { children: 'Chip' },
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      <Chip variant="default">Default</Chip>
      <Chip variant="blue">Blue</Chip>
      <Chip variant="green">Green</Chip>
      <Chip variant="orange">Orange</Chip>
      <Chip variant="red">Red</Chip>
      <Chip variant="purple">Purple</Chip>
      <Chip variant="outline">Outline</Chip>
    </div>
  ),
};

export const Removable: Story = {
  render: () => {
    const [chips, setChips] = React.useState(['LinkedIn', 'Marketing', 'SaaS', 'AI']);
    return (
      <div className="flex flex-wrap items-center gap-2">
        {chips.map((chip) => (
          <Chip
            key={chip}
            variant="blue"
            onRemove={() => setChips((prev) => prev.filter((c) => c !== chip))}
          >
            {chip}
          </Chip>
        ))}
        {chips.length === 0 && (
          <span className="text-sm text-muted-foreground">All chips removed</span>
        )}
      </div>
    );
  },
};

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      <Chip size="sm">Small</Chip>
      <Chip size="default">Default</Chip>
      <Chip size="lg">Large</Chip>
    </div>
  ),
};
