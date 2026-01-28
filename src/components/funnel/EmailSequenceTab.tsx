'use client';

import { useState, useEffect } from 'react';
import {
  Mail,
  Sparkles,
  Loader2,
  CheckCircle,
  AlertCircle,
  PlayCircle,
  Edit2,
  ChevronDown,
  ChevronUp,
  Clock,
} from 'lucide-react';
import type { Email, EmailSequence } from '@/lib/types/email';

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
                <label className="text-sm font-medium">Subject</label>
                <input
                  type="text"
                  value={editedEmail?.subject || ''}
                  onChange={(e) =>
                    setEditedEmail({ ...editedEmail!, subject: e.target.value })
                  }
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Email Body</label>
                <textarea
                  value={editedEmail?.body || ''}
                  onChange={(e) =>
                    setEditedEmail({ ...editedEmail!, body: e.target.value })
                  }
                  rows={10}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm font-mono focus:border-primary focus:ring-1 focus:ring-primary outline-none resize-y"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Reply Trigger</label>
                <input
                  type="text"
                  value={editedEmail?.replyTrigger || ''}
                  onChange={(e) =>
                    setEditedEmail({ ...editedEmail!, replyTrigger: e.target.value })
                  }
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={onSaveEdit}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  Save Changes
                </button>
                <button
                  onClick={onCancelEdit}
                  className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
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
                <button
                  onClick={onEdit}
                  className="flex items-center gap-1 text-sm text-primary hover:text-primary/80 transition-colors"
                >
                  <Edit2 className="h-4 w-4" />
                  Edit
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function EmailSequenceTab({ leadMagnetId }: EmailSequenceTabProps) {
  const [sequence, setSequence] = useState<EmailSequence | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
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
        const response = await fetch(`/api/email-sequence/${leadMagnetId}`);
        if (response.ok) {
          const data = await response.json();
          setSequence(data.emailSequence);
        }
      } catch (err) {
        console.error('Error fetching email sequence:', err);
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

    try {
      const response = await fetch('/api/email-sequence/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadMagnetId, useAI: true }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to generate');
      }

      const data = await response.json();
      setSequence(data.emailSequence);
      setSuccess('Email sequence generated successfully!');
      setExpandedEmail(0); // Expand first email to show result
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate email sequence');
    } finally {
      setGenerating(false);
    }
  };

  const handleActivate = async () => {
    setActivating(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/email-sequence/${leadMagnetId}/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to activate');
      }

      const data = await response.json();
      setSequence(data.emailSequence);
      setSuccess(data.message || 'Email sequence activated! New leads will receive it automatically.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to activate email sequence');
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

    const updatedEmails = [...sequence.emails];
    updatedEmails[editingEmail] = editedEmail;

    try {
      const response = await fetch(`/api/email-sequence/${leadMagnetId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails: updatedEmails }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save');
      }

      const data = await response.json();
      setSequence(data.emailSequence);
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

      {/* No sequence yet */}
      {!sequence && (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <Mail className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h4 className="font-medium mb-2">No Email Sequence Yet</h4>
          <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
            Generate a 5-email welcome sequence that will be sent to leads after they opt in.
            The sequence is personalized based on your lead magnet and brand kit.
          </p>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Generate Email Sequence
          </button>
        </div>
      )}

      {/* Email cards */}
      {sequence && sequence.emails && sequence.emails.length > 0 && (
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
      {sequence && (
        <div className="flex items-center gap-3 pt-4 border-t">
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50"
          >
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Regenerate
          </button>

          {sequence.status !== 'active' && (
            <button
              onClick={handleActivate}
              disabled={activating}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {activating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <PlayCircle className="h-4 w-4" />
              )}
              Activate Sequence
            </button>
          )}

          {sequence.status === 'active' && (
            <p className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
              <CheckCircle className="h-4 w-4" />
              Active - new leads will receive this sequence
            </p>
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
        </ul>
      </div>
    </div>
  );
}
