import { AutomationList } from '@/components/automations/AutomationList';

export const metadata = {
  title: 'Automations | MagnetLab',
  description: 'Manage your LinkedIn comment-to-DM automations',
};

export default function AutomationsPage() {
  return <AutomationList />;
}
