import { task } from "@trigger.dev/sdk/v3";
import { sendEmail, type ResendConfig } from "@/lib/integrations/resend";

// ============================================
// TYPES
// ============================================

export interface SendResourceEmailPayload {
  leadEmail: string;
  leadName: string;
  leadMagnetTitle: string;
  resourceUrl: string;
  senderName: string;
  senderEmail?: string;
  resendConfig?: ResendConfig;
}

// ============================================
// HTML TEMPLATE
// ============================================

function buildResourceEmailHtml(params: {
  firstName: string;
  leadMagnetTitle: string;
  resourceUrl: string;
  senderName: string;
}): string {
  const { firstName, leadMagnetTitle, resourceUrl, senderName } = params;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f9fafb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f9fafb;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; max-width: 600px;">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px 40px;">
              <p style="margin: 0 0 20px 0; font-size: 18px; line-height: 1.6; color: #1f2937;">
                Hi ${firstName},
              </p>
              <p style="margin: 0 0 30px 0; font-size: 16px; line-height: 1.6; color: #4b5563;">
                Here's the resource you requested:
              </p>
            </td>
          </tr>
          <!-- CTA Button -->
          <tr>
            <td align="center" style="padding: 0 40px 16px 40px;">
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="background-color: #8b5cf6; border-radius: 6px;">
                    <a href="${resourceUrl}" target="_blank" style="display: inline-block; padding: 14px 32px; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 6px;">View Your Resource &rarr;</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Lead Magnet Title -->
          <tr>
            <td align="center" style="padding: 0 40px 30px 40px;">
              <p style="margin: 0; font-size: 14px; line-height: 1.5; color: #6b7280;">
                ${leadMagnetTitle}
              </p>
            </td>
          </tr>
          <!-- Reply CTA -->
          <tr>
            <td style="padding: 0 40px 40px 40px;">
              <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #6b7280;">
                If you have any questions, just reply to this email.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #9ca3af;">
                Sent by ${senderName}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ============================================
// TASK
// ============================================

/**
 * Send a resource delivery email when a lead opts in.
 * Delivers the lead magnet resource URL with a branded HTML email.
 */
export const sendResourceEmail = task({
  id: "send-resource-email",
  retry: {
    maxAttempts: 3,
  },
  run: async (payload: SendResourceEmailPayload) => {
    const {
      leadEmail,
      leadName,
      leadMagnetTitle,
      resourceUrl,
      senderName,
      senderEmail,
      resendConfig,
    } = payload;

    const firstName = leadName?.split(" ")[0] || "there";

    console.log(
      `Sending resource email to ${leadEmail} for "${leadMagnetTitle}"${resendConfig ? " (custom Resend)" : ""}`
    );

    const html = buildResourceEmailHtml({
      firstName,
      leadMagnetTitle,
      resourceUrl,
      senderName,
    });

    const result = await sendEmail({
      to: leadEmail,
      subject: `Your ${leadMagnetTitle} is ready`,
      html,
      fromName: senderName,
      fromEmail: senderEmail,
      replyTo: senderEmail,
      resendConfig,
    });

    if (!result.success) {
      console.error(
        `Failed to send resource email to ${leadEmail}:`,
        result.error
      );
      throw new Error(`Resource email send failed: ${result.error}`);
    }

    console.log(
      `Successfully sent resource email to ${leadEmail}, id: ${result.id}`
    );

    return {
      success: true,
      emailId: result.id,
      leadEmail,
      leadMagnetTitle,
    };
  },
});
