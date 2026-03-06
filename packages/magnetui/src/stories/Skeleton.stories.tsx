import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { Skeleton } from '../components/skeleton';
import { LoadingRow } from '../components/loading-row';
import { LoadingCard } from '../components/loading-card';

const meta: Meta = {
  title: 'Base/Skeleton',
};
export default meta;

export const Default: StoryObj = {
  render: () => (
    <div className="space-y-3 w-[300px]">
      <Skeleton className="h-4 w-[250px]" />
      <Skeleton className="h-4 w-[200px]" />
      <Skeleton className="h-4 w-[150px]" />
    </div>
  ),
};

export const CardSkeleton: StoryObj = {
  name: 'Card Skeleton',
  render: () => (
    <div className="w-[300px] rounded-lg border p-4 space-y-3">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="space-y-1.5 flex-1">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-4/5" />
    </div>
  ),
};

export const LoadingRowStory: StoryObj = {
  name: 'LoadingRow',
  render: () => (
    <div className="w-[400px]">
      <LoadingRow count={4} showAvatar />
    </div>
  ),
};

export const LoadingCardStory: StoryObj = {
  name: 'LoadingCard',
  render: () => (
    <div className="w-[700px]">
      <LoadingCard count={3} />
    </div>
  ),
};
