import { FlowList } from '@/components/email/FlowList';

export default function FlowsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Email Flows</h1>
          <p className="text-muted-foreground">Automated email sequences for your subscribers.</p>
        </div>
      </div>
      <FlowList />
    </div>
  );
}
