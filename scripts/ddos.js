#!/usr/bin/env node
/**
 * DDoS vulnerability load-test script — AUTHORIZED TESTING ONLY
 *
 * Use only against your own environments (localhost, staging). Do not run
 * against production without explicit approval.
 *
 * Usage:
 *   node scripts/ddos-vulnerability-test.js [options]
 *
 * Options:
 *   --url <base>       Base URL (default: http://localhost:3000)
 *   --endpoint <name>  One of: view | resource-click | page-get | questions-get | lead | chat | all | max-stress
 *   --requests <n>     Total requests per endpoint (default: 100; max-stress uses 1500)
 *   --concurrency <n>  Concurrent requests (default: 10; max-stress uses 150)
 *   --max-stress       Hit ALL public APIs at once with high volume (1500 req/endpoint, 150 concurrent)
 *   --dry-run          Print config and exit without sending requests
 */

const BASE_URL = 'http://localhost:3000';
const DEFAULT_REQUESTS = 100;
const DEFAULT_CONCURRENCY = 10;
const MAX_STRESS_REQUESTS = 1500;
const MAX_STRESS_CONCURRENCY = 150;

const FAKE_FUNNEL_PAGE_ID = '00000000-0000-0000-0000-000000000001';
const FAKE_RESOURCE_ID = '00000000-0000-0000-0000-000000000002';

function parseArgs() {
  const args = process.argv.slice(2);
  let baseUrl = BASE_URL;
  let endpoint = 'view';
  let requests = DEFAULT_REQUESTS;
  let concurrency = DEFAULT_CONCURRENCY;
  let dryRun = false;
  let maxStress = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--url' && args[i + 1]) {
      baseUrl = args[++i].replace(/\/$/, '');
    } else if (args[i] === '--endpoint' && args[i + 1]) {
      endpoint = args[++i];
    } else if (args[i] === '--requests' && args[i + 1]) {
      requests = Math.max(1, parseInt(args[++i], 10) || DEFAULT_REQUESTS);
    } else if (args[i] === '--concurrency' && args[i + 1]) {
      concurrency = Math.max(1, Math.min(2000, parseInt(args[++i], 10) || DEFAULT_CONCURRENCY));
    } else if (args[i] === '--max-stress') {
      maxStress = true;
    } else if (args[i] === '--dry-run') {
      dryRun = true;
    }
  }

  if (maxStress) {
    endpoint = 'max-stress';
    requests = MAX_STRESS_REQUESTS;
    concurrency = MAX_STRESS_CONCURRENCY;
  }

  if (baseUrl !== BASE_URL && !baseUrl.includes('localhost')) {
    console.warn('\n⚠️  WARNING: Non-localhost URL. Only use on systems you are authorized to test.\n');
  }

  return { baseUrl, endpoint, requests, concurrency, dryRun, maxStress };
}

async function runBatch(tasks, concurrency) {
  const results = { ok: 0, err: 0, statuses: {} };
  let index = 0;

  async function worker() {
    while (index < tasks.length) {
      const i = index++;
      try {
        const res = await tasks[i]();
        results.ok++;
        results.statuses[res.status] = (results.statuses[res.status] || 0) + 1;
      } catch (e) {
        results.err++;
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

function mergeResults(a, b) {
  const statuses = { ...a.statuses };
  Object.entries(b.statuses || {}).forEach(([s, c]) => {
    statuses[s] = (statuses[s] || 0) + c;
  });
  return { ok: a.ok + b.ok, err: a.err + b.err, statuses };
}

async function testView(baseUrl, count, concurrency) {
  const url = `${baseUrl}/api/public/view`;
  const body = JSON.stringify({ funnelPageId: FAKE_FUNNEL_PAGE_ID, pageType: 'optin' });
  const tasks = Array.from({ length: count }, () => () =>
    fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }).then((r) => ({ status: r.status }))
  );
  return runBatch(tasks, concurrency);
}

async function testResourceClick(baseUrl, count, concurrency) {
  const url = `${baseUrl}/api/public/resource-click`;
  const body = JSON.stringify({ resourceId: FAKE_RESOURCE_ID, funnelPageId: FAKE_FUNNEL_PAGE_ID });
  const tasks = Array.from({ length: count }, () => () =>
    fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }).then((r) => ({ status: r.status }))
  );
  return runBatch(tasks, concurrency);
}

async function testPageGet(baseUrl, count, concurrency) {
  const url = `${baseUrl}/api/public/page/test-user/test-slug`;
  const tasks = Array.from({ length: count }, () => () => fetch(url).then((r) => ({ status: r.status })));
  return runBatch(tasks, concurrency);
}

async function testQuestionsGet(baseUrl, count, concurrency) {
  const url = `${baseUrl}/api/public/questions/${FAKE_FUNNEL_PAGE_ID}`;
  const tasks = Array.from({ length: count }, () => () => fetch(url).then((r) => ({ status: r.status })));
  return runBatch(tasks, concurrency);
}

// Lead: rate limited 5/min per IP. Rotate X-Forwarded-For to maximize accepted requests and stress DB/side-effects.
async function testLead(baseUrl, count, concurrency) {
  const url = `${baseUrl}/api/public/lead`;
  const tasks = Array.from({ length: count }, (_, i) => {
    const fakeIp = `192.168.1.${(i % 254) + 1}`;
    const body = JSON.stringify({
      funnelPageId: FAKE_FUNNEL_PAGE_ID,
      email: `loadtest-${i}-${Date.now()}@example.com`,
      name: `Load ${i}`,
    });
    return () =>
      fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': fakeIp,
          'X-Real-IP': fakeIp,
        },
        body,
      }).then((r) => ({ status: r.status }));
  });
  return runBatch(tasks, concurrency);
}

// Chat: no IP limit; per-session 50/hr. Use unique sessionToken per request to bypass session limit and stress AI/DB.
async function testChat(baseUrl, count, concurrency) {
  const url = `${baseUrl}/api/public/chat`;
  const tasks = Array.from({ length: count }, (_, i) => {
    const body = JSON.stringify({
      leadMagnetId: FAKE_FUNNEL_PAGE_ID,
      sessionToken: `stress-${i}-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`,
      message: 'Stress test message',
    });
    return () =>
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      }).then((r) => ({ status: r.status }));
  });
  return runBatch(tasks, concurrency);
}

const ENDPOINTS = [
  { name: 'view', fn: testView },
  { name: 'resource-click', fn: testResourceClick },
  { name: 'page-get', fn: testPageGet },
  { name: 'questions-get', fn: testQuestionsGet },
  { name: 'lead', fn: testLead },
  { name: 'chat', fn: testChat },
];

async function runAll(baseUrl, requestsPerEndpoint, concurrency) {
  const per = Math.max(1, Math.floor(requestsPerEndpoint));
  const start = Date.now();
  const results = await Promise.all(
    ENDPOINTS.map(async (ep) => {
      const r = await ep.fn(baseUrl, per, concurrency);
      return { name: ep.name, ...r };
    })
  );
  const elapsed = Date.now() - start;
  const totalRequests = ENDPOINTS.length * per;
  const totalOk = results.reduce((s, r) => s + r.ok, 0);
  const totalErr = results.reduce((s, r) => s + r.err, 0);
  return { results, elapsed, totalRequests, totalOk, totalErr };
}

async function main() {
  const { baseUrl, endpoint, requests, concurrency, dryRun, maxStress } = parseArgs();

  console.log('DDoS vulnerability test (authorized testing only)\n');
  console.log('Config:', { baseUrl, endpoint, requests, concurrency }, maxStress ? '\nMode: MAX STRESS (all public APIs)' : '');
  if (dryRun) {
    console.log('\nDry run — no requests sent.');
    return;
  }

  const start = Date.now();
  let resultPayload;

  if (endpoint === 'max-stress' || endpoint === 'all') {
    if (endpoint === 'max-stress') {
      console.log('\nFiring all 6 public APIs in parallel:', ENDPOINTS.map((e) => e.name).join(', '));
      const out = await runAll(baseUrl, requests, concurrency);
      resultPayload = out;
      console.log('\nPer-endpoint results:');
      out.results.forEach((r) => {
        console.log(`  ${r.name}: ok=${r.ok} err=${r.err}`, r.statuses);
      });
      console.log(`\nTotal: ${out.totalOk} ok, ${out.totalErr} err, ${out.totalRequests} requests in ${(out.elapsed / 1000).toFixed(2)}s`);
      console.log(`RPS: ${(out.totalRequests / (out.elapsed / 1000)).toFixed(1)}`);
    } else {
      const per = Math.floor(requests / ENDPOINTS.length);
      const [r1, r2, r3, r4, r5, r6] = await Promise.all([
        testView(baseUrl, per, concurrency),
        testResourceClick(baseUrl, per, concurrency),
        testPageGet(baseUrl, per, concurrency),
        testQuestionsGet(baseUrl, per, concurrency),
        testLead(baseUrl, per, concurrency),
        testChat(baseUrl, per, concurrency),
      ]);
      let merged = mergeResults(r1, r2);
      merged = mergeResults(merged, r3);
      merged = mergeResults(merged, r4);
      merged = mergeResults(merged, r5);
      merged = mergeResults(merged, r6);
      const elapsed = Date.now() - start;
      resultPayload = { results: merged, elapsed, totalRequests: per * ENDPOINTS.length };
      console.log('\nResult:', merged);
      console.log(`Time: ${(elapsed / 1000).toFixed(2)}s, RPS: ${(resultPayload.totalRequests / (elapsed / 1000)).toFixed(1)}`);
    }
  } else {
    const single = {
      view: testView,
      'resource-click': testResourceClick,
      'page-get': testPageGet,
      'questions-get': testQuestionsGet,
      lead: testLead,
      chat: testChat,
    };
    const fn = single[endpoint];
    if (!fn) {
      console.error('Unknown endpoint. Use: view | resource-click | page-get | questions-get | lead | chat | all | max-stress');
      process.exit(1);
    }
    const results = await fn(baseUrl, requests, concurrency);
    const elapsed = Date.now() - start;
    resultPayload = { results, elapsed, totalRequests: requests };
    console.log('\nResult:', results);
    console.log(`Time: ${(elapsed / 1000).toFixed(2)}s, RPS: ${(requests / (elapsed / 1000)).toFixed(1)}`);
  }

  const errCount = resultPayload.totalErr ?? resultPayload.results?.err ?? 0;
  if (errCount > 0) {
    console.log(`Errors: ${errCount} (network/timeout)`);
  }
  const ok = resultPayload.totalOk ?? resultPayload.results?.ok ?? 0;
  const total = resultPayload.totalRequests ?? requests;
  if (total > 0 && ok >= total * 0.9 && errCount === 0) {
    console.log('\n✓ Little or no rate limiting observed. Consider adding per-IP limits on public APIs.');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
