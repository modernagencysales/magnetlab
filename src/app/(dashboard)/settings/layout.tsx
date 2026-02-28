import { SettingsNav } from '@/components/settings/SettingsNav';

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage your account and integrations</p>
      </div>

      <div className="flex gap-8">
        <SettingsNav />
        <div className="flex-1 min-w-0">
          {children}
        </div>
      </div>
    </div>
  );
}
