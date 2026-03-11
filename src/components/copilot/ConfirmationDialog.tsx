'use client';

import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@magnetlab/magnetui';

const ACTION_DESCRIPTIONS: Record<string, string> = {
  schedule_post: 'Schedule this post for publishing',
  publish_funnel: 'Publish this funnel page (makes it publicly accessible)',
  create_lead_magnet: 'Create a new lead magnet',
};

function getActionDescription(toolName: string): string {
  return ACTION_DESCRIPTIONS[toolName] || `Execute ${toolName}`;
}

interface ConfirmationDialogProps {
  toolName: string;
  toolArgs: Record<string, unknown>;
  toolUseId: string;
  onConfirm: (toolUseId: string, approved: boolean) => void;
}

export function ConfirmationDialog({
  toolName,
  toolArgs,
  toolUseId,
  onConfirm,
}: ConfirmationDialogProps) {
  return (
    <div className="mx-4 mb-3 rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30 p-4">
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
        <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
          Confirmation Required
        </h3>
      </div>

      <p className="text-sm text-amber-800 dark:text-amber-300 mb-3">
        {getActionDescription(toolName)}
      </p>

      <pre className="text-xs bg-amber-100 dark:bg-amber-900/40 rounded p-2 mb-3 overflow-x-auto text-amber-900 dark:text-amber-200">
        {JSON.stringify(toolArgs, null, 2)}
      </pre>

      <div className="flex items-center gap-2">
        <Button size="sm" onClick={() => onConfirm(toolUseId, true)}>
          Confirm
        </Button>
        <Button variant="outline" size="sm" onClick={() => onConfirm(toolUseId, false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
