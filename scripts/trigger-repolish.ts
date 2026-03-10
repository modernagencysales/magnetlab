/**
 * One-off script to trigger rebuild for the 4 MOD-262 lead magnets.
 * Run: npx tsx scripts/trigger-repolish.ts
 */
import * as fs from 'fs';
import * as path from 'path';

// Load .env.local manually
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
for (const line of envContent.split('\n')) {
  if (line.startsWith('#') || !line.trim()) continue;
  const eq = line.indexOf('=');
  if (eq === -1) continue;
  const key = line.slice(0, eq);
  let val = line.slice(eq + 1).trim();
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1);
  }
  val = val.replace(/\\n$/, '');
  process.env[key] = val;
}

import { tasks } from '@trigger.dev/sdk/v3';

const IDS = [
  '346a021d-052b-4c07-81cd-f1bdfbc9a69b',
  '23b2c5c1-3400-4ffa-91ca-dd818898037e',
  '38c240a3-01ec-468f-b535-76f86242e7bc',
  'f9233ffb-674d-42df-aabd-ebefb1822349',
];

const TITLES = [
  '$5M LinkedIn Post Database',
  'Top 1% LinkedIn Content Pack',
  '$5M AI Lead Magnet Machine Pack',
  '$5M Lead Magnet Swipe File',
];

const USER_ID = '0f634817-6db8-4a54-adfd-6ab143950b8c';

async function main() {
  console.log('Triggering rebuilds with updated Trigger.dev code (v20260226.4)...\n');

  for (let i = 0; i < IDS.length; i++) {
    try {
      const handle = await tasks.trigger('rebuild-lead-magnet-content', {
        leadMagnetId: IDS[i],
        userId: USER_ID,
      });
      console.log(`  ✓ ${TITLES[i]} → ${handle.id}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'unknown error';
      console.error(`  ✗ ${TITLES[i]}: ${msg}`);
    }
  }

  console.log('\nDone! Check Trigger.dev dashboard for progress.');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
