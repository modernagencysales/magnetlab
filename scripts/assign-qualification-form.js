(async () => {
  var formId = 'a0b83dbb-c6c9-4bbb-9f7c-36fbded66f26';
  var funnelIds = [
    'bbf9e53a-2707-4603-a61e-50ef5467d04d',
    '25fa812e-0f35-48a6-923f-94b69fa86316',
    'e8f41dfd-6079-4e81-a7ed-b4550a757f63',
    'e5419621-1ed9-42d8-987c-ce4f9a865110',
    '4dbcb892-e099-4ec8-a466-a2a0686a6683',
    'cf8d473e-bd8b-4d25-8952-8c6c5464f592',
    '982923b6-7d3d-4bf2-824f-f59c909341a9',
    '97bc3eef-0cb3-4384-b901-1c86a8a9736b',
    '3ba3a6bf-b3c3-4c12-b906-8fa0417863f2',
    '301ea43f-1e19-4191-b2d7-1ebc0117b07f',
    'b8120fc2-edb9-499d-9fdd-81a619f59518',
    '768b7851-aefb-40cc-b0d9-bee7067e42eb',
    '3d38e548-736d-47a5-a382-b673565574d5',
    'a46a0745-2eb7-4c95-beca-6f6d3453bea8',
    '710eb115-a067-401e-9c63-c5f08737db35',
    '064447f3-fdfc-4ee1-81cb-fbaf0aa16901',
    'bfaf9b66-9fed-4f47-9ec5-012e8cdbf240',
    '1444149e-1de3-4ca4-a6a3-9b85a27b3afd',
    '0cb07437-0f9d-4c29-9d53-c32604c6ada4'
  ];

  var success = 0;
  var errors = 0;

  for (var i = 0; i < funnelIds.length; i++) {
    try {
      var res = await fetch('/api/funnel/' + funnelIds[i], {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qualificationFormId: formId })
      });
      if (!res.ok) throw new Error(res.status + ': ' + (await res.text()));
      success++;
    } catch (err) {
      console.error('Error on ' + funnelIds[i] + ': ' + err.message);
      errors++;
    }
    await new Promise(function(r) { setTimeout(r, 200); });
  }

  console.log('Done! Assigned to ' + success + '/' + funnelIds.length + ' funnels (' + errors + ' errors)');
})();
