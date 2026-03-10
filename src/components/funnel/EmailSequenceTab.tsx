'use client';

import { useState, useEffect } from 'react';
import {
  Mail,
  Sparkles,
  Loader2,
  CheckCircle,
  AlertCircle,
  PlayCircle,
  PauseCircle,
  Edit2,
  ChevronDown,
  ChevronUp,
  Clock,
} from 'lucide-react';
import { Button, Input, Textarea, Label } from '@magnetlab/magnetui';
import type { Email, EmailSequence } from '@/lib/types/email';

import { logError } from '@/lib/utils/logger';
import * as emailSequenceApi from '@/frontend/api/email-sequence';

interface EmailSequenceTabProps {
  leadMagnetId: string;
}

function EmailCard({
  email,
  index,
  isExpanded,
  onToggle,
  onEdit,
  isEditing,
  editedEmail,
  setEditedEmail,
  onSaveEdit,
  onCancelEdit,
}: {
  email: Email;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  isEditing: boolean;
  editedEmail: Email | null;
  setEditedEmail: (email: Email) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
}) {
  const dayLabels = ['Immediately', '24 hours', '48 hours', '72 hours', '96 hours'];

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-medium">
            {index + 1}
          </div>
          <div className="text-left">
            <p className="font-medium">{email.subject}</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {dayLabels[email.day]}
            </p>
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-5 w-5 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-5 w-5 text-muted-foreground" />
        )}
      </button>

      {isExpanded && (
        <div className="border-t p-4 space-y-4">
          {isEditing ? (
            <>
              <div className="space-y-2">
                <Label>Subject</Label>
                <Input
                  type="text"
                  value={editedEmail?.subject || ''}
                  onChange={(e) => setEditedEmail({ ...editedEmail!, subject: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Email Body</Label>
                <Textarea
                  value={editedEmail?.body || ''}
                  onChange={(e) => setEditedEmail({ ...editedEmail!, body: e.target.value })}
                  rows={10}
                  className="font-mono resize-y"
                />
              </div>
              <div className="space-y-2">
                <Label>Reply Trigger</Label>
                <Input
                  type="text"
                  value={editedEmail?.replyTrigger || ''}
                  onChange={(e) =>
                    setEditedEmail({ ...editedEmail!, replyTrigger: e.target.value })
                  }
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={onSaveEdit}>Save Changes</Button>
                <Button variant="outline" onClick={onCancelEdit}>
                  Cancel
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <pre className="whitespace-pre-wrap font-sans text-sm bg-muted/50 p-4 rounded-lg">
                  {email.body}
                </pre>
              </div>
              <div className="flex items-center justify-between pt-2 border-t">
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium">Reply trigger:</span> {email.replyTrigger}
                </p>
                <Button variant="ghost" size="sm" onClick={onEdit}>
                  <Edit2 className="h-4 w-4 mr-1" />
                  Edit
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

const GENERATING_MESSAGES = [
  'Analyzing your lead magnet...',
  'Crafting email subjects...',
  'Writing personalized email copy...',
  'Adding engagement hooks...',
  'Finalizing your 5-email sequence...',
];

export function EmailSequenceTab({ leadMagnetId }: EmailSequenceTabProps) {
  const [sequence, setSequence] = useState<EmailSequence | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generatingMessage, setGeneratingMessage] = useState('');
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [expandedEmail, setExpandedEmail] = useState<number | null>(null);
  const [editingEmail, setEditingEmail] = useState<number | null>(null);
  const [editedEmail, setEditedEmail] = useState<Email | null>(null);

  // Fetch existing sequence on mount
  useEffect(() => {
    async function fetchSequence() {
      try {
        const data = await emailSequenceApi.getEmailSequence(leadMagnetId);
        if (data.emailSequence) setSequence(data.emailSequence as EmailSequence);
      } catch (err) {
        logError('funnel/email-sequence', err, { step: 'error_fetching_email_sequence' });
      } finally {
        setLoading(false);
      }
    }
    fetchSequence();
  }, [leadMagnetId]);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    setSuccess(null);
    setGeneratingMessage(GENERATING_MESSAGES[0]);

    // Cycle through progress messages
    let msgIndex = 0;
    const msgInterval = setInterval(() => {
      msgIndex = Math.min(msgIndex + 1, GENERATING_MESSAGES.length - 1);
      setGeneratingMessage(GENERATING_MESSAGES[msgIndex]);
    }, 4000);

    try {
      const data = await emailSequenceApi.generateEmailSequence(leadMagnetId, true);
      setSequence(data.emailSequence as EmailSequence);
      setSuccess('Email sequence generated successfully!');
      setExpandedEmail(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate email sequence');
    } finally {
      clearInterval(msgInterval);
      setGenerating(false);
      setGeneratingMessage('');
    }
  };

  const handleActivate = async () => {
    setActivating(true);
    setError(null);
    setSuccess(null);

    try {
      const data = await emailSequenceApi.activateEmailSequence(leadMagnetId);
      setSequence(data.emailSequence as EmailSequence);
      setSuccess(
        (data as { message?: string }).message ||
          'Email sequence activated! New leads will receive it automatically.'
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to activate email sequence');
    } finally {
      setActivating(false);
    }
  };

  const handleDeactivate = async () => {
    setActivating(true);
    setError(null);
    setSuccess(null);

    try {
      const data = await emailSequenceApi.updateEmailSequence(leadMagnetId, { status: 'synced' });
      setSequence(data.emailSequence as EmailSequence);
      setSuccess('Email sequence paused. New leads will not receive emails.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to deactivate email sequence');
    } finally {
      setActivating(false);
    }
  };

  const handleEditEmail = (index: number) => {
    if (sequence?.emails[index]) {
      setEditingEmail(index);
      setEditedEmail({ ...sequence.emails[index] });
    }
  };

  const handleSaveEdit = async () => {
    if (editingEmail === null || !editedEmail || !sequence) return;

    setError(null);
    setSuccess(null);

    const updatedEmails = [...sequence.emails];
    updatedEmails[editingEmail] = editedEmail;

    try {
      const data = await emailSequenceApi.updateEmailSequence(leadMagnetId, {
        emails: updatedEmails,
      });
      setSequence(data.emailSequence as EmailSequence);
      setEditingEmail(null);
      setEditedEmail(null);
      setSuccess('Email updated successfully!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes');
    }
  };

  const handleCancelEdit = () => {
    setEditingEmail(null);
    setEditedEmail(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Mail className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">Email Welcome Sequence</h3>
            <p className="text-sm text-muted-foreground">
              5 emails sent automatically after opt-in
            </p>
          </div>
        </div>

        {sequence && (
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${
                sequence.status === 'active'
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  : sequence.status === 'synced'
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                    : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400'
              }`}
            >
              {sequence.status === 'active' && <CheckCircle className="h-3 w-3" />}
              {sequence.status === 'synced' && <CheckCircle className="h-3 w-3" />}
              {sequence.status.charAt(0).toUpperCase() + sequence.status.slice(1)}
            </span>
          </div>
        )}
      </div>

      {/* Messages */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <AlertCircle className="h-5 w-5 text-red-500" />
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <CheckCircle className="h-5 w-5 text-green-500" />
          <p className="text-sm text-green-800 dark:text-green-200">{success}</p>
        </div>
      )}

      {/* Generating overlay */}
      {generating && (
        <div className="text-center py-12 border-2 border-primary/30 rounded-lg bg-primary/5">
          <Loader2 className="h-10 w-10 mx-auto text-primary animate-spin mb-4" />
          <h4 className="font-medium mb-2">Generating Your Email Sequence</h4>
          <p className="text-sm text-muted-foreground animate-pulse">{generatingMessage}</p>
        </div>
      )}

      {/* No sequence yet */}
      {!sequence && !generating && (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <Mail className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h4 className="font-medium mb-2">No Email Sequence Yet</h4>
          <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
            Generate a 5-email welcome sequence that will be sent to leads after they opt in. The
            sequence is personalized based on your lead magnet and brand kit.
          </p>
          <Button onClick={handleGenerate}>
            <Sparkles className="h-4 w-4 mr-2" />
            Generate Email Sequence
          </Button>
        </div>
      )}

      {/* Email cards */}
      {!generating && sequence && sequence.emails && sequence.emails.length > 0 && (
        <div className="space-y-3">
          {sequence.emails.map((email, index) => (
            <EmailCard
              key={`email-${email.day}-${index}`}
              email={email}
              index={index}
              isExpanded={expandedEmail === index}
              onToggle={() => setExpandedEmail(expandedEmail === index ? null : index)}
              onEdit={() => handleEditEmail(index)}
              isEditing={editingEmail === index}
              editedEmail={editedEmail}
              setEditedEmail={setEditedEmail}
              onSaveEdit={handleSaveEdit}
              onCancelEdit={handleCancelEdit}
            />
          ))}
        </div>
      )}

      {/* Action buttons */}
      {!generating && sequence && (
        <div className="flex items-center gap-3 pt-4 border-t">
          <Button variant="outline" onClick={handleGenerate} disabled={generating}>
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            Regenerate
          </Button>

          {sequence.status !== 'active' && (
            <Button onClick={handleActivate} disabled={activating}>
              {activating ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <PlayCircle className="h-4 w-4 mr-2" />
              )}
              Activate Sequence
            </Button>
          )}

          {sequence.status === 'active' && (
            <>
              <Button
                variant="outline"
                onClick={handleDeactivate}
                disabled={activating}
                className="border-yellow-300 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-100 dark:hover:bg-yellow-900/30"
              >
                {activating ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <PauseCircle className="h-4 w-4 mr-2" />
                )}
                Pause Emails
              </Button>
              <p className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
                <CheckCircle className="h-4 w-4" />
                Active - new leads will receive this sequence
              </p>
            </>
          )}
        </div>
      )}

      {/* Info box */}
      <div className="rounded-lg bg-muted/50 p-4 space-y-2">
        <h4 className="font-medium text-sm">How it works</h4>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>1. Generate your 5-email sequence using AI</li>
          <li>2. Review and customize each email</li>
          <li>3. Activate the sequence to go live</li>
          <li>4. When leads opt in, they receive the sequence automatically</li>
          <li>5. Pause anytime to stop sending to new leads</li>
        </ul>
      </div>
    </div>
  );
}
