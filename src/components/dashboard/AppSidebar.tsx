'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { useTheme } from 'next-themes';
import posthog from 'posthog-js';
import {
  Magnet,
  Settings,
  Plus,
  LogOut,
  Globe,
  Users,
  UsersRound,
  PenTool,
  Sun,
  Moon,
  ArrowLeftRight,
  Home,
  Brain,

  BookOpen,
  Mail,
  HelpCircle,
  Shield,
  Radio,
  ListChecks,
  Megaphone,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarSeparator,
  SidebarRail,
  useSidebar,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  Avatar,
  AvatarImage,
  AvatarFallback,
  Button,
} from '@magnetlab/magnetui';
import { cn } from '@/lib/utils';

// ─── Types ─────────────────────────────────────────────

interface User {
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

interface TeamContext {
  isTeamMode: boolean;
  teamId: string;
  teamName: string;
  isOwner: boolean;
  via: 'direct' | 'team_link';
  agencyTeamName?: string;
}

interface AppSidebarProps {
  user: User;
  teamContext?: TeamContext | null;
  isSuperAdmin?: boolean;
}

// ─── Nav config ────────────────────────────────────────

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  activePrefix?: string;
  activePrefixes?: string[];
}

const mainNav: NavItem[] = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/magnets', label: 'Lead Magnets', icon: Magnet },
  { href: '/pages', label: 'Pages', icon: Globe },
  { href: '/knowledge', label: 'Knowledge', icon: Brain },
  { href: '/posts', label: 'Posts', icon: PenTool },
  { href: '/content-queue', label: 'Content Queue', icon: ListChecks },
  { href: '/inspo', label: 'Inspo', icon: Sparkles },
  { href: '/campaigns', label: 'Campaigns', icon: Megaphone, activePrefixes: ['/campaigns', '/post-campaigns'] },
  { href: '/leads', label: 'Leads', icon: Users },
  { href: '/signals', label: 'Signals', icon: Radio },
  { href: '/email/flows', label: 'Email', icon: Mail, activePrefix: '/email' },
  { href: '/team', label: 'Team', icon: UsersRound },
];

const bottomNav: NavItem[] = [
  { href: '/docs', label: 'Docs', icon: BookOpen },
  { href: '/help', label: 'Help', icon: HelpCircle },
  { href: '/settings', label: 'Settings', icon: Settings },
];

// ─── Helpers ───────────────────────────────────────────

function isRouteActive(pathname: string, href: string, activePrefix?: string, activePrefixes?: string[]) {
  if (activePrefixes) {
    return activePrefixes.some(prefix => pathname === prefix || pathname.startsWith(prefix + '/'));
  }
  const matchPath = activePrefix || href;
  return href === '/'
    ? pathname === '/'
    : pathname === matchPath || pathname.startsWith(matchPath + '/');
}

function getTourId(href: string) {
  return href === '/' ? 'home' : href.slice(1);
}

// ─── Create dropdown ───────────────────────────────────

function CreateNewDropdown() {
  const pathname = usePathname();
  const { setOpenMobile, isMobile } = useSidebar();
  const isActive = pathname === '/create' || pathname.startsWith('/create/');

  const handleNavigate = () => {
    if (isMobile) setOpenMobile(false);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton
          size="default"
          className={cn(
            'font-medium',
            isActive
              ? 'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground'
              : 'bg-primary/10 text-primary hover:bg-primary/20'
          )}
          tooltip="Create New"
        >
          <Plus className="size-4" />
          <span>Create New</span>
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="start" className="w-48">
        <DropdownMenuItem asChild>
          <Link href="/create" onClick={handleNavigate}>
            <Magnet className="size-4 text-primary" />
            Lead Magnet
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/pages/new" onClick={handleNavigate}>
            <Globe className="size-4 text-emerald-500" />
            Landing Page
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/posts?quick_write=1" onClick={handleNavigate}>
            <PenTool className="size-4 text-blue-500" />
            Post
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/assets/libraries/new" onClick={handleNavigate}>
            <span className="text-sm">📚</span>
            Library
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/assets/external/new" onClick={handleNavigate}>
            <span className="text-sm">🔗</span>
            External Resource
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── Theme toggle ──────────────────────────────────────

function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      title="Toggle theme"
      aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
    >
      {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  );
}

// ─── Main component ────────────────────────────────────

export function AppSidebar({ user, teamContext, isSuperAdmin }: AppSidebarProps) {
  const pathname = usePathname();
  const { setOpenMobile, isMobile } = useSidebar();

  const displayLabel = user.name || user.email?.split('@')[0] || 'User';
  const initials = displayLabel.substring(0, 2).toUpperCase();

  const handleNavigate = () => {
    if (isMobile) setOpenMobile(false);
  };

  return (
    <Sidebar collapsible="icon">
      {/* ── Header ── */}
      <SidebarHeader className="border-b border-sidebar-border">
        {/* Logo */}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild tooltip="MagnetLab">
              <Link href="/" onClick={handleNavigate}>
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Magnet className="size-4" />
                </div>
                <span className="text-sm font-semibold">MagnetLab</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>

          {/* Create New */}
          <SidebarMenuItem>
            <CreateNewDropdown />
          </SidebarMenuItem>
        </SidebarMenu>

        {/* Team mode banner */}
        {teamContext?.isTeamMode && (
          <div className="rounded-lg border border-primary/20 bg-primary/10 p-2.5 group-data-[collapsible=icon]:hidden">
            <p className="truncate text-xs font-medium text-primary">
              Working in: {teamContext.teamName}
            </p>
            {teamContext.via === 'team_link' && (
              <p className="mt-0.5 truncate text-[10px] text-primary/60">
                {teamContext.agencyTeamName
                  ? `via ${teamContext.agencyTeamName}`
                  : 'via linked agency'}
              </p>
            )}
            <Link
              href="/team-select"
              onClick={handleNavigate}
              className="mt-1 flex items-center gap-1 text-xs text-primary/70 transition-colors hover:text-primary"
            >
              <ArrowLeftRight className="size-3" />
              Switch team
            </Link>
          </div>
        )}
      </SidebarHeader>

      {/* ── Main nav ── */}
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Platform</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNav.map((item) => {
                const active = isRouteActive(pathname, item.href, item.activePrefix, item.activePrefixes);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={item.label}
                      data-tour={getTourId(item.href)}
                    >
                      <Link href={item.href} onClick={handleNavigate}>
                        <item.icon className="size-4" />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupLabel>Support</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {bottomNav.map((item) => {
                const active = isRouteActive(pathname, item.href, item.activePrefix, item.activePrefixes);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={item.label}
                      data-tour={getTourId(item.href)}
                    >
                      <Link href={item.href} onClick={handleNavigate}>
                        <item.icon className="size-4" />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}

              {/* Admin (super-admin only) */}
              {isSuperAdmin && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={isRouteActive(pathname, '/admin')}
                    tooltip="Admin"
                    data-tour="admin"
                  >
                    <Link href="/admin" onClick={handleNavigate}>
                      <Shield className="size-4" />
                      <span>Admin</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* ── Footer ── */}
      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center gap-3 px-2 py-1.5 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
              <Avatar size="sm">
                {user.image && <AvatarImage src={user.image} alt={displayLabel} />}
                <AvatarFallback name={displayLabel}>{initials}</AvatarFallback>
              </Avatar>

              <div className="flex min-w-0 flex-1 items-center justify-between gap-2 group-data-[collapsible=icon]:hidden">
                <span className="truncate text-sm font-medium text-sidebar-foreground">
                  {displayLabel}
                </span>
                <div className="flex items-center gap-0.5">
                  <ThemeToggle />
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => {
                      try {
                        posthog.reset();
                      } catch {}
                      signOut({ callbackUrl: '/login' });
                    }}
                    className="text-sidebar-foreground/70 hover:bg-destructive/10 hover:text-destructive"
                    title="Sign out"
                    aria-label="Sign out"
                  >
                    <LogOut className="size-4" />
                  </Button>
                </div>
              </div>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
