import { task, wait } from "@trigger.dev/sdk/v3";
import {
  sendEmail,
  emailBodyToHtml,
  personalizeEmail,
  buildEmailFooterHtml,
} from "@/lib/integrations/resend";
import {
  getSenderInfo,
  getUserResendConfig,
} from "@/lib/services/email-sequence-trigger";
import { createSupabaseAdminClient } from "@/lib/utils/supabase-server";

// ============================================
// TYPES
// ============================================

export interface ExecuteEmailFlowPayload {
  team_id: string;
  flow_id: string;
  contact_id: string; // email_flow_contacts.id
  subscriber_id: string; // email_subscribers.id
  subscriber_email: string;
  subscriber_first_name: string | null;
  user_id: string; // flow owner, for sender resolution
}

interface FlowStep {
  id: string;
  step_number: number;
  subject: string;
  body: string;
  delay_days: number;
}

// ============================================
// HELPERS
// ============================================

/**
 * Check if the subscriber is still active (not unsubscribed or bounced)
 */
async function isSubscriberActive(subscriberId: string): Promise<boolean> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("email_subscribers")
    .select("status")
    .eq("id", subscriberId)
    .single();

  return data?.status === "active";
}

// ============================================
// TASK
// ============================================

/**
 * Execute an email flow for a single contact.
 * Walks through all steps in order, waiting the configured delay between each.
 * Checks subscriber status before each send to respect unsubscribes.
 */
export const executeEmailFlow = task({
  id: "execute-email-flow",
  retry: {
    maxAttempts: 2,
  },
  run: async (payload: ExecuteEmailFlowPayload) => {
    const {
      team_id,
      flow_id,
      contact_id,
      subscriber_id,
      subscriber_email,
      subscriber_first_name,
      user_id,
    } = payload;

    const supabase = createSupabaseAdminClient();

    console.log(
      `Executing email flow ${flow_id} for ${subscriber_email} (contact: ${contact_id})`
    );

    // 1. Fetch all steps for this flow, ordered by step_number
    const { data: steps, error: stepsError } = await supabase
      .from("email_flow_steps")
      .select("id, step_number, subject, body, delay_days")
      .eq("flow_id", flow_id)
      .order("step_number", { ascending: true });

    if (stepsError) {
      console.error("Failed to fetch flow steps:", stepsError.message);
      throw new Error(`Failed to fetch flow steps: ${stepsError.message}`);
    }

    if (!steps || steps.length === 0) {
      console.log(`No steps found for flow ${flow_id}`);
      return { status: "no_steps" as const };
    }

    // 2. Resolve sender info and Resend config in parallel
    const [senderInfo, resendConfig] = await Promise.all([
      getSenderInfo(user_id),
      getUserResendConfig(user_id),
    ]);

    const senderName = resendConfig?.fromName || senderInfo.senderName;
    const senderEmail = resendConfig?.fromEmail || senderInfo.senderEmail;

    console.log(
      `Resolved sender: ${senderName} <${senderEmail || "default"}>` +
        (resendConfig ? " (custom Resend)" : "")
    );

    // 3. Update flow contact status to 'active'
    await supabase
      .from("email_flow_contacts")
      .update({ status: "active" })
      .eq("id", contact_id);

    // 4. Walk through each step
    const typedSteps = steps as FlowStep[];
    let stepsSent = 0;

    for (const step of typedSteps) {
      // 4a. Check subscriber status before sending
      const active = await isSubscriberActive(subscriber_id);
      if (!active) {
        console.log(
          `Subscriber ${subscriber_email} is no longer active, stopping flow`
        );
        await supabase
          .from("email_flow_contacts")
          .update({ status: "unsubscribed" })
          .eq("id", contact_id);

        return {
          status: "unsubscribed" as const,
          stepsSent,
          stoppedAtStep: step.step_number,
        };
      }

      // 4b. Wait for the configured delay
      if (step.delay_days > 0) {
        console.log(
          `Waiting ${step.delay_days} day(s) before step ${step.step_number}`
        );
        await wait.for({ days: step.delay_days });

        // 4c. Re-check subscriber status after the wait
        const stillActive = await isSubscriberActive(subscriber_id);
        if (!stillActive) {
          console.log(
            `Subscriber ${subscriber_email} unsubscribed during wait, stopping flow`
          );
          await supabase
            .from("email_flow_contacts")
            .update({ status: "unsubscribed" })
            .eq("id", contact_id);

          return {
            status: "unsubscribed" as const,
            stepsSent,
            stoppedAtStep: step.step_number,
          };
        }
      }

      // 4d. Personalize subject and body
      const firstName = subscriber_first_name || undefined;
      const personalizedBody = personalizeEmail(step.body, {
        firstName,
        email: subscriber_email,
      });
      const personalizedSubject = subscriber_first_name
        ? step.subject.replace(/\{\{first_name\}\}/g, subscriber_first_name)
        : step.subject.replace(/\{\{first_name\}\}/g, "there");

      // 4e. Convert body to HTML
      const htmlBody = emailBodyToHtml(personalizedBody, senderName);

      // 4f. Append unsubscribe footer
      const footer = buildEmailFooterHtml(subscriber_id);
      const fullHtml = htmlBody.replace("</body>", `${footer}</body>`);

      // 4g. Send the email
      console.log(
        `Sending step ${step.step_number} to ${subscriber_email}: "${personalizedSubject}"`
      );

      const result = await sendEmail({
        to: subscriber_email,
        subject: personalizedSubject,
        html: fullHtml,
        fromName: senderName,
        fromEmail: senderEmail,
        replyTo: senderEmail,
        resendConfig,
      });

      if (!result.success) {
        console.error(
          `Failed to send step ${step.step_number} to ${subscriber_email}:`,
          result.error
        );
        throw new Error(
          `Email send failed at step ${step.step_number}: ${result.error}`
        );
      }

      console.log(
        `Step ${step.step_number} sent successfully, id: ${result.id}`
      );

      // 4h. Insert tracking event
      await supabase.from("email_events").insert({
        email_id: result.id || `flow-${flow_id}-step-${step.step_number}`,
        user_id,
        event_type: "sent",
        recipient_email: subscriber_email,
        subject: personalizedSubject,
        metadata: {
          flow_id,
          step_number: step.step_number,
          contact_id,
          team_id,
        },
      });

      // 4i. Update flow contact progress
      await supabase
        .from("email_flow_contacts")
        .update({
          current_step: step.step_number,
          last_sent_at: new Date().toISOString(),
        })
        .eq("id", contact_id);

      stepsSent++;
    }

    // 5. Mark flow contact as completed
    await supabase
      .from("email_flow_contacts")
      .update({ status: "completed" })
      .eq("id", contact_id);

    console.log(
      `Flow ${flow_id} completed for ${subscriber_email}: ${stepsSent} steps sent`
    );

    return { status: "completed" as const, stepsSent };
  },
});
