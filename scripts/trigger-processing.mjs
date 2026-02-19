// Trigger process-transcript for all unprocessed Attio transcripts
import { readFileSync } from 'fs';

const content = readFileSync('.env.local', 'utf8');

function getEnv(name) {
  const m = content.match(new RegExp(name + '="([^"]+)"'));
  if (!m) return '';
  let val = m[1];
  if (val.endsWith('\\n')) val = val.slice(0, -2);
  return val.trim();
}

const url = getEnv('NEXT_PUBLIC_SUPABASE_URL');
const key = getEnv('SUPABASE_SERVICE_ROLE_KEY');
const triggerKey = getEnv('TRIGGER_SECRET_KEY');
const userId = getEnv('ATTIO_DEFAULT_USER_ID');

async function query(table, params) {
  const res = await fetch(url + '/rest/v1/' + table + '?' + params, {
    headers: { apikey: key, Authorization: 'Bearer ' + key }
  });
  return res.json();
}

async function triggerTask(taskId, payload) {
  const res = await fetch('https://api.trigger.dev/api/v1/tasks/' + taskId + '/trigger', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + triggerKey,
    },
    body: JSON.stringify({ payload }),
  });
  const body = await res.json();
  if (res.status >= 400) {
    throw new Error('Trigger API ' + res.status + ': ' + JSON.stringify(body));
  }
  return body;
}

async function main() {
  // Get unprocessed attio transcripts
  const transcripts = await query('cp_call_transcripts',
    'source=eq.attio&knowledge_extracted_at=is.null&select=id,title,user_id&order=created_at.asc'
  );

  console.log('Unprocessed Attio transcripts:', transcripts.length);

  for (const t of transcripts) {
    console.log('  Triggering:', t.title);
    try {
      const result = await triggerTask('process-transcript', {
        userId: t.user_id,
        transcriptId: t.id,
      });
      console.log('    -> Triggered, run ID:', result.id || JSON.stringify(result));
    } catch (e) {
      console.error('    -> ERROR:', e.message);
    }
    // Small delay to avoid overwhelming
    await new Promise(r => setTimeout(r, 500));
  }

  console.log('\nDone! Check Trigger.dev dashboard for processing status.');
}

main().catch(e => console.error('FATAL:', e));
