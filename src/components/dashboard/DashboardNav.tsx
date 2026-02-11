'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import posthog from 'posthog-js';
import {
  Magnet, BarChart3, Settings, Plus, LogOut, FileText, Globe, Users,
  ChevronDown, BookOpen, PenTool, LayoutDashboard, Menu, X, Sun, Moon,
  ArrowLeftRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface User {
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

interface TeamContext {
  isTeamMember: boolean;
  activeOwnerId: string | null;
  ownerName: string | null;
}

interface DashboardNavProps {
  user: User;
  teamContext?: TeamContext | null;
  hasMemberships?: boolean;
}

// ─── Nav config ──────────────────────────────────────────

const mainNav = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/content', label: 'Content', icon: PenTool },
  { href: '/leads', label: 'Leads', icon: Users },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/assets', label: 'Assets', icon: Globe },
  { href: '/swipe-file', label: 'Swipe File', icon: FileText },
];

const teamMemberNav = [
  { href: '/catalog', label: 'Catalog', icon: Magnet },
];

const bottomNav = [
  { href: '/docs', label: 'API Docs', icon: BookOpen },
  { href: '/settings', label: 'Settings', icon: Settings },
];

// ─── Theme toggle (inline, matching bootcamp style) ──────

function InlineThemeToggle() {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      return document.documentElement.classList.contains('dark');
    }
    return true;
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  return (
    <button
      onClick={() => setIsDark(!isDark)}
      className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 dark:text-zinc-500 transition-colors"
      title="Toggle theme"
    >
      {isDark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}

// ─── Create dropdown ─────────────────────────────────────

function CreateDropdown({ onNavigate }: { onNavigate?: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

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
          'flex w-full items-center gap-2.5 rounded-lg p-2 text-xs font-medium transition-all',
          isActive
            ? 'bg-violet-500 text-white'
            : 'bg-violet-500/10 text-violet-600 dark:text-violet-400 hover:bg-violet-500/20'
        )}
      >
        <Plus size={14} className="shrink-0" />
        <span className="flex-1 text-left">Create New</span>
        <ChevronDown size={12} className={cn('transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-1 shadow-lg">
          <Link
            href="/create"
            onClick={() => { setOpen(false); onNavigate?.(); }}
            className="flex items-center gap-2.5 rounded-md px-3 py-2 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <Magnet size={14} className="text-violet-500" />
            Lead Magnet
          </Link>
          <Link
            href="/create/page-quick"
            onClick={() => { setOpen(false); onNavigate?.(); }}
            className="flex items-center gap-2.5 rounded-md px-3 py-2 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <Globe size={14} className="text-emerald-500" />
            Landing Page
          </Link>
        </div>
      )}
    </div>
  );
}

// ─── Nav link ────────────────────────────────────────────

function NavLink({ href, label, icon: Icon, onNavigate }: {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const isActive = href === '/'
    ? pathname === '/'
    : pathname === href || pathname.startsWith(href + '/');

  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        'flex items-center gap-2.5 w-full p-2 rounded-lg text-xs font-medium transition-all',
        isActive
          ? 'bg-violet-500/10 text-violet-600 dark:text-violet-400'
          : 'text-zinc-700 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
      )}
    >
      <Icon
        size={14}
        className={cn('shrink-0', isActive ? 'text-violet-500' : 'text-zinc-400 dark:text-zinc-600')}
      />
      <span>{label}</span>
    </Link>
  );
}

// ─── Sidebar content (shared between desktop + mobile) ──

function SidebarContent({ user, teamContext, hasMemberships, onNavigate }: {
  user: User;
  teamContext?: TeamContext | null;
  hasMemberships?: boolean;
  onNavigate?: () => void;
}) {
  const displayLabel = user.name || user.email?.split('@')[0] || 'User';
  const isTeamMode = teamContext?.isTeamMember && teamContext.activeOwnerId;

  // In team mode, show only catalog nav. In normal mode, show full nav + catalog link.
  const navItems = isTeamMode ? teamMemberNav : mainNav;
  const extraNavItems = !isTeamMode
    ? [{ href: '/catalog', label: 'Catalog', icon: Magnet }]
    : [];

  return (
    <div className="flex h-full flex-col">
      {/* ── Header ── */}
      <div className="p-5 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
        <Link
          href="/"
          onClick={onNavigate}
          className="flex items-center gap-2.5 text-zinc-900 dark:text-zinc-100 mb-4"
        >
          <div className="w-8 h-8 bg-violet-500 rounded-lg flex items-center justify-center text-white shrink-0">
            <Magnet size={16} />
          </div>
          <h1 className="font-semibold text-sm">MagnetLab</h1>
        </Link>

        {!isTeamMode && <CreateDropdown onNavigate={onNavigate} />}

        {/* Team mode banner */}
        {isTeamMode && (
          <div className="rounded-lg bg-violet-500/10 border border-violet-500/20 p-2.5 mt-2">
            <p className="text-xs font-medium text-violet-600 dark:text-violet-400 truncate">
              Viewing {teamContext.ownerName}&apos;s catalog
            </p>
            <Link
              href="/team-select"
              onClick={onNavigate}
              className="flex items-center gap-1 text-xs text-violet-500 hover:text-violet-600 mt-1 transition-colors"
            >
              <ArrowLeftRight size={12} />
              Switch account
            </Link>
          </div>
        )}
      </div>

      {/* ── Main nav (scrollable) ── */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1 scrollbar-hide">
        {navItems.map((item) => (
          <NavLink key={item.href} {...item} onNavigate={onNavigate} />
        ))}

        {extraNavItems.length > 0 && (
          <>
            {!isTeamMode && <div className="h-px bg-zinc-200 dark:bg-zinc-800 my-3" />}
            {extraNavItems.map((item) => (
              <NavLink key={item.href} {...item} onNavigate={onNavigate} />
            ))}
          </>
        )}

        <div className="h-px bg-zinc-200 dark:bg-zinc-800 my-3" />

        {bottomNav.map((item) => (
          <NavLink key={item.href} {...item} onNavigate={onNavigate} />
        ))}
      </div>

      {/* ── Footer ── */}
      <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 truncate">
          {user.image ? (
            <Image
              src={user.image}
              alt={displayLabel}
              width={32}
              height={32}
              className="w-8 h-8 rounded-lg shrink-0"
            />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-violet-500 flex items-center justify-center text-white font-medium text-xs shrink-0">
              {displayLabel.substring(0, 2).toUpperCase()}
            </div>
          )}
          <div className="truncate">
            <p className="text-sm text-zinc-900 dark:text-white truncate font-medium">
              {displayLabel}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <InlineThemeToggle />
          <button
            type="button"
            onClick={() => {
              try { posthog.reset(); } catch {}
              signOut({ callbackUrl: '/login' });
            }}
            className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-zinc-400 dark:text-zinc-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
            title="Sign out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────

export function DashboardNav({ user, teamContext, hasMemberships }: DashboardNavProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  // Close mobile nav on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <>
      {/* ── Mobile top bar ── */}
      <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 lg:hidden">
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 rounded-lg text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          <Menu size={20} />
        </button>
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 bg-violet-500 rounded-lg flex items-center justify-center text-white">
            <Magnet size={14} />
          </div>
          <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">MagnetLab</span>
        </Link>
        <InlineThemeToggle />
      </header>

      {/* ── Mobile overlay ── */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/50 dark:bg-black/70 z-30 lg:hidden backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="fixed inset-y-0 left-0 z-40 w-64 bg-zinc-50 dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 flex flex-col lg:hidden">
            <div className="flex h-14 items-center justify-end px-3 border-b border-zinc-200 dark:border-zinc-800">
              <button
                onClick={() => setMobileOpen(false)}
                className="p-2 rounded-lg text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <SidebarContent
              user={user}
              teamContext={teamContext}
              hasMemberships={hasMemberships}
              onNavigate={() => setMobileOpen(false)}
            />
          </aside>
        </>
      )}

      {/* ── Desktop sidebar ── */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 bg-zinc-50 dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 flex-col lg:flex">
        <SidebarContent user={user} teamContext={teamContext} hasMemberships={hasMemberships} />
      </aside>
    </>
  );
}
