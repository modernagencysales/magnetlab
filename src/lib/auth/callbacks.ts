// Auth callback functions - extracted for testability
import type { JWT } from 'next-auth/jwt';
import type { Session, User } from 'next-auth';

/**
 * JWT callback - adds userId to token when user logs in
 */
export async function jwtCallback({
  token,
  user,
}: {
  token: JWT;
  user?: User | null;
}): Promise<JWT> {
  if (user) {
    token.userId = user.id;
  }
  return token;
}

/**
 * Session callback - adds userId from token to session
 */
export async function sessionCallback({
  session,
  token,
}: {
  session: Session;
  token: JWT;
}): Promise<Session> {
  if (token.userId) {
    session.user.id = token.userId as string;
  }
  return session;
}

/**
 * Validates credentials format before authentication
 */
export function validateCredentials(credentials: {
  email?: unknown;
  password?: unknown;
}): { email: string; password: string } | null {
  if (!credentials?.email || !credentials?.password) {
    return null;
  }

  if (typeof credentials.email !== 'string' || typeof credentials.password !== 'string') {
    return null;
  }

  const email = credentials.email.trim();
  const password = credentials.password;

  if (!email || !password) {
    return null;
  }

  // Basic email format validation
  if (!email.includes('@') || email.length < 5) {
    return null;
  }

  return { email, password };
}

/**
 * Formats user data for session from database user
 */
export function formatUserForSession(user: {
  id: string;
  email: string;
  name?: string | null;
  avatar_url?: string | null;
}): { id: string; email: string; name?: string | null; image?: string | null } {
  return {
    id: user.id,
    email: user.email,
    name: user.name || null,
    image: user.avatar_url || null,
  };
}

/**
 * Auth configuration constants
 */
export const AUTH_CONFIG = {
  pages: {
    signIn: '/login',
    error: '/login',
  },
  session: {
    strategy: 'jwt' as const,
  },
  trustHost: true,
} as const;
