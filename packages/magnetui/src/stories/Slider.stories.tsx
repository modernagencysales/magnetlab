import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { Slider } from '../components/slider';

const meta: Meta<typeof Slider> = {
  title: 'Base/Slider',
  component: Slider,
};
export default meta;
type Story = StoryObj<typeof Slider>;

export const Default: Story = {
  args: {
    defaultValue: [50],
    max: 100,
    step: 1,
    className: 'w-60',
  },
};

export const Range: Story = {
  args: {
    defaultValue: [25, 75],
    max: 100,
    step: 1,
    className: 'w-60',
  },
};

export const Disabled: Story = {
  args: {
    defaultValue: [40],
    max: 100,
    step: 1,
    disabled: true,
    className: 'w-60',
  },
};
