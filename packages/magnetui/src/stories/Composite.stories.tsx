import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { FormField } from '../components/form-field';
import { SearchInput } from '../components/search-input';
import { StatCard } from '../components/stat-card';
import { ActionMenu } from '../components/action-menu';
import { ConfirmDialog } from '../components/confirm-dialog';
import { DateDisplay } from '../components/date-display';
import { RelativeTime } from '../components/relative-time';
import { InfoRow } from '../components/info-row';
import { TagInput } from '../components/tag-input';
import { Combobox } from '../components/combobox';
import { FilterBar } from '../components/filter-bar';
import { Input } from '../components/input';
import { Button } from '../components/button';
import { Badge } from '../components/badge';
import {
  Users,
  Eye,
  MousePointerClick,
  TrendingUp,
  Edit,
  Trash2,
  Copy,
  MoreHorizontal,
} from 'lucide-react';

const meta: Meta = {
  title: 'Composite',
};
export default meta;

// ─── FormField ──────────────────────────────────────────────────────────────

export const FormFieldStory: StoryObj = {
  name: 'FormField',
  render: () => (
    <div className="w-[350px] space-y-4">
      <FormField label="Email" htmlFor="email" required>
        <Input id="email" type="email" placeholder="name@example.com" />
      </FormField>
      <FormField label="Name" htmlFor="name" hint="This will be shown publicly">
        <Input id="name" placeholder="John Doe" />
      </FormField>
      <FormField label="Website" htmlFor="website" error="Please enter a valid URL">
        <Input id="website" placeholder="https://..." defaultValue="not-a-url" />
      </FormField>
    </div>
  ),
};

// ─── SearchInput ────────────────────────────────────────────────────────────

export const SearchInputStory: StoryObj = {
  name: 'SearchInput',
  render: () => {
    const [value, setValue] = React.useState('');
    return (
      <div className="w-[300px] space-y-3">
        <SearchInput
          value={value}
          onValueChange={setValue}
          placeholder="Search leads..."
        />
        <SearchInput
          value="Active search"
          onValueChange={() => {}}
          placeholder="Search..."
        />
      </div>
    );
  },
};

// ─── StatCard ───────────────────────────────────────────────────────────────

export const StatCardStory: StoryObj = {
  name: 'StatCard',
  render: () => (
    <div className="grid grid-cols-2 gap-4 w-[500px]">
      <StatCard label="Total Leads" value="1,234" icon={<Users />} description="+12% from last month" />
      <StatCard label="Page Views" value="8,567" icon={<Eye />} description="+5% from last week" />
      <StatCard label="Click Rate" value="4.2%" icon={<MousePointerClick />} description="-0.3% from last month" />
      <StatCard label="Conversions" value="89" icon={<TrendingUp />} description="+23% from last month" />
    </div>
  ),
};

// ─── ActionMenu ─────────────────────────────────────────────────────────────

export const ActionMenuStory: StoryObj = {
  name: 'ActionMenu',
  render: () => (
    <div className="flex gap-4">
      <ActionMenu
        actions={[
          { label: 'Edit', icon: <Edit />, onClick: () => {} },
          { label: 'Duplicate', icon: <Copy />, onClick: () => {} },
          { label: 'Delete', icon: <Trash2 />, onClick: () => {}, variant: 'destructive', separator: true },
        ]}
      />
      <ActionMenu
        trigger={<Button variant="outline" size="sm"><MoreHorizontal className="h-4 w-4" /> Actions</Button>}
        actions={[
          { label: 'Edit', icon: <Edit />, onClick: () => {} },
          { label: 'Duplicate', icon: <Copy />, onClick: () => {} },
          { label: 'Delete', icon: <Trash2 />, onClick: () => {}, variant: 'destructive', separator: true },
        ]}
      />
    </div>
  ),
};

// ─── ConfirmDialog ──────────────────────────────────────────────────────────

export const ConfirmDialogStory: StoryObj = {
  name: 'ConfirmDialog',
  render: () => {
    const [open, setOpen] = React.useState(false);
    const [destructiveOpen, setDestructiveOpen] = React.useState(false);
    return (
      <div className="flex gap-3">
        <Button variant="outline" onClick={() => setOpen(true)}>Confirm Action</Button>
        <ConfirmDialog
          open={open}
          onOpenChange={setOpen}
          title="Are you sure?"
          description="This action will publish your lead magnet to all connected channels."
          confirmLabel="Publish"
          onConfirm={() => {}}
        />
        <Button variant="destructive" onClick={() => setDestructiveOpen(true)}>Delete</Button>
        <ConfirmDialog
          open={destructiveOpen}
          onOpenChange={setDestructiveOpen}
          title="Delete lead magnet?"
          description="This action cannot be undone. All associated leads and analytics data will be permanently removed."
          variant="destructive"
          confirmLabel="Delete"
          onConfirm={() => {}}
        />
      </div>
    );
  },
};

// ─── DateDisplay & RelativeTime ─────────────────────────────────────────────

export const DateDisplayStory: StoryObj = {
  name: 'DateDisplay',
  render: () => (
    <div className="space-y-2">
      <DateDisplay date="2025-12-25" format="short" />
      <DateDisplay date="2025-12-25" format="medium" />
      <DateDisplay date="2025-12-25" format="long" />
    </div>
  ),
};

export const RelativeTimeStory: StoryObj = {
  name: 'RelativeTime',
  render: () => {
    const now = Date.now();
    return (
      <div className="space-y-2">
        <RelativeTime date={new Date(now - 30_000)} />
        <RelativeTime date={new Date(now - 5 * 60_000)} />
        <RelativeTime date={new Date(now - 3 * 3600_000)} />
        <RelativeTime date={new Date(now - 2 * 86400_000)} />
        <RelativeTime date={new Date(now - 14 * 86400_000)} />
      </div>
    );
  },
};

// ─── InfoRow ────────────────────────────────────────────────────────────────

export const InfoRowStory: StoryObj = {
  name: 'InfoRow',
  render: () => (
    <div className="w-[400px]">
      <InfoRow label="Name">John Doe</InfoRow>
      <InfoRow label="Email">john@example.com</InfoRow>
      <InfoRow label="Plan"><Badge variant="purple">Pro</Badge></InfoRow>
      <InfoRow label="Status"><Badge variant="green">Active</Badge></InfoRow>
      <InfoRow label="Member Since" bordered={false}>Jan 15, 2025</InfoRow>
    </div>
  ),
};

// ─── TagInput ───────────────────────────────────────────────────────────────

export const TagInputStory: StoryObj = {
  name: 'TagInput',
  render: () => {
    const [tags, setTags] = React.useState(['linkedin', 'marketing']);
    return (
      <div className="w-[400px] space-y-4">
        <TagInput
          value={tags}
          onChange={setTags}
          placeholder="Add keyword..."
        />
        <TagInput
          value={['tag1', 'tag2', 'tag3']}
          onChange={() => {}}
          maxTags={3}
          placeholder="Max 3 tags"
        />
        <TagInput
          value={['disabled']}
          onChange={() => {}}
          disabled
        />
      </div>
    );
  },
};

// ─── Combobox ───────────────────────────────────────────────────────────────

export const ComboboxStory: StoryObj = {
  name: 'Combobox',
  render: () => {
    const [value, setValue] = React.useState('');
    const options = [
      { value: 'react', label: 'React' },
      { value: 'vue', label: 'Vue' },
      { value: 'angular', label: 'Angular' },
      { value: 'svelte', label: 'Svelte' },
      { value: 'solid', label: 'SolidJS' },
    ];
    return (
      <div className="w-[300px]">
        <Combobox
          options={options}
          value={value}
          onValueChange={setValue}
          placeholder="Select framework..."
        />
      </div>
    );
  },
};

// ─── FilterBar ──────────────────────────────────────────────────────────────

export const FilterBarStory: StoryObj = {
  name: 'FilterBar',
  render: () => {
    const [filters, setFilters] = React.useState([
      { key: 'status', label: 'Status', value: 'Active' },
      { key: 'type', label: 'Type', value: 'Lead Magnet' },
    ]);
    return (
      <div className="w-[600px]">
        <FilterBar
          filters={filters}
          onRemoveFilter={(key) => setFilters(filters.filter((f) => f.key !== key))}
          onClearAll={() => setFilters([])}
        >
          <Button variant="outline" size="sm">Add Filter</Button>
        </FilterBar>
      </div>
    );
  },
};
