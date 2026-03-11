import { PageContainer, PageTitle } from '@magnetlab/magnetui';
import { SettingsNav } from '@/components/settings/SettingsNav';

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <PageContainer maxWidth="xl">
      <div className="space-y-6">
        <PageTitle title="Settings" description="Manage your account and integrations" />
        <div className="flex flex-col gap-8 lg:flex-row">
          <SettingsNav />
          <div className="min-w-0 flex-1">{children}</div>
        </div>
      </div>
    </PageContainer>
  );
}
