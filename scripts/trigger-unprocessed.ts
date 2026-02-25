/**
 * Trigger process-transcript for all unprocessed Attio transcripts.
 * Run from the magnetlab repo root:
 *   npx tsx scripts/trigger-unprocessed.ts
 */
import { tasks } from '@trigger.dev/sdk/v3';
import { createClient } from '@supabase/supabase-js';

const USER_ID = process.env.ATTIO_DEFAULT_USER_ID || '0f634817-6db8-4a54-adfd-6ab143950b8c';

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Find all unprocessed Attio transcripts
  const { data: unprocessed, error } = await supabase
    .from('cp_call_transcripts')
    .select('id, title')
    .eq('user_id', USER_ID)
    .eq('source', 'attio')
    .is('knowledge_extracted_at', null)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Query error:', error.message);
    process.exit(1);
  }

  if (!unprocessed || unprocessed.length === 0) {
    console.log('No unprocessed transcripts found.');
    return;
  }

  console.log(`Found ${unprocessed.length} unprocessed transcripts. Triggering...`);

  for (const t of unprocessed) {
    try {
      const handle = await tasks.trigger('process-transcript', {
        userId: USER_ID,
        transcriptId: t.id,
      });
      console.log(`  ✓ ${t.title} → run ${handle.id}`);
    } catch (err: any) {
      console.error(`  ✗ ${t.title}: ${err.message}`);
    }
  }

  console.log('Done!');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
