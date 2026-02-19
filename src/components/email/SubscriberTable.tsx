'use client';

import { useState, useEffect, useCallback } from 'react';
import { Search, Plus, Upload, Trash2, Loader2, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { AddSubscriberDialog } from '@/components/email/AddSubscriberDialog';
import { CsvImportDialog } from '@/components/email/CsvImportDialog';
import type { EmailSubscriber, SubscriberStatus, SubscriberSource } from '@/lib/types/email-system';

const STATUS_BADGE_CLASSES: Record<SubscriberStatus, string> = {
  active: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900 dark:text-green-300 dark:border-green-800',
  unsubscribed: 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700',
  bounced: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900 dark:text-red-300 dark:border-red-800',
};

const SOURCE_BADGE_CLASSES: Record<SubscriberSource, string> = {
  lead_magnet: 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900 dark:text-purple-300 dark:border-purple-800',
  manual: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900 dark:text-blue-300 dark:border-blue-800',
  import: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900 dark:text-orange-300 dark:border-orange-800',
};

const SOURCE_LABELS: Record<SubscriberSource, string> = {
  lead_magnet: 'Lead Magnet',
  manual: 'Manual',
  import: 'Import',
};

export function SubscriberTable() {
  const [subscribers, setSubscribers] = useState<EmailSubscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Pagination
  const [page, setPage] = useState(1);
  const limit = 50;

  // Dialogs
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const fetchSubscribers = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('limit', limit.toString());

      if (search) {
        params.set('search', search);
      }
      if (statusFilter !== 'all') {
        params.set('status', statusFilter);
      }

      const response = await fetch(`/api/email/subscribers?${params}`);
      if (!response.ok) throw new Error('Failed to fetch subscribers');

      const data = await response.json();
      setSubscribers(data.subscribers);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load subscribers');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, search]);

  useEffect(() => {
    fetchSubscribers();
  }, [fetchSubscribers]);

  // Debounced search: reset to page 1 when search changes
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const handleDelete = async (id: string, email: string) => {
    const confirmed = window.confirm(`Unsubscribe ${email}? This will stop all email flows for this subscriber.`);
    if (!confirmed) return;

    setDeletingId(id);
    try {
      const response = await fetch(`/api/email/subscribers/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to unsubscribe');
      }

      toast.success(`${email} has been unsubscribed`);
      fetchSubscribers();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to unsubscribe';
      toast.error(message);
    } finally {
      setDeletingId(null);
    }
  };

  const handleRefresh = () => {
    fetchSubscribers();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getName = (subscriber: EmailSubscriber): string | null => {
    const parts = [subscriber.first_name, subscriber.last_name].filter(Boolean);
    return parts.length > 0 ? parts.join(' ') : null;
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by email or name..."
              className="pl-10"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="unsubscribed">Unsubscribed</option>
            <option value="bounced">Bounced</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
            <Upload className="h-4 w-4" />
            Import CSV
          </Button>
          <Button onClick={() => setAddDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            Add Subscriber
          </Button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950">
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : subscribers.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <Mail className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-medium">No subscribers yet</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Add subscribers manually or import a CSV file to get started.
          </p>
          <div className="mt-6 flex items-center justify-center gap-2">
            <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
              <Upload className="h-4 w-4" />
              Import CSV
            </Button>
            <Button onClick={() => setAddDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              Add Subscriber
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Source
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Subscribed
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {subscribers.map((subscriber) => (
                  <tr
                    key={subscriber.id}
                    className="hover:bg-muted/30"
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-sm">{subscriber.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-muted-foreground">
                        {getName(subscriber) || '-'}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant="outline"
                        className={STATUS_BADGE_CLASSES[subscriber.status]}
                      >
                        {subscriber.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant="outline"
                        className={SOURCE_BADGE_CLASSES[subscriber.source]}
                      >
                        {SOURCE_LABELS[subscriber.source] || subscriber.source}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {formatDate(subscriber.subscribed_at)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(subscriber.id, subscriber.email)}
                        disabled={deletingId === subscriber.id || subscriber.status === 'unsubscribed'}
                        title={subscriber.status === 'unsubscribed' ? 'Already unsubscribed' : 'Unsubscribe'}
                      >
                        {deletingId === subscriber.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                        )}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {total > limit && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page >= totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Dialogs */}
      <AddSubscriberDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onSuccess={handleRefresh}
      />
      <CsvImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onSuccess={handleRefresh}
      />
    </div>
  );
}
