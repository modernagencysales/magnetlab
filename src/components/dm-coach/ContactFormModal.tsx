'use client';

/**
 * ContactFormModal. Create or edit a DM Coach contact.
 * Uses Dialog from magnetui. Fields: name, linkedin_url, headline, company, location, goal, notes.
 * Never imports server-only modules.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  Button,
  Input,
  Textarea,
  FormField,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@magnetlab/magnetui';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import * as dmCoachApi from '@/frontend/api/dm-coach';
import type { DmcContact, ConversationGoal } from '@/lib/types/dm-coach';
import { CONVERSATION_GOALS } from '@/lib/types/dm-coach';

// ─── Types ─────────────────────────────────────────────────────────

interface ContactFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact?: DmcContact;
  onSaved: (contact: DmcContact) => Promise<void>;
}

interface FormData {
  name: string;
  linkedin_url: string;
  headline: string;
  company: string;
  location: string;
  conversation_goal: ConversationGoal;
  notes: string;
}

const INITIAL_FORM: FormData = {
  name: '',
  linkedin_url: '',
  headline: '',
  company: '',
  location: '',
  conversation_goal: 'book_meeting',
  notes: '',
};

const GOAL_KEYS = Object.keys(CONVERSATION_GOALS) as ConversationGoal[];

// ─── Component ─────────────────────────────────────────────────────

export function ContactFormModal({ open, onOpenChange, contact, onSaved }: ContactFormModalProps) {
  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const isEditing = Boolean(contact);

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      if (contact) {
        setForm({
          name: contact.name,
          linkedin_url: contact.linkedin_url ?? '',
          headline: contact.headline ?? '',
          company: contact.company ?? '',
          location: contact.location ?? '',
          conversation_goal: contact.conversation_goal,
          notes: contact.notes ?? '',
        });
      } else {
        setForm(INITIAL_FORM);
      }
    }
  }, [open, contact]);

  const updateField = useCallback(<K extends keyof FormData>(key: K, value: FormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleSave = useCallback(async () => {
    const trimmedName = form.name.trim();
    if (!trimmedName) {
      toast.error('Name is required');
      return;
    }

    setSaving(true);
    try {
      if (contact) {
        const result = await dmCoachApi.updateContact(contact.id, {
          name: trimmedName,
          linkedin_url: form.linkedin_url.trim() || null,
          headline: form.headline.trim() || null,
          company: form.company.trim() || null,
          location: form.location.trim() || null,
          conversation_goal: form.conversation_goal,
          notes: form.notes.trim() || null,
        });
        await onSaved(result.contact);
        toast.success('Contact updated');
      } else {
        const result = await dmCoachApi.createContact({
          name: trimmedName,
          linkedin_url: form.linkedin_url.trim() || undefined,
          headline: form.headline.trim() || undefined,
          company: form.company.trim() || undefined,
          location: form.location.trim() || undefined,
          conversation_goal: form.conversation_goal,
          notes: form.notes.trim() || undefined,
        });
        await onSaved(result.contact);
        toast.success('Contact created');
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save contact');
    } finally {
      setSaving(false);
    }
  }, [form, contact, onSaved, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Contact' : 'Add Contact'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update contact details for DM coaching.'
              : 'Add a new contact to start DM coaching.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <FormField label="Name" htmlFor="dmc-name" required>
            <Input
              id="dmc-name"
              value={form.name}
              onChange={(e) => updateField('name', e.target.value)}
              placeholder="John Smith"
            />
          </FormField>

          <FormField label="LinkedIn URL" htmlFor="dmc-linkedin">
            <Input
              id="dmc-linkedin"
              value={form.linkedin_url}
              onChange={(e) => updateField('linkedin_url', e.target.value)}
              placeholder="https://linkedin.com/in/..."
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Headline" htmlFor="dmc-headline">
              <Input
                id="dmc-headline"
                value={form.headline}
                onChange={(e) => updateField('headline', e.target.value)}
                placeholder="VP of Marketing"
              />
            </FormField>

            <FormField label="Company" htmlFor="dmc-company">
              <Input
                id="dmc-company"
                value={form.company}
                onChange={(e) => updateField('company', e.target.value)}
                placeholder="Acme Corp"
              />
            </FormField>
          </div>

          <FormField label="Location" htmlFor="dmc-location">
            <Input
              id="dmc-location"
              value={form.location}
              onChange={(e) => updateField('location', e.target.value)}
              placeholder="San Francisco, CA"
            />
          </FormField>

          <FormField label="Goal" htmlFor="dmc-goal">
            <Select
              value={form.conversation_goal}
              onValueChange={(v) => updateField('conversation_goal', v as ConversationGoal)}
            >
              <SelectTrigger id="dmc-goal">
                <SelectValue placeholder="Select goal" />
              </SelectTrigger>
              <SelectContent>
                {GOAL_KEYS.map((key) => (
                  <SelectItem key={key} value={key}>
                    {CONVERSATION_GOALS[key].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <FormField label="Notes" htmlFor="dmc-notes">
            <Textarea
              id="dmc-notes"
              value={form.notes}
              onChange={(e) => updateField('notes', e.target.value)}
              placeholder="Context about this contact..."
              rows={3}
              className="resize-none"
            />
          </FormField>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
            {isEditing ? 'Save Changes' : 'Add Contact'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
