import { FlowList } from '@/components/email/FlowList';

export const metadata = {
  title: 'Email Flows | MagnetLab',
  description: 'Create and manage automated email flows',
};

export default function EmailFlowsPage() {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold">Flows</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Automated email sequences triggered by events like lead magnet opt-ins.
        </p>
      </div>
      <FlowList />
    </div>
  );
}
