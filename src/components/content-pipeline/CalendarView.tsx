'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
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

export function CalendarView() {
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
      const response = await fetch(`/api/content-pipeline/posts/by-date-range?start=${start}&end=${end}`);
      const data = await response.json();
      setPosts(data.posts || []);
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
  const days = calendarStart && calendarEnd ? eachDayOfInterval({ start: calendarStart, end: calendarEnd }) : [];

  const getPostsForDay = (day: Date) =>
    posts.filter((p) => p.scheduled_time && isSameDay(new Date(p.scheduled_time), day));

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
        <button
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          className="rounded-lg p-1.5 hover:bg-secondary transition-colors"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h3 className="text-base font-semibold">{format(currentMonth, 'MMMM yyyy')}</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setCurrentMonth(new Date()); setToday(new Date()); }}
            className="rounded-lg border border-border px-3 py-1 text-xs font-medium hover:bg-muted transition-colors"
          >
            Today
          </button>
          <button
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            className="rounded-lg p-1.5 hover:bg-secondary transition-colors"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

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

              return (
                <button
                  key={day.toISOString()}
                  onClick={() => dayPosts.length > 0 && setSelectedDay(day)}
                  className={cn(
                    'min-h-[80px] p-1.5 text-left transition-colors',
                    isCurrentMonth ? 'bg-card' : 'bg-muted/30',
                    dayPosts.length > 0 && 'cursor-pointer hover:bg-muted/50',
                    isToday && 'ring-1 ring-inset ring-primary'
                  )}
                >
                  <span className={cn(
                    'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs',
                    isToday && 'bg-primary text-primary-foreground font-medium',
                    !isCurrentMonth && 'text-muted-foreground/50'
                  )}>
                    {format(day, 'd')}
                  </span>
                  {dayPosts.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-0.5">
                      {dayPosts.slice(0, 3).map((post) => (
                        <div
                          key={post.id}
                          className={cn(
                            'h-1.5 w-1.5 rounded-full',
                            post.status === 'published' ? 'bg-green-500' :
                            post.status === 'scheduled' ? 'bg-blue-500' :
                            'bg-amber-500'
                          )}
                        />
                      ))}
                      {dayPosts.length > 3 && (
                        <span className="text-[9px] text-muted-foreground">+{dayPosts.length - 3}</span>
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
