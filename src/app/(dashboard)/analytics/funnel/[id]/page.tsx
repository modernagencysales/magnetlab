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
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <FunnelDetail funnelId={id} />
    </div>
  );
}
