import { task } from "@trigger.dev/sdk/v3";
import {
  sendEmail,
  personalizeEmail,
  emailBodyToHtml,
  buildEmailFooterHtml,

} from "@/lib/integrations/resend";
import { getSenderInfo, getUserResendConfig } from "@/lib/services/email-sequence-trigger";
import { createSupabaseAdminClient } from "@/lib/utils/supabase-server";

// ============================================
// TYPES
// ============================================

export interface SendBroadcastPayload {
  broadcast_id: string;
  team_id: string;
  user_id: string; // broadcast creator, for sender resolution
}

interface FilteredSubscriber {
  subscriber_id: string;
  email: string;
  first_name: string | null;
}

// ============================================
// CONSTANTS
// ============================================

const BATCH_SIZE = 50;
const BATCH_DELAY_MS = 1000;

// ============================================
// TASK
// ============================================

/**
 * Send a broadcast email to all filtered subscribers.
 * Sends in batches of 50 with 1s delay between batches for rate limiting.
 * maxAttempts: 1 to avoid duplicate sends on retry.
 */
export const sendBroadcast = task({
  id: "send-broadcast",
  retry: {
    maxAttempts: 1,
  },
  run: async (payload: SendBroadcastPayload) => {
    const { broadcast_id, team_id, user_id } = payload;
    const supabase = createSupabaseAdminClient();

    console.log(`Starting broadcast ${broadcast_id} for team ${team_id}`);

    // 1. Fetch broadcast
    const { data: broadcast, error: broadcastError } = await supabase
      .from("email_broadcasts")
      .select("id, team_id, subject, body, audience_filter, status")
      .eq("id", broadcast_id)
      .single();

    if (broadcastError || !broadcast) {
      console.error(`Broadcast ${broadcast_id} not found:`, broadcastError?.message);
      return { status: "not_found" as const };
    }

    // 2. Get filtered subscribers via RPC
    const { data: subscribers, error: subscribersError } = await supabase.rpc(
      "get_filtered_subscribers",
      {
        p_team_id: team_id,
        p_filter: broadcast.audience_filter,
      }
    ) as { data: FilteredSubscriber[] | null; error: { message: string } | null };

    if (subscribersError) {
      console.error(`Failed to get subscribers for broadcast ${broadcast_id}:`, subscribersError.message);
      throw new Error(`Failed to get subscribers: ${subscribersError.message}`);
    }

    const subscriberList = subscribers || [];

    // 3. No subscribers — mark as sent with 0 recipients
    if (subscriberList.length === 0) {
      console.log(`Broadcast ${broadcast_id}: no subscribers match filter`);

      await supabase
        .from("email_broadcasts")
        .update({
          status: "sent",
          recipient_count: 0,
          sent_at: new Date().toISOString(),
        })
        .eq("id", broadcast_id);

      return { status: "sent" as const, count: 0 };
    }

    console.log(`Broadcast ${broadcast_id}: sending to ${subscriberList.length} subscribers`);

    // 4. Update recipient_count with actual subscriber count
    await supabase
      .from("email_broadcasts")
      .update({ recipient_count: subscriberList.length })
      .eq("id", broadcast_id);

    // 5. Resolve sender info in parallel
    const [senderInfo, resendConfig] = await Promise.all([
      getSenderInfo(user_id),
      getUserResendConfig(user_id),
    ]);

    const { senderName, senderEmail } = senderInfo;
    const fromName = resendConfig?.fromName || senderName;
    const fromEmail = resendConfig?.fromEmail || senderEmail;

    // 6. Send in batches of 50
    let sent = 0;
    let failed = 0;

    for (let i = 0; i < subscriberList.length; i += BATCH_SIZE) {
      const batch = subscriberList.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(subscriberList.length / BATCH_SIZE);

      console.log(`Broadcast ${broadcast_id}: sending batch ${batchNumber}/${totalBatches} (${batch.length} emails)`);

      const results = await Promise.allSettled(
        batch.map(async (subscriber) => {
          const firstName = subscriber.first_name || undefined;

          // Personalize subject (manual replacement for subject line)
          const personalizedSubject = firstName
            ? broadcast.subject.replace(/\{\{first_name\}\}/g, firstName)
            : broadcast.subject.replace(/\{\{first_name\}\}/g, "there");

          // Personalize body
          const personalizedBody = personalizeEmail(broadcast.body, {
            firstName,
            email: subscriber.email,
          });

          // Convert to HTML
          const htmlBody = emailBodyToHtml(personalizedBody);

          // Append unsubscribe footer
          const footer = buildEmailFooterHtml(subscriber.subscriber_id);
          const fullHtml = htmlBody.replace("</body>", `${footer}</body>`);

          // Send
          return sendEmail({
            to: subscriber.email,
            subject: personalizedSubject,
            html: fullHtml,
            fromName,
            fromEmail,
            replyTo: fromEmail || senderEmail,
            resendConfig,
          });
        })
      );

      // Track results
      for (const result of results) {
        if (result.status === "fulfilled" && result.value.success) {
          sent++;
        } else {
          failed++;
          if (result.status === "rejected") {
            console.error(`Broadcast ${broadcast_id}: send error:`, result.reason);
          } else if (!result.value.success) {
            console.error(`Broadcast ${broadcast_id}: send failed:`, result.value.error);
          }
        }
      }

      // Rate limit: pause between batches (skip after last batch)
      if (i + BATCH_SIZE < subscriberList.length) {
        await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
      }
    }

    console.log(`Broadcast ${broadcast_id} complete: ${sent} sent, ${failed} failed`);

    // 7. Update broadcast status
    const finalStatus = sent === 0 && failed > 0 ? "failed" : "sent";

    await supabase
      .from("email_broadcasts")
      .update({
        status: finalStatus,
        recipient_count: sent,
        sent_at: new Date().toISOString(),
      })
      .eq("id", broadcast_id);

    return {
      status: "sent" as const,
      sent,
      failed,
    };
  },
});
