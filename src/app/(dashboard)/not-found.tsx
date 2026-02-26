import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function DashboardNotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
      <h1 className="mb-2 text-4xl font-bold text-foreground">404</h1>
      <p className="mb-6 text-muted-foreground">
        This page could not be found.
      </p>
      <Link
        href="/"
        className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </Link>
    </div>
  );
}
