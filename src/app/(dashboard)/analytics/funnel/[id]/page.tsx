import { PageContainer } from '@magnetlab/magnetui';
import { FunnelDetail } from '@/components/analytics/FunnelDetail';

export const metadata = {
  title: 'Funnel Analytics | MagnetLab',
};

export default async function FunnelAnalyticsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <PageContainer maxWidth="xl">
      <div className="space-y-6">
        <FunnelDetail funnelId={id} />
      </div>
    </PageContainer>
  );
}
