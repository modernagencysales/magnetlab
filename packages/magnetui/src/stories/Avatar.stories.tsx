import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { Avatar, AvatarImage, AvatarFallback } from '../components/avatar';
import { AvatarGroup } from '../components/avatar-group';

const meta: Meta<typeof Avatar> = {
  title: 'Base/Avatar',
  component: Avatar,
  argTypes: {
    size: { control: 'select', options: ['xs', 'sm', 'md', 'lg', 'xl'] },
  },
};
export default meta;
type Story = StoryObj<typeof Avatar>;

export const Default: Story = {
  render: () => (
    <Avatar>
      <AvatarFallback name="John Doe">JD</AvatarFallback>
    </Avatar>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <Avatar size="xs"><AvatarFallback name="User A">A</AvatarFallback></Avatar>
      <Avatar size="sm"><AvatarFallback name="User B">B</AvatarFallback></Avatar>
      <Avatar size="md"><AvatarFallback name="User C">C</AvatarFallback></Avatar>
      <Avatar size="lg"><AvatarFallback name="User D">D</AvatarFallback></Avatar>
      <Avatar size="xl"><AvatarFallback name="User E">E</AvatarFallback></Avatar>
    </div>
  ),
};

export const DeterministicColors: Story = {
  name: 'Deterministic Colors',
  render: () => (
    <div className="flex items-center gap-3">
      {['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace'].map((name) => (
        <Avatar key={name} size="lg">
          <AvatarFallback name={name}>{name[0]}</AvatarFallback>
        </Avatar>
      ))}
    </div>
  ),
};

export const Group: StoryObj<typeof AvatarGroup> = {
  render: () => (
    <AvatarGroup max={3}>
      <Avatar><AvatarFallback name="Alice">A</AvatarFallback></Avatar>
      <Avatar><AvatarFallback name="Bob">B</AvatarFallback></Avatar>
      <Avatar><AvatarFallback name="Charlie">C</AvatarFallback></Avatar>
      <Avatar><AvatarFallback name="Diana">D</AvatarFallback></Avatar>
      <Avatar><AvatarFallback name="Eve">E</AvatarFallback></Avatar>
    </AvatarGroup>
  ),
};
