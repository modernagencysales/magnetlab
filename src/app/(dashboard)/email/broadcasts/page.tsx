import { SectionContainer } from '@magnetlab/magnetui';
import { BroadcastList } from '@/components/email/BroadcastList';

export const metadata = {
  title: 'Email Broadcasts | MagnetLab',
  description: 'Send one-time emails to your subscribers',
};

export default function EmailBroadcastsPage() {
  return (
    <SectionContainer
      title="Broadcasts"
      description="Send one-time emails to all or a filtered segment of your subscribers."
    >
      <BroadcastList />
    </SectionContainer>
  );
}
