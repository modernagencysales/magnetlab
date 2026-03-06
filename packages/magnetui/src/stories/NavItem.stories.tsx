import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { NavItem } from '../components/nav-item';
import { Badge } from '../components/badge';
import {
  LayoutDashboard,
  FileText,
  Users,
  BarChart3,
  Settings,
  Inbox,
  Zap,
} from 'lucide-react';

const meta: Meta<typeof NavItem> = {
  title: 'Primitives/NavItem',
  component: NavItem,
  argTypes: {
    variant: { control: 'select', options: ['default', 'active', 'ghost'] },
    size: { control: 'select', options: ['default', 'sm', 'lg'] },
    active: { control: 'boolean' },
  },
};
export default meta;
type Story = StoryObj<typeof NavItem>;

export const Default: Story = {
  args: {
    children: 'Dashboard',
    icon: <LayoutDashboard />,
  },
};

export const Active: Story = {
  args: {
    children: 'Dashboard',
    icon: <LayoutDashboard />,
    active: true,
  },
};

export const WithBadge: Story = {
  args: {
    children: 'Inbox',
    icon: <Inbox />,
    badge: <Badge variant="count">3</Badge>,
  },
};

export const Sidebar: Story = {
  name: 'Sidebar Navigation',
  render: () => (
    <div className="w-[220px] space-y-0.5 p-2 rounded-lg border bg-background">
      <NavItem icon={<LayoutDashboard />} active>Dashboard</NavItem>
      <NavItem icon={<FileText />}>Library</NavItem>
      <NavItem icon={<Users />}>Leads</NavItem>
      <NavItem icon={<BarChart3 />}>Analytics</NavItem>
      <NavItem icon={<Zap />} badge={<Badge variant="count">5</Badge>}>Signals</NavItem>
      <NavItem icon={<Settings />}>Settings</NavItem>
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div className="w-[220px] space-y-2">
      <NavItem icon={<LayoutDashboard />} size="sm">Small</NavItem>
      <NavItem icon={<LayoutDashboard />} size="default">Default</NavItem>
      <NavItem icon={<LayoutDashboard />} size="lg">Large</NavItem>
    </div>
  ),
};
