'use client';

/**
 * InspoPage. Top-level Inspo hub with 4 tabs: Queue, Exploits, Recycle, Trends.
 * Header has "Run Scanner" and "Paste Creative" actions.
 */

import { useState } from 'react';
import {
  PageContainer,
  PageTitle,
  Button,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@magnetlab/magnetui';
import { ScanSearch, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useRunScanner } from '@/frontend/hooks/api/useScanner';
import { InspoQueueTab } from './InspoQueueTab';
import { InspoExploitsTab } from './InspoExploitsTab';
import { InspoRecycleTab } from './InspoRecycleTab';
import { InspoTrendsTab } from './InspoTrendsTab';
import { PasteCreativeModal } from './PasteCreativeModal';

export function InspoPage() {
  const [pasteOpen, setPasteOpen] = useState(false);
  const { mutate: triggerScan, isPending: scanning } = useRunScanner(() => {
    toast.success('Scan started — new creatives will appear shortly');
  });

  return (
    <PageContainer maxWidth="xl">
      <div className="space-y-6">
        {/* ─── Header ────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <PageTitle
            title="Inspiration"
            description="Review external content, pick exploits, generate posts"
          />
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => triggerScan().catch(() => toast.error('Failed to start scan'))}
              disabled={scanning}
            >
              <ScanSearch className="h-4 w-4 mr-1.5" />
              {scanning ? 'Scanning...' : 'Run Scanner'}
            </Button>
            <Button size="sm" onClick={() => setPasteOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              Paste Creative
            </Button>
          </div>
        </div>

        {/* ─── Tabs ──────────────────────────────────────────── */}
        <Tabs defaultValue="queue">
          <TabsList>
            <TabsTrigger value="queue">Queue</TabsTrigger>
            <TabsTrigger value="exploits">Exploits</TabsTrigger>
            <TabsTrigger value="recycle">Recycle</TabsTrigger>
            <TabsTrigger value="trends">Trends</TabsTrigger>
          </TabsList>

          <TabsContent value="queue" className="mt-4">
            <InspoQueueTab onPasteCreative={() => setPasteOpen(true)} />
          </TabsContent>
          <TabsContent value="exploits" className="mt-4">
            <InspoExploitsTab />
          </TabsContent>
          <TabsContent value="recycle" className="mt-4">
            <InspoRecycleTab />
          </TabsContent>
          <TabsContent value="trends" className="mt-4">
            <InspoTrendsTab />
          </TabsContent>
        </Tabs>
      </div>

      {/* ─── Modals ─────────────────────────────────────────── */}
      <PasteCreativeModal open={pasteOpen} onOpenChange={setPasteOpen} />
    </PageContainer>
  );
}
