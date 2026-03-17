'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

interface BackLinkProps {
  href?: string;
  children?: React.ReactNode;
}

export function BackLink({
  href = '/pages',
  children = 'Back to Pages',
}: BackLinkProps): JSX.Element {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft size={16} className="mr-1" />
      {children}
    </Link>
  );
}
