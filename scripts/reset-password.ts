/**
 * Reset user password by email
 *
 * Updates the password_hash in the users table for the given email.
 * Uses bcrypt (12 rounds) to match the auth config.
 *
 * Usage:
 *   pnpm exec tsx scripts/reset-password.ts <email> <new_password>
 *
 * Example:
 *   pnpm exec tsx scripts/reset-password.ts user@example.com MyNewPassword123
 *
 * Loads .env.local and .env from project root automatically.
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

// Load .env then .env.local (Next.js convention; .env.local overrides)
function loadEnv(): void {
  const root = resolve(process.cwd());
  for (const file of ['.env', '.env.local']) {
    const path = resolve(root, file);
    if (existsSync(path)) {
      const content = readFileSync(path, 'utf8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const eq = trimmed.indexOf('=');
          if (eq > 0) {
            const key = trimmed.slice(0, eq).trim();
            let val = trimmed.slice(eq + 1).trim();
            if (
              (val.startsWith('"') && val.endsWith('"')) ||
              (val.startsWith("'") && val.endsWith("'"))
            ) {
              val = val.slice(1, -1);
            }
            process.env[key] = val;
          }
        }
      }
    }
  }
}
loadEnv();

const BCRYPT_SALT_ROUNDS = 12;

async function main() {
  const email = process.argv[2];
  const newPassword = process.argv[3];

  if (!email || !newPassword) {
    console.error('Usage: pnpm exec tsx scripts/reset-password.ts <email> <new_password>');
    process.exit(1);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
    console.error('Ensure .env.local or .env exists in the project root.');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: user, error: fetchError } = await supabase
    .from('users')
    .select('id, email')
    .eq('email', email)
    .single();

  if (fetchError || !user) {
    console.error(`User not found: ${email}`);
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);

  const { error: updateError } = await supabase
    .from('users')
    .update({ password_hash: passwordHash })
    .eq('id', user.id);

  if (updateError) {
    console.error('Failed to update password:', updateError.message);
    process.exit(1);
  }

  console.log(`Password reset successfully for ${email}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
