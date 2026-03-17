'use client';

import React from 'react';
import { MessageSquare, X } from 'lucide-react';
import { Button } from '@magnetlab/magnetui';
import { useCopilot } from './CopilotProvider';

export function CopilotToggleButton() {
  const { isOpen, toggle } = useCopilot();

  return (
    <Button
      onClick={toggle}
      className="fixed bottom-6 right-6 z-30 w-12 h-12 rounded-full shadow-lg hover:scale-105 active:scale-95"
      aria-label={isOpen ? 'Close co-pilot' : 'Open co-pilot'}
    >
      {isOpen ? <X className="w-5 h-5" /> : <MessageSquare className="w-5 h-5" />}
    </Button>
  );
}
