'use client';

import { Loader2, CheckSquare, Square } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PipelinePost, ContentIdea } from '@/lib/types/content-pipeline';
import { FocusedCard } from './KanbanCard';
import { COLUMN_STYLES, type ColumnId } from './KanbanColumn';
import { BulkSelectionBar } from './BulkSelectionBar';
import { DetailPane } from './DetailPane';
import { PostDetailModal } from './PostDetailModal';
import { useKanban, type KanbanBoardProps } from '@/frontend/hooks/useKanban';

export type { KanbanBoardProps };

export function KanbanBoard(props: KanbanBoardProps) {
  const {
    loading,
    focusedColumn,
    selectedIds,
    previewItem,
    modalPost,
    polishing,
    isProcessing,
    setPreviewItem,
    setModalPost,
    getColumnItems,
    refresh,
    handleColumnSwitch,
    handleToggleSelect,
    selectAll,
    clearSelection,
    handleCardClick,
    handleCardAction,
    handleBulkPrimary,
    handleBulkDelete,
    handleWritePost,
    handleContentUpdate,
    handleOpenModal,
    handlePolish,
  } = useKanban(props);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const columns: ColumnId[] = ['ideas', 'written', 'review', 'scheduled'];
  const currentItems = getColumnItems(focusedColumn);
  const allSelected =
    currentItems.length > 0 && currentItems.every((i) => selectedIds.has(i.data.id));

  return (
    <div>
      {/* Column tabs */}
      <div className="flex gap-1 mb-4 p-1 rounded-lg bg-muted/50">
        {columns.map((col) => {
          const items = getColumnItems(col);
          const config = COLUMN_STYLES[col];
          const active = focusedColumn === col;
          return (
            <button
              key={col}
              onClick={() => handleColumnSwitch(col)}
              className={cn(
                'flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition-all flex-1',
                active
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
              )}
            >
              <span className={cn('h-2 w-2 rounded-full shrink-0', config.dotColor)} />
              <span>{config.label}</span>
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                  active ? config.badgeColor : 'text-muted-foreground'
                )}
              >
                {items.length}
              </span>
            </button>
          );
        })}
      </div>

      {/* Focused column content */}
      <div className="flex gap-4">
        <div className="flex-1 min-w-0">
          {/* Select all header */}
          {currentItems.length > 0 && (
            <div className="flex items-center gap-3 mb-3 px-1">
              <button
                onClick={allSelected ? clearSelection : selectAll}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {allSelected ? (
                  <CheckSquare className="h-4 w-4 text-primary" />
                ) : (
                  <Square className="h-4 w-4" />
                )}
              </button>
              <span className="text-xs text-muted-foreground">
                {selectedIds.size > 0
                  ? `${selectedIds.size} of ${currentItems.length} selected`
                  : `${currentItems.length} items`}
              </span>
            </div>
          )}

          {/* Item list */}
          <div className="space-y-2">
            {currentItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <p className="text-sm">No items in this column</p>
                <p className="text-xs mt-1">
                  {focusedColumn === 'ideas' && 'Process some transcripts to generate ideas'}
                  {focusedColumn === 'written' && 'Write posts from your ideas'}
                  {focusedColumn === 'review' && 'Move written posts here for review'}
                  {focusedColumn === 'scheduled' && 'Schedule approved posts for publishing'}
                </p>
              </div>
            ) : (
              currentItems.map((item) => (
                <FocusedCard
                  key={item.data.id}
                  item={item}
                  selected={selectedIds.has(item.data.id)}
                  previewActive={previewItem?.item.data.id === item.data.id}
                  onToggleSelect={(e) => handleToggleSelect(item.data.id, e)}
                  onClick={() => handleCardClick(item)}
                  onAction={(action) => handleCardAction(item, action)}
                />
              ))
            )}
          </div>
        </div>

        {/* Detail pane */}
        {previewItem && (
          <div className="w-[400px] shrink-0">
            <div className="sticky top-0 h-[calc(100vh-200px)]">
              <DetailPane
                item={
                  previewItem.item.type === 'idea'
                    ? { type: 'idea', data: previewItem.item.data as ContentIdea }
                    : {
                        type: 'post',
                        data: previewItem.item.data as PipelinePost,
                        idea: previewItem.idea,
                      }
                }
                onClose={() => setPreviewItem(null)}
                onWritePost={handleWritePost}
                onContentUpdate={handleContentUpdate}
                onOpenModal={handleOpenModal}
                onRefresh={refresh}
              />
            </div>
          </div>
        )}
      </div>

      {/* Bulk selection bar */}
      {selectedIds.size > 0 && (
        <BulkSelectionBar
          count={selectedIds.size}
          activeColumn={focusedColumn}
          isProcessing={isProcessing}
          onPrimaryAction={handleBulkPrimary}
          onDelete={handleBulkDelete}
          onClear={clearSelection}
        />
      )}

      {/* Post detail modal */}
      {modalPost && (
        <PostDetailModal
          post={modalPost}
          onClose={() => setModalPost(null)}
          onPolish={handlePolish}
          onUpdate={refresh}
          polishing={polishing}
        />
      )}
    </div>
  );
}
