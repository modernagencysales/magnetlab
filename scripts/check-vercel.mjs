import { readFileSync } from 'fs';
const content = readFileSync('.env.local', 'utf8');
function getEnv(name) {
  const m = content.match(new RegExp(name + '="([^"]+)"'));
  if (!m) return '';
  let val = m[1];
  if (val.endsWith('\\n')) val = val.slice(0, -2);
  return val.trim();
}

const token = getEnv('VERCEL_TOKEN');
const projectId = getEnv('VERCEL_PROJECT_ID');
const teamId = getEnv('VERCEL_TEAM_ID');

console.log('Token length:', token.length);
console.log('Project ID:', projectId);
console.log('Team ID:', teamId);

const url = `https://api.vercel.com/v6/deployments?projectId=${projectId}&teamId=${teamId}&limit=5`;
console.log('Fetching:', url);

const res = await fetch(url, {
  headers: { Authorization: `Bearer ${token}` }
});
console.log('Status:', res.status);
const data = await res.json();

if (data.error) {
  console.log('Error:', JSON.stringify(data.error));
} else {
  console.log('Deployments:', (data.deployments || []).length);
  for (const d of (data.deployments || [])) {
    console.log(
      new Date(d.created).toISOString().slice(0, 16),
      d.state,
      d.meta?.githubCommitSha?.slice(0, 8) || 'n/a',
      (d.meta?.githubCommitMessage || '').slice(0, 70)
    );
  }
}
