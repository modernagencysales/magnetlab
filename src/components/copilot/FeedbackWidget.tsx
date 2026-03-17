'use client';

import React, { useState } from 'react';
import { ThumbsUp, ThumbsDown, Send, X } from 'lucide-react';
import { Button, Input } from '@magnetlab/magnetui';

interface FeedbackWidgetProps {
  onFeedback: (rating: 'positive' | 'negative', note?: string) => void;
  existingFeedback?: { rating: 'positive' | 'negative'; note?: string };
}

export function FeedbackWidget({ onFeedback, existingFeedback }: FeedbackWidgetProps) {
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [note, setNote] = useState('');

  const handlePositive = () => {
    if (!existingFeedback) onFeedback('positive', undefined);
  };

  const handleNegative = () => {
    if (existingFeedback) return;
    setShowNoteInput(true);
  };

  const submitNegative = () => {
    onFeedback('negative', note.trim() || undefined);
    setShowNoteInput(false);
    setNote('');
  };

  const skipNote = () => {
    onFeedback('negative', undefined);
    setShowNoteInput(false);
    setNote('');
  };

  return (
    <div className="flex flex-col items-start gap-1 mt-1">
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={handlePositive}
          className={
            existingFeedback?.rating === 'positive'
              ? 'text-emerald-500'
              : 'text-muted-foreground hover:text-foreground'
          }
          aria-label="Good response"
        >
          <ThumbsUp className="w-3 h-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={handleNegative}
          className={
            existingFeedback?.rating === 'negative'
              ? 'text-destructive'
              : 'text-muted-foreground hover:text-foreground'
          }
          aria-label="Bad response"
        >
          <ThumbsDown className="w-3 h-3" />
        </Button>
      </div>

      {showNoteInput && !existingFeedback && (
        <div className="flex items-center gap-1 w-full max-w-[85%]">
          <Input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What could be better?"
            className="flex-1 text-xs h-7"
            maxLength={200}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitNegative();
            }}
          />
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={submitNegative}
            className="text-violet-600 hover:text-violet-700"
            aria-label="Submit feedback"
          >
            <Send className="w-3 h-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={skipNote}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Skip note"
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      )}
    </div>
  );
}
