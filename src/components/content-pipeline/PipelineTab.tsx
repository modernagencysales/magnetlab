'use client';

import { useState, useCallback } from 'react';
import { LayoutGrid, Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { KanbanBoard } from './KanbanBoard';
import { CalendarView } from './CalendarView';

type PipelineView = 'board' | 'calendar';

export function PipelineTab() {
  const [view, setView] = useState<PipelineView>('board');
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <button
          onClick={() => setView('board')}
          className={cn(
            'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
            view === 'board' ? 'bg-primary text-primary-foreground' : 'bg-secondary hover:bg-secondary/80'
          )}
        >
          <LayoutGrid className="h-4 w-4" />
          Board
        </button>
        <button
          onClick={() => setView('calendar')}
          className={cn(
            'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
            view === 'calendar' ? 'bg-primary text-primary-foreground' : 'bg-secondary hover:bg-secondary/80'
          )}
        >
          <CalendarIcon className="h-4 w-4" />
          Calendar
        </button>
      </div>

      {view === 'board' ? (
        <KanbanBoard key={refreshKey} onRefresh={handleRefresh} />
      ) : (
        <CalendarView />
      )}
    </div>
  );
}
