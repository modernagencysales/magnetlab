import { FlowEditor } from '@/components/email/FlowEditor';

export default async function FlowEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <FlowEditor flowId={id} />;
}
