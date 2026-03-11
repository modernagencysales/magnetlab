'use client';

/** AcceleratorPage. Main layout: chat + progress panel.
 *  Stub — full implementation in Task 14. */

export default function AcceleratorPage({ userId }: { userId: string }) {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold">GTM Accelerator</h1>
        <p className="mt-2 text-muted-foreground">Loading your program...</p>
        <p className="mt-1 text-xs text-muted-foreground">User: {userId}</p>
      </div>
    </div>
  );
}
