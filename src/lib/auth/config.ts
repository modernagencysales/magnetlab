// NextAuth.js v5 Configuration for MagnetLab

import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcrypt';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

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
          // Verify password using bcrypt
          const isValid = await verifyPassword(password, existingUser.password_hash);
          if (!isValid) {
            return null;
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

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
}

async function verifyPassword(password: string, hash: string | null): Promise<boolean> {
  if (!hash) return false;
  return bcrypt.compare(password, hash);
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
