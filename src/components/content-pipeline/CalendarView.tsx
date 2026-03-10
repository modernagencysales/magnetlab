'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Loader2, Plus } from 'lucide-react';
import { Button } from '@magnetlab/magnetui';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
} from 'date-fns';
import { cn } from '@/lib/utils';
import type { PipelinePost } from '@/lib/types/content-pipeline';
import { DayPostsModal } from './DayPostsModal';
import { getPostsByDateRange } from '@/frontend/api/content-pipeline/posts';

interface CalendarViewProps {
  onCreatePost?: (date: Date) => void;
}

export function CalendarView({ onCreatePost }: CalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState<Date | null>(null);
  const [posts, setPosts] = useState<PipelinePost[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [today, setToday] = useState<Date | null>(null);

  // Initialize date-dependent state after mount to avoid hydration mismatch
  useEffect(() => {
    const now = new Date();
    setCurrentMonth(now);
    setToday(now);
  }, []);

  const fetchPosts = useCallback(async () => {
    if (!currentMonth) return;
    const start = startOfWeek(startOfMonth(currentMonth)).toISOString();
    const end = endOfWeek(endOfMonth(currentMonth)).toISOString();
    try {
      const list = await getPostsByDateRange(start, end);
      setPosts(list);
    } catch {
      // Silent failure
    } finally {
      setLoading(false);
    }
  }, [currentMonth]);

  useEffect(() => {
    if (!currentMonth) return;
    setLoading(true);
    fetchPosts();
  }, [fetchPosts, currentMonth]);

  const monthStart = currentMonth ? startOfMonth(currentMonth) : null;
  const monthEnd = currentMonth ? endOfMonth(currentMonth) : null;
  const calendarStart = monthStart ? startOfWeek(monthStart) : null;
  const calendarEnd = monthEnd ? endOfWeek(monthEnd) : null;
  const days =
    calendarStart && calendarEnd
      ? eachDayOfInterval({ start: calendarStart, end: calendarEnd })
      : [];

  const getPostsForDay = (day: Date) =>
    posts.filter((p) => p.scheduled_time && isSameDay(new Date(p.scheduled_time), day));

  const handleDayClick = (day: Date) => {
    const dayPosts = getPostsForDay(day);
    if (dayPosts.length > 0) {
      setSelectedDay(day);
    } else if (onCreatePost) {
      onCreatePost(day);
    }
  };

  if (!currentMonth) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div>
      {/* Month Navigation */}
      <div className="mb-4 flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h3 className="text-base font-semibold">{format(currentMonth, 'MMMM yyyy')}</h3>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setCurrentMonth(new Date());
              setToday(new Date());
            }}
          >
            Today
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Empty state hint */}
      {!loading && posts.length === 0 && onCreatePost && (
        <div className="mb-4 rounded-lg border border-dashed border-primary/30 bg-primary/5 p-3 text-center">
          <p className="text-sm text-muted-foreground">Click any date to create a post</p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Day Headers */}
          <div className="mb-1 grid grid-cols-7 gap-px">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div key={day} className="py-1 text-center text-xs font-medium text-muted-foreground">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-px rounded-lg border overflow-hidden">
            {days.map((day) => {
              const dayPosts = getPostsForDay(day);
              const isToday = today ? isSameDay(day, today) : false;
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const isEmpty = dayPosts.length === 0;

              return (
                <button
                  key={day.toISOString()}
                  onClick={() => handleDayClick(day)}
                  className={cn(
                    'group min-h-[80px] p-1.5 text-left transition-colors cursor-pointer',
                    isCurrentMonth ? 'bg-card' : 'bg-muted/30',
                    isEmpty ? 'hover:bg-primary/5' : 'hover:bg-muted/50',
                    isToday && 'ring-1 ring-inset ring-primary'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs',
                        isToday && 'bg-primary text-primary-foreground font-medium',
                        !isCurrentMonth && 'text-muted-foreground/50'
                      )}
                    >
                      {format(day, 'd')}
                    </span>
                    {isEmpty && isCurrentMonth && onCreatePost && (
                      <Plus className="h-3.5 w-3.5 text-muted-foreground/0 group-hover:text-muted-foreground/60 transition-colors" />
                    )}
                  </div>
                  {dayPosts.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-0.5">
                      {dayPosts.slice(0, 3).map((post) => (
                        <div
                          key={post.id}
                          className={cn(
                            'h-1.5 w-1.5 rounded-full',
                            post.status === 'published'
                              ? 'bg-green-500'
                              : post.status === 'scheduled'
                                ? 'bg-blue-500'
                                : 'bg-amber-500'
                          )}
                        />
                      ))}
                      {dayPosts.length > 3 && (
                        <span className="text-[9px] text-muted-foreground">
                          +{dayPosts.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Day Posts Modal */}
      {selectedDay && (
        <DayPostsModal
          day={selectedDay}
          posts={getPostsForDay(selectedDay)}
          onClose={() => setSelectedDay(null)}
          onUpdate={fetchPosts}
        />
      )}
    </div>
  );
}
