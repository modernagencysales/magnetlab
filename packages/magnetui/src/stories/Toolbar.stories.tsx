import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { Toolbar, ToolbarGroup, ToolbarSeparator } from '../components/toolbar';
import { Button } from '../components/button';
import { Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, List, ListOrdered } from 'lucide-react';

const meta: Meta<typeof Toolbar> = {
  title: 'Composite/Toolbar',
  component: Toolbar,
};
export default meta;
type Story = StoryObj<typeof Toolbar>;

export const Default: Story = {
  render: () => (
    <Toolbar>
      <ToolbarGroup>
        <Button variant="ghost" size="icon-sm"><Bold className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon-sm"><Italic className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon-sm"><Underline className="h-4 w-4" /></Button>
      </ToolbarGroup>
      <ToolbarSeparator />
      <ToolbarGroup>
        <Button variant="ghost" size="icon-sm"><AlignLeft className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon-sm"><AlignCenter className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon-sm"><AlignRight className="h-4 w-4" /></Button>
      </ToolbarGroup>
      <ToolbarSeparator />
      <ToolbarGroup>
        <Button variant="ghost" size="icon-sm"><List className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon-sm"><ListOrdered className="h-4 w-4" /></Button>
      </ToolbarGroup>
    </Toolbar>
  ),
};
