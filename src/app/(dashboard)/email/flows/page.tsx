import { SectionContainer } from '@magnetlab/magnetui';
import { FlowList } from '@/components/email/FlowList';

export const metadata = {
  title: 'Email Flows | MagnetLab',
  description: 'Create and manage automated email flows',
};

export default function EmailFlowsPage() {
  return (
    <SectionContainer
      title="Flows"
      description="Automated email sequences triggered by events like lead magnet opt-ins."
    >
      <FlowList />
    </SectionContainer>
  );
}
