// Column types and configuration — shared by KanbanBoard, BulkSelectionBar, etc.

export type ColumnId = 'ideas' | 'written' | 'review' | 'scheduled';

export interface ColumnConfig {
  label: string;
  dotColor: string;
  badgeColor: string;
}

export const COLUMN_STYLES: Record<ColumnId, ColumnConfig> = {
  ideas: {
    label: 'Ideas',
    dotColor: 'bg-purple-500',
    badgeColor: 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300',
  },
  written: {
    label: 'Written',
    dotColor: 'bg-blue-500',
    badgeColor: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
  },
  review: {
    label: 'Review',
    dotColor: 'bg-green-500',
    badgeColor: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300',
  },
  scheduled: {
    label: 'Scheduled',
    dotColor: 'bg-amber-500',
    badgeColor: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
  },
};
