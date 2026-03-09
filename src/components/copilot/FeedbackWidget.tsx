'use client';

import React, { useState } from 'react';
import { ThumbsUp, ThumbsDown, Send, X } from 'lucide-react';

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
        <button
          onClick={handlePositive}
          className={`p-1 rounded transition-colors ${
            existingFeedback?.rating === 'positive'
              ? 'text-emerald-500'
              : 'text-zinc-300 hover:text-zinc-500 dark:text-zinc-600 dark:hover:text-zinc-400'
          }`}
          aria-label="Good response"
        >
          <ThumbsUp className="w-3 h-3" />
        </button>
        <button
          onClick={handleNegative}
          className={`p-1 rounded transition-colors ${
            existingFeedback?.rating === 'negative'
              ? 'text-red-500'
              : 'text-zinc-300 hover:text-zinc-500 dark:text-zinc-600 dark:hover:text-zinc-400'
          }`}
          aria-label="Bad response"
        >
          <ThumbsDown className="w-3 h-3" />
        </button>
      </div>

      {showNoteInput && !existingFeedback && (
        <div className="flex items-center gap-1 w-full max-w-[85%]">
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What could be better?"
            className="flex-1 text-xs px-2 py-1 rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-violet-500"
            maxLength={200}
            onKeyDown={(e) => { if (e.key === 'Enter') submitNegative(); }}
          />
          <button
            onClick={submitNegative}
            className="p-1 text-violet-600 hover:text-violet-700"
            aria-label="Submit feedback"
          >
            <Send className="w-3 h-3" />
          </button>
          <button
            onClick={skipNote}
            className="p-1 text-zinc-400 hover:text-zinc-500"
            aria-label="Skip note"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}
