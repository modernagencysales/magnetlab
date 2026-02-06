(async () => {
  var linkResources = [
    {
      id: 'a76c0d3b-cb8d-4a8e-b0c1-8c52709787e0',
      name: 'Free LinkedIn Content System',
      content: {
        heroSummary: 'The exact system for turning recorded sales calls into high-quality LinkedIn posts.',
        sections: [
          {
            id: 'access',
            sectionName: 'Access Your Resources',
            introduction: 'Here is your copy of the AI Content Generator. Get a full walkthrough of the exact system I use to turn my call recordings into top-quality posts.',
            blocks: [
              { type: 'callout', content: 'Watch How it Works\nhttps://storage.googleapis.com/msgsndr/TBBJ77dxW4J2L27gMKFu/media/67992a8a2ee4852fecc0c7fc.mp4', style: 'info' },
              { type: 'callout', content: 'Download the Prompt\nhttps://docs.google.com/document/d/1geVUJlUTwKq4ki8hXUkEBBqbRmyoLzkT7bfNrhlj0Ho', style: 'info' }
            ],
            keyTakeaway: 'Use this system to turn any recorded call into consistent LinkedIn content.'
          }
        ]
      }
    },
    {
      id: 'd2423ebd-c06f-4d98-9c7a-4f7676ca4caa',
      name: 'GPT-Powered LinkedIn DM System',
      content: {
        heroSummary: 'The exact GPT workflow used to generate $5M in revenue through LinkedIn DMs.',
        sections: [
          {
            id: 'access',
            sectionName: 'Access Your Resource',
            introduction: 'Here is your copy. Get a full walkthrough of the exact system I use to turn my DMs into sales calls.',
            blocks: [
              { type: 'callout', content: 'Get Access Here\nhttps://go.modernagencysales.com/dmgpt-thanks', style: 'info' }
            ],
            keyTakeaway: 'Follow the GPT workflow to craft high-converting LinkedIn DMs.'
          }
        ]
      }
    },
    {
      id: '346a021d-052b-4c07-81cd-f1bdfbc9a69b',
      name: '$5M LinkedIn Post Database Swipe File',
      content: {
        heroSummary: 'Curated database of proven LinkedIn post structures that generated $5M+ without ads.',
        sections: [
          {
            id: 'access',
            sectionName: 'Access Your Swipe File',
            introduction: 'Here is your copy of the $5M LinkedIn Post Database Swipe File.',
            blocks: [
              { type: 'callout', content: 'Access the Airtable Database\nhttps://airtable.com/appocNnw4hPnnSfOj/pagCxbYPTw5fXeotL?xnOwz=recfli6zmZP89hUZn', style: 'info' },
              { type: 'paragraph', content: 'This Airtable contains urgency-driven offers and direct-response hooks. Use these proven post structures to get massive engagement and own inbound leads.' }
            ],
            keyTakeaway: 'Model your posts after these proven structures for predictable engagement.'
          }
        ]
      }
    },
    {
      id: 'fc9878e6-1ecd-4d4b-acf1-0283c3045a95',
      name: 'Copy My Exact LinkedIn Lead System',
      content: {
        heroSummary: 'The proven daily loop that turned LinkedIn into a $4.7M reliable lead machine.',
        sections: [
          {
            id: 'access',
            sectionName: 'Access Your Resource',
            introduction: 'Here is your copy of My Exact LinkedIn Lead System.',
            blocks: [
              { type: 'callout', content: 'Get Access Here\nhttps://go.modernagencysales.com/thanks-4375-8983-7724', style: 'info' },
              { type: 'paragraph', content: 'Comes loaded with 100+ post templates, niche examples, and prompts to eliminate blank-screen stress and deliver predictable pipeline.' }
            ],
            keyTakeaway: 'Copy this proven daily loop to turn LinkedIn into your reliable lead machine.'
          }
        ]
      }
    },
    {
      id: '5ed638c6-820e-4bce-9510-61790ae1514f',
      name: 'Claude Code Training',
      content: {
        heroSummary: 'Learn to build AI-powered tools that actually run your business.',
        sections: [
          {
            id: 'access',
            sectionName: 'Access Your Training',
            introduction: 'Here is your copy of the Claude Code Training. An interactive platform that teaches you coding, prompting, and deployment by building projects you can use immediately.',
            blocks: [
              { type: 'callout', content: 'Start Training Here\nhttps://claude-code-training-ebon.vercel.app/', style: 'info' },
              { type: 'paragraph', content: 'Hands-on, results-driven, no fluff. Build projects you can use immediately.' }
            ],
            keyTakeaway: 'Learn by building real AI-powered tools for your business.'
          }
        ]
      }
    }
  ];

  console.log('Pushing content for ' + linkResources.length + ' link-only resources...\n');
  var success = 0;
  var errors = 0;

  for (var i = 0; i < linkResources.length; i++) {
    var item = linkResources[i];
    console.log('Pushing: ' + item.name + '...');
    try {
      var res = await fetch('/api/lead-magnet/' + item.id + '/content', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          polishedContent: {
            version: 1,
            polishedAt: new Date().toISOString(),
            heroSummary: item.content.heroSummary,
            sections: item.content.sections,
            metadata: { readingTimeMinutes: 2, wordCount: 200 }
          }
        })
      });
      if (!res.ok) {
        var data = await res.json();
        throw new Error(res.status + ': ' + JSON.stringify(data));
      }
      console.log('  Done');
      success++;
    } catch (err) {
      console.error('  Error: ' + err.message);
      errors++;
    }
    await new Promise(function(r) { setTimeout(r, 300); });
  }

  console.log('\nComplete! ' + success + '/' + linkResources.length + ' pushed (' + errors + ' errors)');
})();
