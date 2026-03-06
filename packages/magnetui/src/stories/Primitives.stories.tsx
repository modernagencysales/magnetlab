import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { SectionLabel } from '../components/section-label';
import { ListRow } from '../components/list-row';
import { PropertyGroup } from '../components/property-group';
import { SettingRow } from '../components/setting-row';
import { StatusDot } from '../components/status-dot';
import { PageTitle } from '../components/page-title';
import { Kbd } from '../components/kbd';
import { Spinner } from '../components/spinner';
import { Truncate } from '../components/truncate';
import { DotSeparator } from '../components/dot-separator';
import { IconWrapper } from '../components/icon-wrapper';
import { Badge } from '../components/badge';
import { Button } from '../components/button';
import { Switch } from '../components/switch';
import { Avatar, AvatarFallback } from '../components/avatar';
import {
  FileText,
  BarChart3,
  Settings,
  Zap,
  Mail,
  Globe,
  Shield,
  Bell,
} from 'lucide-react';

const meta: Meta = {
  title: 'Primitives',
};
export default meta;

// ─── SectionLabel ──────────────────────────────────────────────────────────

export const SectionLabelStory: StoryObj = {
  name: 'SectionLabel',
  render: () => (
    <div className="w-[300px] space-y-4">
      <SectionLabel>Navigation</SectionLabel>
      <SectionLabel action={<Button variant="ghost" size="sm" className="h-5 text-2xs">View All</Button>}>
        Recent Items
      </SectionLabel>
    </div>
  ),
};

// ─── ListRow ───────────────────────────────────────────────────────────────

export const ListRowStory: StoryObj = {
  name: 'ListRow',
  render: () => (
    <div className="w-[400px] space-y-0.5">
      <ListRow
        leading={<Avatar size="sm"><AvatarFallback name="Alice">A</AvatarFallback></Avatar>}
        trailing={<Badge variant="green">Active</Badge>}
        description="alice@example.com"
      >
        Alice Johnson
      </ListRow>
      <ListRow
        selected
        leading={<Avatar size="sm"><AvatarFallback name="Bob">B</AvatarFallback></Avatar>}
        trailing={<Badge variant="orange">Pending</Badge>}
        description="bob@example.com"
      >
        Bob Smith
      </ListRow>
      <ListRow
        leading={<Avatar size="sm"><AvatarFallback name="Charlie">C</AvatarFallback></Avatar>}
        trailing={<Badge variant="gray">Inactive</Badge>}
        description="charlie@example.com"
      >
        Charlie Brown
      </ListRow>
    </div>
  ),
};

// ─── PropertyGroup ─────────────────────────────────────────────────────────

export const PropertyGroupStory: StoryObj = {
  name: 'PropertyGroup',
  render: () => (
    <div className="w-[300px] space-y-4">
      <PropertyGroup label="Name">John Doe</PropertyGroup>
      <PropertyGroup label="Email" description="This is your primary email">
        john@example.com
      </PropertyGroup>
      <PropertyGroup label="Plan">
        <Badge variant="purple">Pro</Badge>
      </PropertyGroup>
    </div>
  ),
};

// ─── SettingRow ─────────────────────────────────────────────────────────────

export const SettingRowStory: StoryObj = {
  name: 'SettingRow',
  render: () => (
    <div className="w-[500px] divide-y">
      <SettingRow
        label="Email notifications"
        description="Receive email when someone captures a lead"
        action={<Switch defaultChecked />}
      />
      <SettingRow
        label="Auto-publish"
        description="Automatically publish lead magnets after review"
        action={<Switch />}
      />
      <SettingRow
        label="API access"
        description="Enable API access for external integrations"
        action={<Button variant="outline" size="sm">Configure</Button>}
      />
    </div>
  ),
};

// ─── StatusDot ─────────────────────────────────────────────────────────────

export const StatusDotStory: StoryObj = {
  name: 'StatusDot',
  render: () => (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2"><StatusDot status="success" /> <span className="text-sm">Success</span></div>
        <div className="flex items-center gap-2"><StatusDot status="warning" /> <span className="text-sm">Warning</span></div>
        <div className="flex items-center gap-2"><StatusDot status="error" /> <span className="text-sm">Error</span></div>
        <div className="flex items-center gap-2"><StatusDot status="info" /> <span className="text-sm">Info</span></div>
        <div className="flex items-center gap-2"><StatusDot status="neutral" /> <span className="text-sm">Neutral</span></div>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2"><StatusDot status="success" size="sm" /> <span className="text-xs">Small</span></div>
        <div className="flex items-center gap-2"><StatusDot status="success" size="md" /> <span className="text-xs">Medium</span></div>
        <div className="flex items-center gap-2"><StatusDot status="success" size="lg" /> <span className="text-xs">Large</span></div>
      </div>
      <div className="flex items-center gap-2">
        <StatusDot status="success" pulse /> <span className="text-sm">Pulsing</span>
      </div>
    </div>
  ),
};

// ─── PageTitle ─────────────────────────────────────────────────────────────

export const PageTitleStory: StoryObj = {
  name: 'PageTitle',
  parameters: { layout: 'padded' },
  render: () => (
    <div className="w-[600px] space-y-6">
      <PageTitle title="Lead Magnets" />
      <PageTitle
        title="Analytics Dashboard"
        description="Track your lead magnet performance"
      />
      <PageTitle
        title="Content Library"
        description="Manage your published content"
        actions={
          <Button size="sm">
            <FileText className="h-4 w-4" /> New Content
          </Button>
        }
      />
    </div>
  ),
};

// ─── Kbd ───────────────────────────────────────────────────────────────────

export const KbdStory: StoryObj = {
  name: 'Kbd',
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      <Kbd>⌘</Kbd>
      <Kbd>K</Kbd>
      <span className="text-sm text-muted-foreground mx-2">|</span>
      <Kbd>⌘</Kbd><Kbd>⇧</Kbd><Kbd>P</Kbd>
      <span className="text-sm text-muted-foreground mx-2">|</span>
      <Kbd>Esc</Kbd>
      <span className="text-sm text-muted-foreground mx-2">|</span>
      <Kbd>Enter</Kbd>
    </div>
  ),
};

// ─── Spinner ───────────────────────────────────────────────────────────────

export const SpinnerStory: StoryObj = {
  name: 'Spinner',
  render: () => (
    <div className="flex items-center gap-4">
      <Spinner size="sm" />
      <Spinner size="md" />
      <Spinner size="lg" />
    </div>
  ),
};

// ─── Truncate ──────────────────────────────────────────────────────────────

export const TruncateStory: StoryObj = {
  name: 'Truncate',
  render: () => (
    <div className="w-[250px] space-y-3">
      <Truncate lines={1} className="text-sm">
        This is a very long text that should be truncated after one line because it exceeds the container width.
      </Truncate>
      <Truncate lines={2} className="text-sm">
        This text will be truncated after two lines. It contains enough content to demonstrate multi-line truncation with an ellipsis at the end of the second line.
      </Truncate>
      <Truncate lines={3} className="text-sm">
        This text will be truncated after three lines. It contains even more content to demonstrate the three-line clamp behavior. The ellipsis should appear at the very end of the third line.
      </Truncate>
    </div>
  ),
};

// ─── DotSeparator ──────────────────────────────────────────────────────────

export const DotSeparatorStory: StoryObj = {
  name: 'DotSeparator',
  render: () => (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <span>John Doe</span>
      <DotSeparator />
      <span>5 min ago</span>
      <DotSeparator />
      <span>3 comments</span>
    </div>
  ),
};

// ─── IconWrapper ───────────────────────────────────────────────────────────

export const IconWrapperStory: StoryObj = {
  name: 'IconWrapper',
  render: () => (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <IconWrapper variant="default"><Settings /></IconWrapper>
        <IconWrapper variant="primary"><Zap /></IconWrapper>
        <IconWrapper variant="success"><Mail /></IconWrapper>
        <IconWrapper variant="warning"><Bell /></IconWrapper>
        <IconWrapper variant="error"><Shield /></IconWrapper>
        <IconWrapper variant="info"><Globe /></IconWrapper>
      </div>
      <div className="flex items-center gap-3">
        <IconWrapper size="sm" variant="primary"><Zap /></IconWrapper>
        <IconWrapper size="md" variant="primary"><Zap /></IconWrapper>
        <IconWrapper size="lg" variant="primary"><Zap /></IconWrapper>
      </div>
    </div>
  ),
};
