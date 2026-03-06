import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/tabs';

const meta: Meta = {
  title: 'Base/Tabs',
  parameters: { layout: 'padded' },
};
export default meta;

export const Underline: StoryObj = {
  render: () => (
    <Tabs defaultValue="overview" className="w-[400px]">
      <TabsList variant="underline">
        <TabsTrigger value="overview" variant="underline">Overview</TabsTrigger>
        <TabsTrigger value="analytics" variant="underline">Analytics</TabsTrigger>
        <TabsTrigger value="settings" variant="underline">Settings</TabsTrigger>
      </TabsList>
      <TabsContent value="overview" className="pt-4">
        <p className="text-sm text-muted-foreground">Overview content goes here.</p>
      </TabsContent>
      <TabsContent value="analytics" className="pt-4">
        <p className="text-sm text-muted-foreground">Analytics content goes here.</p>
      </TabsContent>
      <TabsContent value="settings" className="pt-4">
        <p className="text-sm text-muted-foreground">Settings content goes here.</p>
      </TabsContent>
    </Tabs>
  ),
};

export const Pill: StoryObj = {
  render: () => (
    <Tabs defaultValue="all" className="w-[400px]">
      <TabsList variant="pill">
        <TabsTrigger value="all" variant="pill">All</TabsTrigger>
        <TabsTrigger value="published" variant="pill">Published</TabsTrigger>
        <TabsTrigger value="draft" variant="pill">Draft</TabsTrigger>
      </TabsList>
      <TabsContent value="all" className="pt-4">
        <p className="text-sm text-muted-foreground">All items.</p>
      </TabsContent>
      <TabsContent value="published" className="pt-4">
        <p className="text-sm text-muted-foreground">Published items only.</p>
      </TabsContent>
      <TabsContent value="draft" className="pt-4">
        <p className="text-sm text-muted-foreground">Draft items only.</p>
      </TabsContent>
    </Tabs>
  ),
};
