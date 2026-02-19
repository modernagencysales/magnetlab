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

async function query(table, params) {
  const res = await fetch(url + '/rest/v1/' + table + '?' + params, {
    headers: { apikey: key, Authorization: 'Bearer ' + key }
  });
  return res.json();
}

async function main() {
  // Check transcripts
  const transcripts = await query('cp_call_transcripts', 'source=eq.attio&select=id,title,knowledge_extracted_at,ideas_extracted_at,created_at&order=created_at.desc');
  console.log('=== Attio Transcripts ===');
  console.log('Count:', transcripts.length);
  for (const t of transcripts) {
    console.log(' ', t.title);
    console.log('    knowledge_extracted:', t.knowledge_extracted_at || 'NOT YET');
    console.log('    ideas_extracted:', t.ideas_extracted_at || 'NOT YET');
  }

  // Check knowledge entries from these transcripts
  const tIds = transcripts.map(t => t.id);
  if (tIds.length > 0) {
    const knowledge = await query('cp_knowledge_entries', 'transcript_id=in.(' + tIds.join(',') + ')&select=id,category,content&limit=10');
    console.log('\n=== Knowledge Entries (sample) ===');
    console.log('Total found:', knowledge.length);
    for (const k of knowledge) {
      console.log(' [' + k.category + ']', (k.content || '').substring(0, 100) + '...');
    }
  }

  // Total knowledge count
  const allKnowledge = await query('cp_knowledge_entries', 'select=id&limit=1&head=true');
  // Use count header approach
  const countRes = await fetch(url + '/rest/v1/cp_knowledge_entries?select=id', {
    headers: { apikey: key, Authorization: 'Bearer ' + key, Prefer: 'count=exact', Range: '0-0' }
  });
  const countHeader = countRes.headers.get('content-range');
  console.log('\n=== Total Knowledge Entries ===');
  console.log('Content-Range:', countHeader);
}

main().catch(e => console.error(e));
