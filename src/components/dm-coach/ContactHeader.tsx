'use client';

/**
 * ContactHeader. Top bar of the detail pane showing contact info,
 * goal selector, stage indicator, edit/delete actions.
 * Never imports server-only modules.
 */

import { useState, useCallback } from 'react';
import { Button, ConfirmDialog, Badge } from '@magnetlab/magnetui';
import { Pencil, Trash2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import * as dmCoachApi from '@/frontend/api/dm-coach';
import { useDmCoachStore } from '@/frontend/stores/dm-coach';
import type { DmcContact } from '@/lib/types/dm-coach';
import { GoalSelector } from './GoalSelector';
import { StageIndicator } from './StageIndicator';
import { ContactFormModal } from './ContactFormModal';

// ─── Types ─────────────────────────────────────────────────────────

interface ContactHeaderProps {
  contact: DmcContact;
  onMutate: () => Promise<void>;
}

// ─── Status Badge Colors ───────────────────────────────────────────

const STATUS_VARIANT: Record<string, 'default' | 'gray' | 'red' | 'green' | 'outline'> = {
  active: 'green',
  paused: 'gray',
  closed_won: 'default',
  closed_lost: 'red',
};

const STATUS_LABEL: Record<string, string> = {
  active: 'Active',
  paused: 'Paused',
  closed_won: 'Won',
  closed_lost: 'Lost',
};

// ─── Component ─────────────────────────────────────────────────────

export function ContactHeader({ contact, onMutate }: ContactHeaderProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const { setActiveContactId } = useDmCoachStore();

  const handleDelete = useCallback(async () => {
    setDeleteLoading(true);
    try {
      await dmCoachApi.deleteContact(contact.id);
      setActiveContactId(null);
      await onMutate();
      toast.success('Contact deleted');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete contact');
    } finally {
      setDeleteLoading(false);
    }
  }, [contact.id, onMutate, setActiveContactId]);

  return (
    <>
      <div className="flex items-start justify-between gap-4 border-b px-4 py-3">
        {/* Left: contact info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-base font-semibold">{contact.name}</h2>
            <Badge variant={STATUS_VARIANT[contact.status] ?? 'outline'} className="text-[10px]">
              {STATUS_LABEL[contact.status] ?? contact.status}
            </Badge>
          </div>
          {contact.headline && (
            <p className="mt-0.5 truncate text-sm text-muted-foreground">{contact.headline}</p>
          )}
          <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
            {contact.company && <span>{contact.company}</span>}
            {contact.location && <span>{contact.location}</span>}
            {contact.linkedin_url && (
              <a
                href={contact.linkedin_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 text-primary hover:underline"
              >
                LinkedIn <ExternalLink className="size-3" />
              </a>
            )}
          </div>
        </div>

        {/* Right: actions */}
        <div className="flex shrink-0 items-center gap-1.5">
          <GoalSelector contact={contact} onMutate={onMutate} />
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setIsEditing(true)}
            title="Edit contact"
          >
            <Pencil className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setIsDeleting(true)}
            title="Delete contact"
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Stage indicator */}
      <div className="border-b px-4 py-2">
        <StageIndicator currentStage={contact.qualification_stage} />
      </div>

      {/* Edit modal */}
      <ContactFormModal
        open={isEditing}
        onOpenChange={setIsEditing}
        contact={contact}
        onSaved={async () => {
          await onMutate();
        }}
      />

      {/* Delete confirmation */}
      <ConfirmDialog
        open={isDeleting}
        onOpenChange={setIsDeleting}
        title="Delete contact"
        description={`Are you sure you want to delete "${contact.name}"? All messages and coaching history will be permanently removed.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
        loading={deleteLoading}
      />
    </>
  );
}
