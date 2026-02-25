/**
 * Rebuild all stub lead magnets with full AI-generated content.
 * Stubs are lead magnets with polished_content < 3000 chars.
 *
 * Run from the magnetlab repo root:
 *   npx tsx scripts/rebuild-stub-content.ts
 *
 * To rebuild a single lead magnet:
 *   npx tsx scripts/rebuild-stub-content.ts <lead-magnet-id>
 */
import { tasks } from '@trigger.dev/sdk/v3';
import { createClient } from '@supabase/supabase-js';

const USER_ID = process.env.ATTIO_DEFAULT_USER_ID || '0f634817-6db8-4a54-adfd-6ab143950b8c';
const STUB_THRESHOLD = 3000; // chars — anything below this is a stub

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const singleId = process.argv[2];

  let stubs: Array<{ id: string; title: string; polished_len: number }>;

  if (singleId) {
    // Rebuild a single lead magnet
    const { data, error } = await supabase
      .from('lead_magnets')
      .select('id, title')
      .eq('id', singleId)
      .single();

    if (error || !data) {
      console.error(`Lead magnet not found: ${singleId}`);
      process.exit(1);
    }

    stubs = [{ id: data.id, title: data.title, polished_len: 0 }];
  } else {
    // Find all stubs
    const { data, error } = await supabase
      .from('lead_magnets')
      .select('id, title, polished_content')
      .eq('user_id', USER_ID)
      .not('concept', 'is', null)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Query error:', error.message);
      process.exit(1);
    }

    stubs = (data || [])
      .map((lm) => ({
        id: lm.id,
        title: lm.title,
        polished_len: lm.polished_content ? JSON.stringify(lm.polished_content).length : 0,
      }))
      .filter((lm) => lm.polished_len < STUB_THRESHOLD);
  }

  if (stubs.length === 0) {
    console.log('No stub lead magnets found.');
    return;
  }

  console.log(`Found ${stubs.length} stub lead magnets to rebuild:\n`);
  for (const s of stubs) {
    console.log(`  ${s.title} (${s.polished_len} chars)`);
  }
  console.log('');

  for (const s of stubs) {
    try {
      const handle = await tasks.trigger('rebuild-lead-magnet-content', {
        leadMagnetId: s.id,
        userId: USER_ID,
      });
      console.log(`  ✓ Triggered: ${s.title} → run ${handle.id}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'unknown error';
      console.error(`  ✗ Failed: ${s.title}: ${msg}`);
    }
  }

  console.log('\nAll tasks triggered! Check Trigger.dev dashboard for progress.');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
