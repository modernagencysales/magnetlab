import { SectionContainer } from '@magnetlab/magnetui';
import { SubscriberTable } from '@/components/email/SubscriberTable';

export const metadata = {
  title: 'Email Subscribers | MagnetLab',
  description: 'Manage your email subscriber list',
};

export default function EmailSubscribersPage() {
  return (
    <SectionContainer
      title="Subscribers"
      description="Manage your subscriber list, add contacts manually, or import via CSV."
    >
      <SubscriberTable />
    </SectionContainer>
  );
}
