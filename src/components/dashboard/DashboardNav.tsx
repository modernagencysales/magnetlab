'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Magnet, Library, BarChart3, Settings, Plus, LogOut, FileText, Globe, Users, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface User {
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

interface DashboardNavProps {
  user: User;
}

const navItems = [
  { href: '/library', label: 'Library', icon: Library },
  { href: '/pages', label: 'Pages', icon: Globe },
  { href: '/leads', label: 'Leads', icon: Users },
  { href: '/swipe-file', label: 'Swipe File', icon: FileText },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/settings', label: 'Settings', icon: Settings },
];

function CreateDropdown({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isActive = pathname === '/create' || pathname.startsWith('/create/');

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
          isActive
            ? 'bg-primary/10 text-primary'
            : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
        )}
      >
        <Plus className="h-4 w-4" />
        Create
        <ChevronDown className={cn('h-3 w-3 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 w-48 rounded-lg border bg-card p-1 shadow-lg">
          <Link
            href="/create"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-secondary"
          >
            <Magnet className="h-4 w-4" />
            Lead Magnet
          </Link>
          <Link
            href="/create/page-quick"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-secondary"
          >
            <Globe className="h-4 w-4" />
            Landing Page
          </Link>
        </div>
      )}
    </div>
  );
}

export function DashboardNav({ user }: DashboardNavProps) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        <div className="flex items-center gap-8">
          <Link href="/library" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Magnet className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-semibold">MagnetLab</span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            <CreateDropdown pathname={pathname} />
            {navItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            {user.image ? (
              <img
                src={user.image}
                alt={user.name || 'User'}
                className="h-8 w-8 rounded-full"
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">
                {user.name?.[0] || user.email?.[0] || 'U'}
              </div>
            )}
            <div className="hidden text-sm md:block">
              <div className="font-medium">{user.name}</div>
            </div>
          </div>
          <form action="/api/auth/signout" method="POST">
            <button
              type="submit"
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
