import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Settings | MagnetLab',
  description: 'Manage your account and integrations',
};

export default function SettingsPage() {
  redirect('/settings/account');
}
