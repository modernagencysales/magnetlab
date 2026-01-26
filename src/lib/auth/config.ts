// NextAuth.js v5 Configuration for MagnetLab

import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import bcrypt from 'bcrypt';

// Bcrypt configuration - 12 rounds provides good security/performance balance
const BCRYPT_SALT_ROUNDS = 12;

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      name: 'Email',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = credentials.email as string;
        const password = credentials.password as string;

        const supabase = createSupabaseAdminClient();

        // Check if user exists
        const { data: existingUser } = await supabase
          .from('users')
          .select('id, email, name, avatar_url, password_hash')
          .eq('email', email)
          .single();

        if (existingUser) {
          // Verify password with backward compatibility for legacy SHA-256 hashes
          const isValid = await verifyPassword(password, existingUser.password_hash);
          if (!isValid) {
            return null;
          }

          // Migrate legacy SHA-256 hash to bcrypt on successful login
          if (isLegacySha256Hash(existingUser.password_hash)) {
            const newHash = await hashPassword(password);
            await supabase
              .from('users')
              .update({ password_hash: newHash })
              .eq('id', existingUser.id);
          }

          return {
            id: existingUser.id,
            email: existingUser.email,
            name: existingUser.name,
            image: existingUser.avatar_url,
          };
        }

        // Auto-create new user on first login
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
          console.error('Failed to create user:', error);
          return null;
        }

        // Create free subscription
        await supabase.from('subscriptions').insert({
          user_id: newUser.id,
          plan: 'free',
          status: 'active',
        });

        return {
          id: newUser.id,
          email: newUser.email,
          name: newUser.name,
        };
      },
    }),
  ],
  pages: {
    signIn: '/login',
    error: '/login',
  },
  callbacks: {
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
    return legacyHash === hash;
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
