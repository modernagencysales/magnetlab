'use client';

import { BookOpen } from 'lucide-react';

export function LibraryTab() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
      <BookOpen className="h-10 w-10 mb-3 opacity-50" />
      <p className="text-sm font-medium">Library</p>
      <p className="text-xs mt-1">Templates and saved content coming soon.</p>
    </div>
  );
}
