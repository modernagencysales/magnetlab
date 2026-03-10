import { MagnetLabClient } from '../client.js';

/** Pattern matching bracketed placeholders like [INSERT TIP], [Resource 1], [YOUR NAME], [TODO]. */
const PLACEHOLDER_PATTERN = /\[[A-Z][A-Za-z0-9 _]*\]/g;

/** Scan email subjects and bodies for template placeholders. Returns list of issues or empty array. */
function findPlaceholders(
  emails: Array<{ subject?: string; body?: string; day?: number }>
): string[] {
  const issues: string[] = [];
  for (const email of emails) {
    const day = email.day ?? '?';
    const subjectMatches = email.subject?.match(PLACEHOLDER_PATTERN);
    if (subjectMatches) {
      issues.push(`Email day ${day} subject: ${subjectMatches.join(', ')}`);
    }
    const bodyMatches = email.body?.match(PLACEHOLDER_PATTERN);
    if (bodyMatches) {
      issues.push(`Email day ${day} body: ${bodyMatches.join(', ')}`);
    }
  }
  return issues;
}

/**
 * Handle email sequence tool calls.
 */
export async function handleEmailSequenceTools(
  name: string,
  args: Record<string, unknown>,
  client: MagnetLabClient
): Promise<unknown> {
  switch (name) {
    case 'magnetlab_get_email_sequence':
      return client.getEmailSequence(args.lead_magnet_id as string);

    case 'magnetlab_generate_email_sequence':
      return client.generateEmailSequence({
        leadMagnetId: args.lead_magnet_id as string,
        useAI: args.use_ai as boolean | undefined,
      });

    case 'magnetlab_update_email_sequence': {
      const emails = args.emails as
        | Array<{
            day: number;
            subject: string;
            body: string;
            reply_trigger?: string;
            replyTrigger?: string;
          }>
        | undefined;

      return client.updateEmailSequence(args.lead_magnet_id as string, {
        emails: emails?.map((e) => ({
          day: e.day,
          subject: e.subject,
          body: e.body,
          replyTrigger: e.reply_trigger || e.replyTrigger || '',
        })),
        status: args.status as 'draft' | 'active' | undefined,
      });
    }

    case 'magnetlab_activate_email_sequence': {
      const leadMagnetId = args.lead_magnet_id as string;

      // Fetch sequence and validate before activating
      const result = (await client.getEmailSequence(leadMagnetId)) as {
        emailSequence?: {
          emails?: Array<{ day?: number; subject?: string; body?: string }>;
        } | null;
      };

      if (!result?.emailSequence) {
        throw new Error(
          'No email sequence exists for this lead magnet. Generate one first with magnetlab_generate_email_sequence.'
        );
      }

      const emails = result.emailSequence.emails ?? [];
      if (emails.length === 0) {
        throw new Error('Email sequence has no emails. Generate or add emails before activating.');
      }

      const placeholderIssues = findPlaceholders(emails);
      if (placeholderIssues.length > 0) {
        throw new Error(
          'Cannot activate: emails contain template placeholders that must be replaced with real content.\n' +
            placeholderIssues.join('\n') +
            '\n\nUse magnetlab_update_email_sequence to fix these, then try activating again.'
        );
      }

      return client.activateEmailSequence(leadMagnetId);
    }

    default:
      throw new Error(`Unknown email sequence tool: ${name}`);
  }
}
