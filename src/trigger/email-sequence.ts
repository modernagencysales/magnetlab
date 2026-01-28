import { task, wait } from "@trigger.dev/sdk/v3";
import { sendEmail, emailBodyToHtml, personalizeEmail, type ResendConfig } from "@/lib/integrations/resend";
import type { Email } from "@/lib/types/email";

// ============================================
// TYPES
// ============================================

export interface ScheduleEmailSequencePayload {
  leadId: string;
  leadEmail: string;
  leadName: string | null;
  leadMagnetId: string;
  leadMagnetTitle: string;
  senderName: string;
  senderEmail?: string;
  emails: Email[];
  /** Optional: User's own Resend account config */
  resendConfig?: ResendConfig;
}

export interface SendSequenceEmailPayload {
  leadId: string;
  leadEmail: string;
  leadName: string | null;
  leadMagnetTitle: string;
  senderName: string;
  senderEmail?: string;
  email: Email;
  sequenceIndex: number;
  /** Optional: User's own Resend account config */
  resendConfig?: ResendConfig;
}

// ============================================
// TASKS
// ============================================

/**
 * Main task: Schedule all emails in a sequence
 * Called when a lead opts in and the sequence is active
 */
export const scheduleEmailSequence = task({
  id: "schedule-email-sequence",
  retry: {
    maxAttempts: 3,
  },
  run: async (payload: ScheduleEmailSequencePayload) => {
    const { emails, resendConfig, ...commonPayload } = payload;

    console.log(`Scheduling ${emails.length} emails for lead ${payload.leadEmail}${resendConfig ? ' (custom Resend)' : ''}`);

    // Schedule each email with appropriate delay
    for (let i = 0; i < emails.length; i++) {
      const email = emails[i];
      const delayDays = email.day;

      const emailPayload: SendSequenceEmailPayload = {
        ...commonPayload,
        email,
        sequenceIndex: i,
        resendConfig,
      };

      // For day 0, send immediately
      // For day 1+, wait the appropriate number of days
      if (delayDays === 0) {
        // Send immediately
        await sendSequenceEmail.trigger(emailPayload);
      } else {
        // Schedule with delay
        await sendSequenceEmail.trigger(emailPayload, {
          delay: `${delayDays}d`,
        });
      }

      console.log(`Scheduled email ${i + 1} (Day ${delayDays}) for ${payload.leadEmail}`);
    }

    return {
      success: true,
      scheduledCount: emails.length,
      leadEmail: payload.leadEmail,
    };
  },
});

/**
 * Send a single email from the sequence
 */
export const sendSequenceEmail = task({
  id: "send-sequence-email",
  retry: {
    maxAttempts: 3,
  },
  run: async (payload: SendSequenceEmailPayload) => {
    const { leadId, leadEmail, leadName, senderName, senderEmail, email, sequenceIndex, resendConfig } = payload;

    console.log(`Sending email ${sequenceIndex + 1} (Day ${email.day}) to ${leadEmail}${resendConfig ? ' (custom Resend)' : ''}`);

    // Personalize the email body
    const firstName = leadName?.split(' ')[0] || undefined;
    const personalizedBody = personalizeEmail(email.body, {
      firstName,
      email: leadEmail,
    });

    // Convert to HTML
    const htmlBody = emailBodyToHtml(personalizedBody, senderName);

    // Send via Resend (uses user's API key if provided via resendConfig)
    const result = await sendEmail({
      to: leadEmail,
      subject: email.subject,
      html: htmlBody,
      fromName: senderName,
      fromEmail: senderEmail,
      replyTo: senderEmail,
      resendConfig,
    });

    if (!result.success) {
      console.error(`Failed to send email to ${leadEmail}:`, result.error);
      throw new Error(`Email send failed: ${result.error}`);
    }

    console.log(`Successfully sent email ${sequenceIndex + 1} to ${leadEmail}, id: ${result.id}`);

    return {
      success: true,
      emailId: result.id,
      leadId,
      day: email.day,
      sequenceIndex,
    };
  },
});

/**
 * Alternative: Send all emails in sequence with waits (simpler but blocks the task)
 * Use this if you prefer a single long-running task instead of multiple scheduled tasks
 */
export const sendEmailSequenceSync = task({
  id: "send-email-sequence-sync",
  retry: {
    maxAttempts: 1, // Don't retry the whole sequence
  },
  run: async (payload: ScheduleEmailSequencePayload) => {
    const { emails, leadEmail, leadName, senderName, senderEmail, leadId, resendConfig } = payload;
    const firstName = leadName?.split(' ')[0] || undefined;

    const results: Array<{ day: number; success: boolean; emailId?: string; error?: string }> = [];

    for (let i = 0; i < emails.length; i++) {
      const email = emails[i];

      // Wait for the appropriate time (skip wait for day 0)
      if (i > 0) {
        const previousDay = emails[i - 1].day;
        const currentDay = email.day;
        const daysToWait = currentDay - previousDay;

        if (daysToWait > 0) {
          console.log(`Waiting ${daysToWait} day(s) before email ${i + 1}`);
          await wait.for({ days: daysToWait });
        }
      }

      // Personalize and send
      const personalizedBody = personalizeEmail(email.body, { firstName, email: leadEmail });
      const htmlBody = emailBodyToHtml(personalizedBody, senderName);

      const result = await sendEmail({
        to: leadEmail,
        subject: email.subject,
        html: htmlBody,
        fromName: senderName,
        fromEmail: senderEmail,
        replyTo: senderEmail,
        resendConfig,
      });

      results.push({
        day: email.day,
        success: result.success,
        emailId: result.id,
        error: result.error,
      });

      if (!result.success) {
        console.error(`Email ${i + 1} failed for ${leadEmail}:`, result.error);
        // Continue with next email even if one fails
      } else {
        console.log(`Email ${i + 1} sent successfully to ${leadEmail}`);
      }
    }

    return {
      leadId,
      leadEmail,
      totalEmails: emails.length,
      results,
    };
  },
});
