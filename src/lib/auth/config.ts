// NextAuth.js v5 Configuration for MagnetLab

import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { hashPassword, verifyPassword } from './password';
import {
  jwtCallback,
  sessionCallback,
  validateCredentials,
  formatUserForSession,
  AUTH_CONFIG,
} from './callbacks';

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      name: 'Email',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const validated = validateCredentials(credentials as { email?: unknown; password?: unknown });
        if (!validated) {
          return null;
        }

        const { email, password } = validated;
        const supabase = createSupabaseAdminClient();

        // Check if user exists
        const { data: existingUser } = await supabase
          .from('users')
          .select('id, email, name, avatar_url, password_hash')
          .eq('email', email)
          .single();

        if (existingUser) {
          const isValid = await verifyPassword(password, existingUser.password_hash);
          if (!isValid) {
            return null;
          }
          return formatUserForSession(existingUser);
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

        return formatUserForSession(newUser);
      },
    }),
  ],
  pages: AUTH_CONFIG.pages,
  callbacks: {
    jwt: jwtCallback,
    session: sessionCallback,
  },
  session: AUTH_CONFIG.session,
  trustHost: AUTH_CONFIG.trustHost,
});

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
