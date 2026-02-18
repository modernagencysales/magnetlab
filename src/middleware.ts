import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { lookupCustomDomain } from '@/lib/utils/domain-lookup';

// Known app hostnames (not custom domains)
const APP_HOSTNAMES = new Set([
  'magnetlab.app',
  'www.magnetlab.app',
  'localhost',
  'localhost:3000',
]);

function isAppHostname(hostname: string): boolean {
  if (APP_HOSTNAMES.has(hostname)) return true;
  // Vercel preview deploys
  if (hostname.endsWith('.vercel.app')) return true;
  return false;
}

// Routes that require authentication
const protectedRoutes = [
  '/create', '/magnets', '/pages', '/knowledge', '/posts',
  '/leads', '/settings', '/automations',
  // Legacy routes (redirects handled in route files)
  '/library', '/content', '/assets', '/analytics',
  '/swipe-file', '/docs',
  '/catalog', '/team-select', '/team',
];

// Routes that should redirect to dashboard if authenticated
const authRoutes = ['/login'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hostname = request.headers.get('host')?.replace(/:\d+$/, '') || '';

  // --- Custom domain routing ---
  if (!isAppHostname(hostname)) {
    const domainInfo = await lookupCustomDomain(hostname);
    if (!domainInfo) {
      return new NextResponse('Not Found', { status: 404 });
    }

    // Rewrite: clientdomain.com/my-funnel → /p/username/my-funnel
    const slug = pathname.replace(/^\//, ''); // strip leading slash
    if (!slug) {
      // Root path — no landing page for now
      return new NextResponse('Not Found', { status: 404 });
    }

    const url = request.nextUrl.clone();
    url.pathname = `/p/${domainInfo.username}/${slug}`;

    return NextResponse.rewrite(url);
  }

  // --- Normal app routing ---
  const sessionToken =
    request.cookies.get('authjs.session-token')?.value ||
    request.cookies.get('__Secure-authjs.session-token')?.value;

  const isAuthenticated = !!sessionToken;

  // Redirect authenticated users away from auth routes
  if (isAuthenticated && authRoutes.some((route) => pathname.startsWith(route))) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Root path: unauthenticated users go to marketing page
  if (!isAuthenticated && pathname === '/') {
    return NextResponse.redirect(new URL('/home', request.url));
  }

  // Redirect unauthenticated users to login for protected routes
  if (!isAuthenticated && protectedRoutes.some((route) => pathname.startsWith(route))) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\..*|public).*)',
  ],
};
