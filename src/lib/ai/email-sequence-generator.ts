// AI Email Sequence Generator
// Generates 5-email welcome sequences for lead magnets

import Anthropic from '@anthropic-ai/sdk';
import type { Email, EmailGenerationContext } from '@/lib/types/email';

// Lazy initialization to ensure env vars are loaded
function getAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set in environment variables');
  }
  return new Anthropic({ apiKey, timeout: 30_000 });
}

const EMAIL_SEQUENCE_SYSTEM_PROMPT = `You are an expert email copywriter creating a 5-email welcome sequence for someone who just downloaded a lead magnet. Your emails:

## SUBJECT LINE RULES
- Maximum 5 words
- Lowercase is fine (feels more personal)
- NO clickbait - be direct: "your scripts are here" not "You Won't BELIEVE What's Inside..."
- Match the casual, direct tone of the email

## EMAIL STRUCTURE RULES
- Sender's name appears 3+ times: greeting, first sentence, signature
- 6th grade reading level - short sentences, simple words
- ONE clear CTA per email (no multiple links)
- Include a "reply trigger" question or statement in each email to encourage engagement
- Sign off with sender's name

## EMAIL SEQUENCE (5 emails)

### Email 1: Immediate Delivery (Day 0)
- Deliver the lead magnet (clear download/access link)
- Quick intro: who you are, why this will help
- Reply trigger: Ask them to reply with one word to confirm they got it
- Very short - they want the content, not a novel

### Email 2: 24 Hours Later
- Check if they've had a chance to use it
- Link to your best video or content piece that complements the lead magnet
- Share one quick tip from the lead magnet
- Reply trigger: Ask what their biggest challenge is

### Email 3: 48 Hours Later
- Share 3-5 best free resources (not your products, genuine value)
- Position yourself as a curator of great content
- Reply trigger: Ask which resource they're most excited to check out

### Email 4: 72 Hours Later
- Invite to community OR share a case study/success story
- Show social proof of the methodology working
- Reply trigger: Ask if they have questions about implementing

### Email 5: 96 Hours Later
- Set newsletter expectations (what to expect, how often)
- Ask about topics they want covered
- Reply trigger: Ask them to hit reply with their #1 topic request

## TONE
- Conversational, like texting a smart friend
- No hype or corporate speak
- Real, authentic, occasionally funny
- Never use: "unleash", "supercharge", "game-changer", "unlock", "revolutionary"

## FORMAT
Return exactly 5 emails as a JSON array. Each email object has:
- day: number (0, 1, 2, 3, or 4)
- subject: string (max 5 words, lowercase ok)
- body: string (the full email content with {{first_name}} for personalization)
- replyTrigger: string (the specific question/prompt to encourage replies)`;

export interface GenerateEmailSequenceInput {
  context: EmailGenerationContext;
}

export async function generateEmailSequence(
  input: GenerateEmailSequenceInput
): Promise<Email[]> {
  const { context } = input;

  // Build the context for the AI
  const contextParts: string[] = [];

  contextParts.push(`LEAD MAGNET TITLE: ${context.leadMagnetTitle}`);
  contextParts.push(`FORMAT: ${context.leadMagnetFormat}`);
  contextParts.push(`CONTENTS: ${context.leadMagnetContents}`);
  contextParts.push(`SENDER NAME: ${context.senderName}`);
  contextParts.push(`BUSINESS DESCRIPTION: ${context.businessDescription}`);

  if (context.bestVideoUrl && context.bestVideoTitle) {
    contextParts.push(`BEST VIDEO TO LINK (Email 2): ${context.bestVideoTitle} - ${context.bestVideoUrl}`);
  }

  if (context.contentLinks && context.contentLinks.length > 0) {
    const links = context.contentLinks
      .map((l, i) => `${i + 1}. ${l.title} - ${l.url}`)
      .join('\n');
    contextParts.push(`FREE RESOURCES TO SHARE (Email 3):\n${links}`);
  }

  if (context.communityUrl) {
    contextParts.push(`COMMUNITY URL (Email 4): ${context.communityUrl}`);
  }

  const prompt = `${EMAIL_SEQUENCE_SYSTEM_PROMPT}

## CONTEXT
${contextParts.join('\n\n')}

Generate the 5-email welcome sequence. Return ONLY valid JSON - an array of 5 email objects:
[
  { "day": 0, "subject": "...", "body": "...", "replyTrigger": "..." },
  { "day": 1, "subject": "...", "body": "...", "replyTrigger": "..." },
  { "day": 2, "subject": "...", "body": "...", "replyTrigger": "..." },
  { "day": 3, "subject": "...", "body": "...", "replyTrigger": "..." },
  { "day": 4, "subject": "...", "body": "...", "replyTrigger": "..." }
]

IMPORTANT:
- Use {{first_name}} for personalization in the email body
- Include the actual URLs provided above in the relevant emails
- Each email should be complete and ready to send
- Sign off with "${context.senderName}" in each email`;

  const response = await getAnthropicClient().messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4000,
    messages: [{ role: 'user', content: prompt }],
  });

  // Extract text content from response
  const textContent = response.content.find((block) => block.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text content in AI response');
  }

  // Parse JSON from response
  const jsonMatch = textContent.text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error('Could not find JSON array in AI response');
  }

  const emails = JSON.parse(jsonMatch[0]) as Email[];

  // Validate we have exactly 5 emails
  if (!Array.isArray(emails) || emails.length !== 5) {
    throw new Error(`Expected 5 emails, got ${emails?.length || 0}`);
  }

  // Validate each email has required fields
  for (let i = 0; i < emails.length; i++) {
    const email = emails[i];
    if (typeof email.day !== 'number' || email.day < 0 || email.day > 4) {
      throw new Error(`Email ${i + 1} has invalid day: ${email.day}`);
    }
    if (!email.subject || typeof email.subject !== 'string') {
      throw new Error(`Email ${i + 1} missing subject`);
    }
    if (!email.body || typeof email.body !== 'string') {
      throw new Error(`Email ${i + 1} missing body`);
    }
    if (!email.replyTrigger || typeof email.replyTrigger !== 'string') {
      throw new Error(`Email ${i + 1} missing replyTrigger`);
    }
  }

  // Sort by day to ensure correct order
  emails.sort((a, b) => a.day - b.day);

  return emails;
}

// Generate default email sequence without AI (fallback)
export function generateDefaultEmailSequence(
  leadMagnetTitle: string,
  senderName: string
): Email[] {
  return [
    {
      day: 0,
      subject: 'your download is ready',
      body: `Hey {{first_name}},

${senderName} here - your ${leadMagnetTitle} is ready!

[DOWNLOAD LINK]

Let me know you got it by replying with "got it" - I read every reply.

${senderName}`,
      replyTrigger: 'Reply with "got it" to confirm you received it',
    },
    {
      day: 1,
      subject: 'did you get it?',
      body: `Hey {{first_name}},

${senderName} again - just checking in.

Did you have a chance to check out the ${leadMagnetTitle} yet?

Quick tip: [INSERT TIP FROM LEAD MAGNET]

What's your biggest challenge with this? Hit reply and let me know.

${senderName}`,
      replyTrigger: "What's your biggest challenge with this?",
    },
    {
      day: 2,
      subject: 'free resources for you',
      body: `Hey {{first_name}},

${senderName} here with some free resources that complement what you downloaded:

1. [Resource 1]
2. [Resource 2]
3. [Resource 3]

Which one are you most excited to dive into? Reply and let me know!

${senderName}`,
      replyTrigger: 'Which resource are you most excited to check out?',
    },
    {
      day: 3,
      subject: 'quick question',
      body: `Hey {{first_name}},

${senderName} here.

I'm curious - have you had a chance to implement anything from the ${leadMagnetTitle}?

If you have questions, just hit reply. I read and respond to every email.

${senderName}`,
      replyTrigger: 'Have any questions about implementing this?',
    },
    {
      day: 4,
      subject: 'what should I cover next?',
      body: `Hey {{first_name}},

${senderName} one more time.

I'll be sending you valuable content regularly - strategies, tips, and insights.

But I want to make sure I'm covering topics YOU care about.

Hit reply with your #1 topic request and I'll make sure to cover it.

${senderName}`,
      replyTrigger: 'What topic should I cover next?',
    },
  ];
}
