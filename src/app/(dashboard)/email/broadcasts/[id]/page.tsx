import { BroadcastEditor } from '@/components/email/BroadcastEditor';

export default async function BroadcastEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <BroadcastEditor broadcastId={id} />;
}
