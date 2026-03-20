'use client';

/**
 * ContactList. Left sidebar listing all DM Coach contacts.
 * Search, status filter tabs, contact items, and add button.
 * Never imports server-only modules.
 */

import { useState, useMemo } from 'react';
import {
  Button,
  SearchInput,
  Tabs,
  TabsList,
  TabsTrigger,
  Skeleton,
  EmptyState,
} from '@magnetlab/magnetui';
import { Plus, MessageSquare } from 'lucide-react';
import { useDmCoachStore } from '@/frontend/stores/dm-coach';
import type { DmcContact, ContactStatus } from '@/lib/types/dm-coach';
import { ContactListItem } from './ContactListItem';

// ─── Types ─────────────────────────────────────────────────────────

interface ContactListProps {
  contacts: DmcContact[];
  isLoading: boolean;
  onMutate: () => Promise<void>;
}

type FilterTab = 'all' | 'active' | 'closed_won' | 'closed_lost';

const FILTER_TABS: { value: FilterTab; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'closed_won', label: 'Won' },
  { value: 'closed_lost', label: 'Lost' },
];

// ─── Component ─────────────────────────────────────────────────────

export function ContactList({ contacts, isLoading, onMutate: _onMutate }: ContactListProps) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterTab>('all');
  const { activeContactId, setActiveContactId, setIsAddingContact } = useDmCoachStore();

  const filtered = useMemo(() => {
    let result = contacts;

    if (filter !== 'all') {
      result = result.filter((c) => c.status === (filter as ContactStatus));
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.company?.toLowerCase().includes(q) ||
          c.headline?.toLowerCase().includes(q)
      );
    }

    return result;
  }, [contacts, filter, search]);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="space-y-2 border-b p-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Contacts</h2>
          <span className="text-xs text-muted-foreground">{contacts.length}</span>
        </div>
        <SearchInput value={search} onValueChange={setSearch} placeholder="Search contacts..." />
        <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterTab)}>
          <TabsList className="h-7 w-full">
            {FILTER_TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value} className="h-6 text-xs">
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="space-y-1 p-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-md" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<MessageSquare />}
            title={search ? 'No matches' : 'No contacts yet'}
            description={search ? 'Try a different search' : 'Add a contact to start coaching'}
            className="py-8"
          />
        ) : (
          <div className="space-y-0.5 p-1">
            {filtered.map((contact) => (
              <ContactListItem
                key={contact.id}
                contact={contact}
                isSelected={contact.id === activeContactId}
                onSelect={() => setActiveContactId(contact.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Add button */}
      <div className="border-t p-2">
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => setIsAddingContact(true)}
        >
          <Plus className="mr-1.5 size-3.5" />
          Add Contact
        </Button>
      </div>
    </div>
  );
}
