'use client';

import React, { useState } from 'react';
import { Send, Square } from 'lucide-react';
import { Button, Textarea } from '@magnetlab/magnetui';

interface ConversationInputProps {
  onSend: (text: string) => void;
  onCancel: () => void;
  isStreaming: boolean;
}

export function ConversationInput({ onSend, onCancel, isStreaming }: ConversationInputProps) {
  const [text, setText] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || isStreaming) return;
    onSend(text.trim());
    setText('');
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-2">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e);
          }
        }}
        placeholder="Ask anything..."
        className="flex-1 resize-none min-h-[40px] max-h-[120px]"
        rows={1}
        disabled={isStreaming}
      />
      {isStreaming ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onCancel}
          className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
          aria-label="Stop generating"
        >
          <Square className="w-4 h-4" />
        </Button>
      ) : (
        <Button
          type="submit"
          variant="ghost"
          size="icon-sm"
          disabled={!text.trim()}
          className="text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/20"
          aria-label="Send message"
        >
          <Send className="w-4 h-4" />
        </Button>
      )}
    </form>
  );
}
