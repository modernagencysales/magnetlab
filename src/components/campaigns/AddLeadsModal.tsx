'use client';

/** Bulk add leads modal. Paste LinkedIn URLs, one per line. */

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Textarea,
  Button,
} from '@magnetlab/magnetui';
import { logError } from '@/lib/utils/logger';
import * as outreachCampaignsApi from '@/frontend/api/outreach-campaigns';
import type { AddOutreachLeadInput } from '@/frontend/api/outreach-campaigns';

// ─── Types ───────────────────────────────────────────────────────────────────

interface AddLeadsModalProps {
  campaignId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded: () => void;
}

// ─── Parsing ──────────────────────────────────────────────────────────────────

function parseLeadLines(raw: string): AddOutreachLeadInput[] {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(',').map((p) => p.trim());
      return {
        linkedin_url: parts[0] ?? '',
        name: parts[1] || undefined,
        company: parts[2] || undefined,
      };
    })
    .filter((lead) => Boolean(lead.linkedin_url));
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AddLeadsModal({ campaignId, open, onOpenChange, onAdded }: AddLeadsModalProps) {
  const [rawInput, setRawInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    setRawInput('');
    setResult(null);
    setError(null);
    onOpenChange(false);
  };

  const handleSubmit = async () => {
    const leads = parseLeadLines(rawInput);
    if (leads.length === 0) {
      setError('No valid LinkedIn URLs found. Add at least one URL.');
      return;
    }

    setError(null);
    setIsLoading(true);
    try {
      const res = await outreachCampaignsApi.addLeads(campaignId, leads);
      setResult(
        `Added ${res.added} leads${res.skipped > 0 ? ` (${res.skipped} skipped — already in campaign)` : ''}`
      );
      onAdded();
    } catch (err) {
      logError('AddLeadsModal/submit', err);
      setError(err instanceof Error ? err.message : 'Failed to add leads');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Leads</DialogTitle>
          <DialogDescription>
            Paste LinkedIn profile URLs, one per line. Optionally include name and company
            separated by commas: <code>url, name, company</code>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Textarea
            value={rawInput}
            onChange={(e) => setRawInput(e.target.value)}
            placeholder={`https://linkedin.com/in/johndoe\nhttps://linkedin.com/in/janedoe, Jane Doe, Acme Corp`}
            rows={8}
            className="font-mono text-sm"
          />

          {result && (
            <p className="text-sm text-green-600 dark:text-green-400">{result}</p>
          )}

          {error && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isLoading ? 'Adding...' : 'Add Leads'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
