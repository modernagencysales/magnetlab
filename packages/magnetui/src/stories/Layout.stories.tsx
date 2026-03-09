import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { TopBar } from '../components/top-bar';
import { PageContainer } from '../components/page-container';
import { SectionContainer } from '../components/section-container';
import { MasterDetail, MasterPane, DetailPane } from '../components/master-detail';
import { SettingsLayout } from '../components/settings-layout';
import { NavItem } from '../components/nav-item';
import { Button } from '../components/button';
import { SearchInput } from '../components/search-input';
import { ListRow } from '../components/list-row';
import { SectionLabel } from '../components/section-label';
import { Badge } from '../components/badge';
import { Avatar, AvatarFallback } from '../components/avatar';
import {
  ArrowLeft,
  Bell,
  Plus,
  Settings,
  User,
  CreditCard,
  Lock,
  Palette,
} from 'lucide-react';

const meta: Meta = {
  title: 'Layout',
  parameters: { layout: 'fullscreen' },
};
export default meta;

// ─── TopBar ─────────────────────────────────────────────────────────────────

export const TopBarStory: StoryObj = {
  name: 'TopBar',
  render: () => (
    <div className="w-full">
      <TopBar
        leading={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon-sm"><ArrowLeft className="h-4 w-4" /></Button>
            <span className="text-sm font-semibold">Lead Magnets</span>
          </div>
        }
        trailing={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon-sm"><Bell className="h-4 w-4" /></Button>
            <Avatar size="sm">
              <AvatarFallback name="User">U</AvatarFallback>
            </Avatar>
          </div>
        }
      />
    </div>
  ),
};

// ─── PageContainer ──────────────────────────────────────────────────────────

export const PageContainerStory: StoryObj = {
  name: 'PageContainer',
  render: () => (
    <div className="bg-background border rounded-lg">
      {(['sm', 'md', 'lg', 'xl'] as const).map((size) => (
        <PageContainer key={size} maxWidth={size} className="border-b last:border-b-0">
          <div className="rounded-md bg-muted p-4 text-center text-sm text-muted-foreground">
            maxWidth=&quot;{size}&quot;
          </div>
        </PageContainer>
      ))}
    </div>
  ),
};

// ─── SectionContainer ───────────────────────────────────────────────────────

export const SectionContainerStory: StoryObj = {
  name: 'SectionContainer',
  render: () => (
    <PageContainer maxWidth="lg">
      <div className="space-y-8">
        <SectionContainer
          title="General Settings"
          description="Manage your account preferences"
        >
          <div className="rounded-md border p-4 text-sm text-muted-foreground">
            Settings content goes here
          </div>
        </SectionContainer>
        <SectionContainer
          title="Integrations"
          description="Connect your favorite tools"
          actions={<Button size="sm"><Plus className="h-4 w-4" /> Add Integration</Button>}
        >
          <div className="rounded-md border p-4 text-sm text-muted-foreground">
            Integrations list goes here
          </div>
        </SectionContainer>
      </div>
    </PageContainer>
  ),
};

// ─── MasterDetail ───────────────────────────────────────────────────────────

export const MasterDetailStory: StoryObj = {
  name: 'MasterDetail',
  render: () => (
    <div className="h-[400px] rounded-lg border overflow-hidden">
      <MasterDetail>
        <MasterPane width={280}>
          <div className="p-2 border-b">
            <SearchInput value="" placeholder="Search..." />
          </div>
          <div className="p-1">
            <SectionLabel>Contacts</SectionLabel>
            <ListRow
              selected
              leading={<Avatar size="sm"><AvatarFallback name="Alice">A</AvatarFallback></Avatar>}
              trailing={<Badge variant="green">New</Badge>}
              description="alice@company.com"
            >
              Alice Johnson
            </ListRow>
            <ListRow
              leading={<Avatar size="sm"><AvatarFallback name="Bob">B</AvatarFallback></Avatar>}
              description="bob@company.com"
            >
              Bob Smith
            </ListRow>
            <ListRow
              leading={<Avatar size="sm"><AvatarFallback name="Charlie">C</AvatarFallback></Avatar>}
              description="charlie@company.com"
            >
              Charlie Brown
            </ListRow>
          </div>
        </MasterPane>
        <DetailPane className="p-6">
          <h2 className="text-lg font-semibold">Alice Johnson</h2>
          <p className="text-sm text-muted-foreground mt-1">alice@company.com</p>
          <div className="mt-4 text-sm text-muted-foreground">
            Detail content for the selected item goes here.
          </div>
        </DetailPane>
      </MasterDetail>
    </div>
  ),
};

// ─── SettingsLayout ─────────────────────────────────────────────────────────

export const SettingsLayoutStory: StoryObj = {
  name: 'SettingsLayout',
  render: () => (
    <div className="h-[400px] rounded-lg border overflow-hidden">
      <SettingsLayout
        sidebar={
          <>
            <SectionLabel>Settings</SectionLabel>
            <NavItem icon={<User />} active>Account</NavItem>
            <NavItem icon={<CreditCard />}>Billing</NavItem>
            <NavItem icon={<Lock />}>Security</NavItem>
            <NavItem icon={<Palette />}>Branding</NavItem>
            <NavItem icon={<Settings />}>Developer</NavItem>
          </>
        }
      >
        <PageContainer maxWidth="md">
          <h2 className="text-lg font-semibold">Account Settings</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your account information and preferences.
          </p>
          <div className="mt-6 rounded-md border p-4 text-sm text-muted-foreground">
            Settings form content goes here.
          </div>
        </PageContainer>
      </SettingsLayout>
    </div>
  ),
};
