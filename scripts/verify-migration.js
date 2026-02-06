(async () => {
  var items = [
    { id: 'a76c0d3b-cb8d-4a8e-b0c1-8c52709787e0', name: 'Free LinkedIn Content System', slug: 'ai-content-generator' },
    { id: 'd2423ebd-c06f-4d98-9c7a-4f7676ca4caa', name: 'GPT-Powered LinkedIn DM System', slug: 'linkedin-dm-writing-gpt' },
    { id: 'ce17fc03-aea0-4cda-821d-26d7b93e4911', name: '7-Figure Lead Magnet Method', slug: '7-figure-lead-magnet-method' },
    { id: 'df144e0c-45a8-48b3-8c48-3aff3cc2ddec', name: 'Gemini 3: Agency Sales System', slug: 'gemini-3-agency-sales-system' },
    { id: '0f6415fc-4519-4a25-acdf-1565603108b5', name: '60-Day LinkedIn Inbound System', slug: '60-day-linkedin-inbound-system' },
    { id: '45f87f59-f6c0-4116-a0b7-3968945e03ce', name: '$5M Claude Code Agency Sales Vault', slug: '5m-claude-code-agency-sales-vault' },
    { id: '7b138303-ba63-47cc-afbc-274deb3c1a59', name: '7-Figure Agency Sales System Library', slug: '7-figure-agency-sales-system-library' },
    { id: '29d95003-d53b-4ed8-8748-8bc1b5216a26', name: '$1M+ Lead Magnet Swipefile (6 Templates)', slug: '1m-lead-magnet-swipefile' },
    { id: '346a021d-052b-4c07-81cd-f1bdfbc9a69b', name: '$5M LinkedIn Post Database Swipe File', slug: '5m-linkedin-post-database' },
    { id: '03235a60-4daa-424e-8efc-f03855474af2', name: '30-Day LinkedIn Speed-run System', slug: '30-day-linkedin-speedrun-system' },
    { id: 'fc9878e6-1ecd-4d4b-acf1-0283c3045a95', name: 'Copy My Exact LinkedIn Lead System', slug: 'copy-my-linkedin-lead-system' },
    { id: 'b6de9f0d-9eab-439e-885c-5878e65f974d', name: 'LinkedIn Inbound Playbook', slug: 'linkedin-inbound-playbook' },
    { id: '1faa51c4-cfaf-4219-bb06-563406985c03', name: 'LinkedIn Foundations Pack', slug: 'linkedin-foundations-pack' },
    { id: '23b2c5c1-3400-4ffa-91ca-dd818898037e', name: 'Top 1% LinkedIn Content Pack', slug: 'top-1-percent-linkedin-content-pack' },
    { id: '38c240a3-01ec-468f-b535-76f86242e7bc', name: '$5M AI Lead Magnet Machine Pack', slug: '5m-ai-lead-magnet-machine-pack' },
    { id: '7c280fba-1e44-4cea-9d79-41ef3e6a1235', name: 'Zero to One Offer and Close Pack', slug: 'zero-to-one-offer-and-close-pack' },
    { id: 'f9233ffb-674d-42df-aabd-ebefb1822349', name: '$5M Lead Magnet Swipe File (10k)', slug: '5m-lead-magnet-swipe-file' },
    { id: '452ae0f9-ff6e-4574-9900-6bb503f32be6', name: 'Build Your Own AI Assistant', slug: 'build-your-own-ai-assistant' },
    { id: '5ed638c6-820e-4bce-9510-61790ae1514f', name: 'Claude Code Training', slug: 'claude-code-training' }
  ];

  console.log('Verifying ' + items.length + ' lead magnets...\n');
  var results = [];

  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    var hasContent = false;
    var hasPublishedFunnel = false;
    var publicPageOk = false;
    var errors = [];

    // Check 1: Lead magnet has polished_content
    try {
      var lmRes = await fetch('/api/lead-magnet/' + item.id);
      if (lmRes.ok) {
        var lmData = await lmRes.json();
        var lm = lmData.leadMagnet || lmData;
        hasContent = lm.polished_content !== null && lm.polished_content !== undefined;
        if (!hasContent) errors.push('No content');
      } else {
        errors.push('Lead magnet fetch failed: ' + lmRes.status);
      }
    } catch (e) {
      errors.push('Lead magnet error: ' + e.message);
    }

    // Check 2: Funnel exists and is published
    try {
      var fRes = await fetch('/api/funnel?leadMagnetId=' + item.id);
      if (fRes.ok) {
        var fData = await fRes.json();
        var funnel = fData.funnel || (fData.funnels && fData.funnels[0]) || fData;
        hasPublishedFunnel = funnel.is_published === true || funnel.isPublished === true;
        if (!hasPublishedFunnel) errors.push('Funnel not published');
      } else {
        errors.push('Funnel fetch failed: ' + fRes.status);
      }
    } catch (e) {
      errors.push('Funnel error: ' + e.message);
    }

    // Check 3: Public page returns 200
    try {
      var pubRes = await fetch('/p/timkeen/' + item.slug, { redirect: 'follow' });
      publicPageOk = pubRes.ok;
      if (!publicPageOk) errors.push('Public page: ' + pubRes.status);
    } catch (e) {
      errors.push('Public page error: ' + e.message);
    }

    var status = (hasContent && hasPublishedFunnel && publicPageOk) ? 'PASS' : 'FAIL';
    results.push({
      '#': i + 1,
      Name: item.name.substring(0, 35),
      Content: hasContent ? 'Yes' : 'NO',
      Published: hasPublishedFunnel ? 'Yes' : 'NO',
      'Page OK': publicPageOk ? 'Yes' : 'NO',
      Status: status,
      Errors: errors.join('; ') || '-'
    });

    await new Promise(function(r) { setTimeout(r, 200); });
  }

  var passCount = results.filter(function(r) { return r.Status === 'PASS'; }).length;
  var failCount = results.length - passCount;

  console.table(results);
  console.log('\nResult: ' + passCount + ' PASS / ' + failCount + ' FAIL out of ' + results.length);

  if (failCount > 0) {
    console.log('\nFailed items:');
    results.filter(function(r) { return r.Status === 'FAIL'; }).forEach(function(r) {
      console.log('  ' + r['#'] + '. ' + r.Name + ' - ' + r.Errors);
    });
  }
})();
