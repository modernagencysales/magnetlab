'use client';

import { Radio } from 'lucide-react';
import { SignalLeadsTable } from '@/components/signals/SignalLeadsTable';

export default function SignalsPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Radio className="h-6 w-6" />
          Signal Leads
        </h1>
        <p className="text-muted-foreground">
          LinkedIn intent signals — leads discovered through keyword monitoring,
          competitor tracking, and engagement analysis
        </p>
      </div>

      <SignalLeadsTable />
    </div>
  );
}
