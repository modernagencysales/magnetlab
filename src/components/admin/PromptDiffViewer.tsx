'use client';

import { diffLines, type Change } from 'diff';

interface Props {
  oldText: string;
  newText: string;
  oldLabel: string;
  newLabel: string;
}

export function PromptDiffViewer({ oldText, newText, oldLabel, newLabel }: Props) {
  const changes: Change[] = diffLines(oldText, newText);

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="flex text-xs font-medium border-b border-border">
        <div className="flex-1 bg-destructive/10 px-3 py-2 text-destructive">
          {oldLabel}
        </div>
        <div className="flex-1 px-3 py-2 bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400">
          {newLabel}
        </div>
      </div>
      <div className="font-mono text-xs overflow-auto max-h-[500px]">
        {changes.map((change, i) => (
          <div
            key={i}
            className={
              change.added
                ? 'bg-green-50 dark:bg-green-950/20 text-green-800 dark:text-green-300'
                : change.removed
                  ? 'bg-destructive/10 text-destructive'
                  : 'text-muted-foreground'
            }
          >
            <pre className="px-3 py-0.5 whitespace-pre-wrap">
              {change.added ? '+ ' : change.removed ? '- ' : '  '}
              {change.value}
            </pre>
          </div>
        ))}
      </div>
    </div>
  );
}
