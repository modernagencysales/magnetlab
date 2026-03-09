import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { Checkbox } from '../components/checkbox';
import { Switch } from '../components/switch';
import { RadioGroup, RadioGroupItem } from '../components/radio-group';
import { Label } from '../components/label';
import { Progress } from '../components/progress';
import { Separator } from '../components/separator';

const meta: Meta = {
  title: 'Base/Form Controls',
};
export default meta;

export const CheckboxStory: StoryObj = {
  name: 'Checkbox',
  render: () => (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Checkbox id="terms" />
        <Label htmlFor="terms">Accept terms and conditions</Label>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="marketing" defaultChecked />
        <Label htmlFor="marketing">Receive marketing emails</Label>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="disabled" disabled />
        <Label htmlFor="disabled" className="opacity-50">Disabled</Label>
      </div>
    </div>
  ),
};

export const SwitchStory: StoryObj = {
  name: 'Switch',
  render: () => (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Switch id="notifications" />
        <Label htmlFor="notifications">Enable notifications</Label>
      </div>
      <div className="flex items-center gap-3">
        <Switch id="dark" defaultChecked />
        <Label htmlFor="dark">Dark mode</Label>
      </div>
      <div className="flex items-center gap-3">
        <Switch id="switch-disabled" disabled />
        <Label htmlFor="switch-disabled" className="opacity-50">Disabled</Label>
      </div>
    </div>
  ),
};

export const RadioGroupStory: StoryObj = {
  name: 'Radio Group',
  render: () => (
    <RadioGroup defaultValue="comfortable">
      <div className="flex items-center gap-2">
        <RadioGroupItem value="compact" id="compact" />
        <Label htmlFor="compact">Compact</Label>
      </div>
      <div className="flex items-center gap-2">
        <RadioGroupItem value="comfortable" id="comfortable" />
        <Label htmlFor="comfortable">Comfortable</Label>
      </div>
      <div className="flex items-center gap-2">
        <RadioGroupItem value="spacious" id="spacious" />
        <Label htmlFor="spacious">Spacious</Label>
      </div>
    </RadioGroup>
  ),
};

export const ProgressStory: StoryObj = {
  name: 'Progress',
  render: () => (
    <div className="w-[300px] space-y-4">
      <Progress value={0} />
      <Progress value={33} />
      <Progress value={66} />
      <Progress value={100} />
    </div>
  ),
};

export const SeparatorStory: StoryObj = {
  name: 'Separator',
  render: () => (
    <div className="w-[300px] space-y-3">
      <p className="text-sm text-foreground">Section one content</p>
      <Separator />
      <p className="text-sm text-foreground">Section two content</p>
      <Separator />
      <p className="text-sm text-foreground">Section three content</p>
    </div>
  ),
};
