import { PageContainer, PageTitle } from '@magnetlab/magnetui';
import { SettingsNav } from '@/components/settings/SettingsNav';

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <PageContainer maxWidth="xl">
      <PageTitle title="Settings" description="Manage your account and integrations" />
      <div className="flex gap-8">
        <SettingsNav />
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </PageContainer>
  );
}
