(async () => {
  var RESEND_API_KEY = "re_Ambq7mwT_MfYuFA5yTeVChRk5XhBgB3cj";

  // Get CSRF token from cookie (double-submit pattern)
  function getCsrfToken() {
    var match = document.cookie.match(/(?:^|;\s*)__csrf_token=([^;]*)/);
    return match ? match[1] : null;
  }

  // Ensure we have a CSRF token
  var csrfToken = getCsrfToken();
  if (!csrfToken) {
    console.log("No CSRF token found, fetching one...");
    await fetch("/api/health", { method: "GET", credentials: "same-origin" });
    csrfToken = getCsrfToken();
  }
  if (!csrfToken) throw new Error("Could not obtain CSRF token");
  console.log("CSRF token obtained.");

  // Helper: fetch with CSRF header
  function csrfFetch(url, opts) {
    opts = opts || {};
    opts.headers = opts.headers || {};
    opts.headers["x-csrf-token"] = csrfToken;
    opts.headers["Content-Type"] = "application/json";
    return fetch(url, opts);
  }

  // Step 1: Configure email settings
  console.log("1/4 Configuring email settings...");
  var settingsRes = await csrfFetch("/api/email/settings", {
    method: "PUT",
    body: JSON.stringify({
      fromName: "Tim",
      fromEmail: "tim@modernagencysales.com",
      replyTo: "tim@modernagencysales.com",
      resendApiKey: RESEND_API_KEY,
      isActive: true
    })
  });
  if (!settingsRes.ok) throw new Error("Settings failed: " + await settingsRes.text());
  console.log("   Email settings saved.");

  // Step 2: Create nurture flow
  console.log("2/4 Creating nurture flow...");
  var flowRes = await csrfFetch("/api/email/flows", {
    method: "POST",
    body: JSON.stringify({
      name: "Lead Magnet Nurture Sequence",
      trigger_type: "lead_magnet",
      description: "Shared nurture sequence sent after lead magnet delivery (emails 2-5)"
    })
  });
  if (!flowRes.ok) throw new Error("Flow creation failed: " + await flowRes.text());
  var flowData = await flowRes.json();
  var flowId = flowData.flow.id;
  console.log("   Flow created: " + flowId);

  // Step 3: Add 4 email steps
  console.log("3/4 Adding 4 nurture email steps...");

  var step1Body = [
    "Did you get a chance to check out the resource I sent yesterday?",
    "",
    "I know things get buried in the inbox so I wanted to make sure it didn't slip through the cracks.",
    "",
    "The thing most people miss is actually implementing what's inside \u2014 not just saving it for later. Even picking ONE idea and running with it this week will put you ahead of 90% of people who download stuff like this.",
    "",
    "What's the biggest thing you're working on right now in your business? Hit reply and let me know \u2014 I might have something that helps."
  ].join("\n");

  var step2Body = [
    "I was putting together some notes for a client yesterday and thought of you.",
    "",
    "One of the biggest mistakes I see agency owners make is trying to do everything manually \u2014 outreach, follow-ups, content, proposals. It works until it doesn't. Then you hit a ceiling and can't figure out why growth stalled.",
    "",
    "The fix is almost always the same: systematize the thing that's eating most of your time.",
    "",
    "If you want to see how we've set up our systems, check out what we're doing at modernagencysales.com \u2014 happy to walk you through any of it."
  ].join("\n");

  var step3Body = [
    "Quick story \u2014 one of the agency owners I work with was stuck at $15k/month for almost a year. Good at what he did, plenty of leads coming in, but couldn't break through.",
    "",
    "The problem wasn't his service or his pricing. It was that he had no system for turning cold leads into booked calls. Everything was ad hoc.",
    "",
    "We helped him build a simple inbound funnel \u2014 lead magnet, nurture sequence, qualification step, calendar link. Within 60 days he was consistently booking 8-10 calls a week and crossed $30k/month.",
    "",
    "No fancy tools. No massive ad spend. Just a system that runs while he focuses on delivery.",
    "",
    "That's what I help people build. If you're curious how it would work for your business, just reply and I'll share more details."
  ].join("\n");

  var step4Body = [
    "I'll keep this short.",
    "",
    "If you found the resource helpful and you're serious about growing your agency or business this year, I'd love to chat.",
    "",
    "I do a handful of strategy calls each week where I look at your current setup and map out exactly what I'd change to get more inbound leads and booked calls. No pitch, just an honest look at what's working and what's not.",
    "",
    "If that sounds useful, reply with \"interested\" and I'll send you a link to grab a time.",
    "",
    "Either way, thanks for reading \u2014 I appreciate you being here."
  ].join("\n");

  var stepsRes = await csrfFetch("/api/email/flows/" + flowId + "/steps", {
    method: "POST",
    body: JSON.stringify({
      steps: [
        { step_number: 1, delay_days: 1, subject: "Quick question for you", body: step1Body },
        { step_number: 2, delay_days: 2, subject: "This might help", body: step2Body },
        { step_number: 3, delay_days: 3, subject: "Thought you'd find this interesting", body: step3Body },
        { step_number: 4, delay_days: 4, subject: "One more thing", body: step4Body }
      ]
    })
  });
  if (!stepsRes.ok) throw new Error("Steps failed: " + await stepsRes.text());
  console.log("   4 steps added.");

  // Step 4: Activate the flow
  console.log("4/4 Activating flow...");
  var activateRes = await csrfFetch("/api/email/flows/" + flowId, {
    method: "PUT",
    body: JSON.stringify({ status: "active" })
  });
  if (!activateRes.ok) throw new Error("Activation failed: " + await activateRes.text());
  console.log("   Flow activated!");

  console.log("\n=== DONE ===");
  console.log("Flow ID: " + flowId);
  console.log("Status: Active");
  console.log("Steps: 4 (delays: 1, 2, 3, 4 days)");
  console.log("\nNext: Test by opting in on a MagnetLab funnel page with a test email.");
})();
