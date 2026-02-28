'use client';

import React from 'react';
import { ArrowLeft, Plus, FileText, Megaphone, BookOpen, Lightbulb } from 'lucide-react';

const ENTITY_ICONS: Record<string, typeof FileText> = {
  post: FileText,
  funnel: Megaphone,
  lead_magnet: BookOpen,
  idea: Lightbulb,
};

interface Props {
  title?: string;
  entityType?: string;
  entityTitle?: string;
  onBack: () => void;
  onNewThread: () => void;
}

export function ConversationHeader({
  title,
  entityType,
  entityTitle,
  onBack,
  onNewThread,
}: Props) {
  const EntityIcon = entityType ? ENTITY_ICONS[entityType] : null;

  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-200 dark:border-zinc-800">
      <button
        onClick={onBack}
        className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
        aria-label="Back"
      >
        <ArrowLeft className="w-4 h-4" />
      </button>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
          {title || 'New conversation'}
        </p>
        {EntityIcon && entityTitle && (
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <EntityIcon className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{entityTitle}</span>
          </div>
        )}
      </div>

      <button
        onClick={onNewThread}
        className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
        aria-label="New thread"
      >
        <Plus className="w-4 h-4" />
      </button>
    </div>
  );
}
