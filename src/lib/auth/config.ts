// NextAuth.js v5 Configuration for MagnetLab

import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import { timingSafeEqual } from 'crypto';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import bcrypt from 'bcryptjs';
import {
  checkLoginRateLimit,
  recordFailedLogin,
  clearLoginAttempts,
  cleanupExpiredAttempts,
} from '@/lib/auth/rate-limit';

// Bcrypt configuration - 12 rounds provides good security/performance balance
const BCRYPT_SALT_ROUNDS = 12;

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    Credentials({
      name: 'Email',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        try {
          if (!credentials?.email || !credentials?.password) {
            console.error('[Auth] Missing email or password');
            return null;
          }

          const email = credentials.email as string;
          const password = credentials.password as string;

          // Database-backed rate limit check (persists across cold starts)
          const allowed = await checkLoginRateLimit(email);
          if (!allowed) {
            console.error('[Auth] Rate limit exceeded for:', email);
            // Opportunistically clean up expired entries
            cleanupExpiredAttempts().catch(() => {});
            return null;
          }

          // Verify environment variables
          if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
            console.error('[Auth] Missing Supabase environment variables');
            throw new Error('Server configuration error');
          }

          const supabase = createSupabaseAdminClient();

          // Check if user exists
          const { data: existingUser, error: fetchError } = await supabase
            .from('users')
            .select('id, email, name, avatar_url, password_hash')
            .eq('email', email)
            .single();

          if (fetchError && fetchError.code !== 'PGRST116') {
            // PGRST116 = no rows returned, which is fine for new users
            console.error('[Auth] Database fetch error:', fetchError);
            throw new Error('Database error');
          }

          if (existingUser) {
            // Verify password with backward compatibility for legacy SHA-256 hashes
            const isValid = await verifyPassword(password, existingUser.password_hash);
            if (!isValid) {
              await recordFailedLogin(email);
              console.error('[Auth] Invalid password for user:', email);
              return null;
            }

            // Migrate legacy SHA-256 hash to bcrypt on successful login
            if (isLegacySha256Hash(existingUser.password_hash)) {
              const newHash = await hashPassword(password);
              await supabase
                .from('users')
                .update({ password_hash: newHash })
                .eq('id', existingUser.id);
              console.log('[Auth] Migrated password hash for user:', email);
            }

            await clearLoginAttempts(email);

            // Auto-link pending team invitations
            await supabase
              .from('team_members')
              .update({ member_id: existingUser.id, status: 'active', accepted_at: new Date().toISOString() })
              .eq('email', email)
              .eq('status', 'pending')
              .is('member_id', null);

            console.log('[Auth] Login successful for:', email);
            return {
              id: existingUser.id,
              email: existingUser.email,
              name: existingUser.name,
              image: existingUser.avatar_url,
            };
          }

          // Auto-create new user on first login
          console.log('[Auth] Creating new user:', email);
          const passwordHash = await hashPassword(password);
          const { data: newUser, error } = await supabase
            .from('users')
            .insert({
              email,
              password_hash: passwordHash,
            })
            .select('id, email, name')
            .single();

          if (error || !newUser) {
            console.error('[Auth] Failed to create user:', error);
            throw new Error('Failed to create account');
          }

          // Create free subscription
          const { error: subError } = await supabase.from('subscriptions').insert({
            user_id: newUser.id,
            plan: 'free',
            status: 'active',
          });

          if (subError) {
            console.error('[Auth] Failed to create subscription:', subError);
            // Don't fail login for this, just log it
          }

          // Auto-link pending team invitations
          await supabase
            .from('team_members')
            .update({ member_id: newUser.id, status: 'active', accepted_at: new Date().toISOString() })
            .eq('email', email)
            .eq('status', 'pending')
            .is('member_id', null);

          console.log('[Auth] New user created:', email);
          return {
            id: newUser.id,
            email: newUser.email,
            name: newUser.name,
          };
        } catch (error) {
          console.error('[Auth] Authorize error:', error);
          throw error; // Re-throw to show error to user
        }
      },
    }),
  ],
  pages: {
    signIn: '/login',
    error: '/login',
  },
  callbacks: {
    /**
     * signIn callback: handle Google OAuth account linking.
     * If a user with the same email already exists (from credentials signup),
     * we allow the sign-in and link to the existing user in the jwt callback.
     * If no user exists, we auto-create one (same as credentials flow).
     */
    async signIn({ user, account }) {
      if (account?.provider === 'google' && user.email) {
        try {
          const supabase = createSupabaseAdminClient();

          const { data: existingUser, error: fetchError } = await supabase
            .from('users')
            .select('id, email, name, avatar_url')
            .eq('email', user.email)
            .single();

          if (fetchError && fetchError.code !== 'PGRST116') {
            console.error('[Auth/Google] Database fetch error:', fetchError);
            return false;
          }

          if (existingUser) {
            // Link: update profile info from Google if missing
            const updates: Record<string, string> = {};
            if (!existingUser.name && user.name) updates.name = user.name;
            if (!existingUser.avatar_url && user.image) updates.avatar_url = user.image;

            if (Object.keys(updates).length > 0) {
              await supabase
                .from('users')
                .update(updates)
                .eq('id', existingUser.id);
            }

            // Store the DB user ID so jwt callback can use it
            user.id = existingUser.id;
            console.log('[Auth/Google] Linked to existing user:', user.email);

            // Auto-link pending team invitations
            await supabase
              .from('team_members')
              .update({ member_id: existingUser.id, status: 'active', accepted_at: new Date().toISOString() })
              .eq('email', user.email)
              .eq('status', 'pending')
              .is('member_id', null);
          } else {
            // Auto-create new user (no password_hash for OAuth-only users)
            const { data: newUser, error } = await supabase
              .from('users')
              .insert({
                email: user.email,
                name: user.name || null,
                avatar_url: user.image || null,
              })
              .select('id')
              .single();

            if (error || !newUser) {
              console.error('[Auth/Google] Failed to create user:', error);
              return false;
            }

            // Create free subscription
            await supabase.from('subscriptions').insert({
              user_id: newUser.id,
              plan: 'free',
              status: 'active',
            });

            user.id = newUser.id;
            console.log('[Auth/Google] Created new user:', user.email);

            // Auto-link pending team invitations
            await supabase
              .from('team_members')
              .update({ member_id: newUser.id, status: 'active', accepted_at: new Date().toISOString() })
              .eq('email', user.email)
              .eq('status', 'pending')
              .is('member_id', null);
          }
        } catch (error) {
          console.error('[Auth/Google] signIn callback error:', error);
          return false;
        }
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.userId) {
        session.user.id = token.userId as string;
      }
      return session;
    },
  },
  session: {
    strategy: 'jwt',
  },
  trustHost: true,
  debug: process.env.NODE_ENV === 'development',
});

/**
 * Detect if a hash is a legacy SHA-256 hash (64 hex characters)
 * vs a bcrypt hash (starts with $2a$, $2b$, or $2y$)
 */
function isLegacySha256Hash(hash: string | null): boolean {
  if (!hash) return false;
  // SHA-256 hashes are 64 hex characters and don't start with $2
  return hash.length === 64 && /^[a-f0-9]+$/i.test(hash);
}

/**
 * Hash a password using bcrypt with configured salt rounds
 */
async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
}

/**
 * Verify a password against a stored hash
 * Supports both bcrypt and legacy SHA-256 hashes for backward compatibility
 */
async function verifyPassword(password: string, hash: string | null): Promise<boolean> {
  if (!hash) return false;

  // Check if this is a legacy SHA-256 hash
  if (isLegacySha256Hash(hash)) {
    const legacyHash = await hashPasswordLegacy(password);
    const hashBuf = Buffer.from(legacyHash, 'hex');
    const storedBuf = Buffer.from(hash, 'hex');
    return hashBuf.length === storedBuf.length && timingSafeEqual(hashBuf, storedBuf);
  }

  // Use bcrypt for modern hashes
  return bcrypt.compare(password, hash);
}

/**
 * Legacy SHA-256 password hashing (for backward compatibility only)
 * DO NOT use for new passwords - use hashPassword() instead
 */
async function hashPasswordLegacy(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + process.env.AUTH_SECRET);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Extend session type
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}
