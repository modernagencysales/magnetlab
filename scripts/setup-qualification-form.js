(async () => {
  var funnelIds = [
    'bbf9e53a', '25fa812e', 'e8f41dfd', 'e5419621', '4dbcb892',
    'cf8d473e', '982923b6', '97bc3eef', '3ba3a6bf', '301ea43f',
    'b8120fc2', '768b7851', '3d38e548', 'a46a0745', '710eb115',
    '064447f3', 'bfaf9b66', '1444149e', '0cb07437'
  ];

  // Step 1: Create the qualification form
  console.log('Step 1: Creating qualification form...');
  var formRes = await fetch('/api/qualification-forms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Standard Lead Qualification' })
  });

  if (!formRes.ok) {
    var err = await formRes.json();
    console.error('Failed to create form:', formRes.status, err);
    return;
  }

  var formData = await formRes.json();
  var formId = formData.form.id;
  console.log('  Form created: ' + formId);

  // Step 2: Add qualification question
  console.log('Step 2: Adding qualification question...');
  var qRes = await fetch('/api/qualification-forms/' + formId + '/questions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      questionText: 'Are you currently running a business or agency?',
      answerType: 'yes_no',
      isQualifying: true,
      qualifyingAnswer: 'yes',
      isRequired: true
    })
  });

  if (!qRes.ok) {
    var err2 = await qRes.json();
    console.error('Failed to add question:', qRes.status, err2);
    return;
  }

  var qData = await qRes.json();
  console.log('  Question added: ' + qData.question.id);

  // Step 3: Assign form to all 19 funnels
  console.log('Step 3: Assigning form to ' + funnelIds.length + ' funnels...');
  var success = 0;
  var errors = 0;

  for (var i = 0; i < funnelIds.length; i++) {
    var fid = funnelIds[i];
    try {
      var res = await fetch('/api/funnel/' + fid, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qualificationFormId: formId })
      });
      if (!res.ok) {
        var data = await res.json();
        throw new Error(res.status + ': ' + JSON.stringify(data));
      }
      success++;
    } catch (err) {
      console.error('  Error on funnel ' + fid + ': ' + err.message);
      errors++;
    }
    await new Promise(function(r) { setTimeout(r, 200); });
  }

  console.log('\nDone!');
  console.log('  Form ID: ' + formId);
  console.log('  Question: Are you currently running a business or agency?');
  console.log('  Assigned to: ' + success + '/' + funnelIds.length + ' funnels (' + errors + ' errors)');
})();
