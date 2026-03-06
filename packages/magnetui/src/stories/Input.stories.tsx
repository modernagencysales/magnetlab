import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { Input } from '../components/input';
import { Textarea } from '../components/textarea';
import { Label } from '../components/label';

const meta: Meta<typeof Input> = {
  title: 'Base/Input',
  component: Input,
};
export default meta;
type Story = StoryObj<typeof Input>;

export const Default: Story = {
  args: { placeholder: 'Type something...' },
};

export const WithLabel: Story = {
  render: () => (
    <div className="space-y-1.5 w-[300px]">
      <Label htmlFor="email">Email</Label>
      <Input id="email" type="email" placeholder="name@example.com" />
    </div>
  ),
};

export const Disabled: Story = {
  args: { placeholder: 'Disabled input', disabled: true },
};

export const TextareaStory: StoryObj<typeof Textarea> = {
  name: 'Textarea',
  render: () => (
    <div className="space-y-1.5 w-[300px]">
      <Label htmlFor="desc">Description</Label>
      <Textarea id="desc" placeholder="Enter your description..." />
    </div>
  ),
};

export const InputTypes: Story = {
  render: () => (
    <div className="space-y-3 w-[300px]">
      <Input type="text" placeholder="Text input" />
      <Input type="email" placeholder="Email input" />
      <Input type="password" placeholder="Password input" />
      <Input type="number" placeholder="Number input" />
      <Input type="search" placeholder="Search input" />
    </div>
  ),
};
