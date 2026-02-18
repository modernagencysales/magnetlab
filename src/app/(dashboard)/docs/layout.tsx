import { DocsSidebar } from '@/components/docs/DocsSidebar';

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
      <DocsSidebar />
      <div className="flex-1 overflow-y-auto">
        <div className="container max-w-4xl px-6 py-8 lg:px-8">
          {children}
        </div>
      </div>
    </div>
  );
}
