'use client';

import React from 'react';
import { MessageSquare, X } from 'lucide-react';
import { useCopilot } from './CopilotProvider';

export function CopilotToggleButton() {
  const { isOpen, toggle } = useCopilot();

  return (
    <button
      onClick={toggle}
      className="fixed bottom-6 right-6 z-30 w-12 h-12 rounded-full bg-violet-600 text-white shadow-lg hover:bg-violet-700 transition-all flex items-center justify-center hover:scale-105 active:scale-95"
      aria-label={isOpen ? 'Close co-pilot' : 'Open co-pilot'}
    >
      {isOpen ? <X className="w-5 h-5" /> : <MessageSquare className="w-5 h-5" />}
    </button>
  );
}
