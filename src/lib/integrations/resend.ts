// Resend Email Client
// Used for sending transactional emails including welcome sequences

import crypto from 'crypto';
import { Resend } from 'resend';
import { logError } from '@/lib/utils/logger';

// Lazy initialization to ensure env vars are loaded
let defaultResendClient: Resend | null = null;

/**
 * Get the default (platform) Resend client
 */
export function getResendClient(): Resend {
  if (!defaultResendClient) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error('RESEND_API_KEY is not set in environment variables');
    }
    defaultResendClient = new Resend(apiKey);
  }
  return defaultResendClient;
}

/**
 * Create a Resend client with a user's API key
 */
export function createResendClient(apiKey: string): Resend {
  return new Resend(apiKey);
}

// Default sender configuration
export const DEFAULT_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'hello@sends.magnetlab.app';
export const DEFAULT_FROM_NAME = process.env.RESEND_FROM_NAME || 'MagnetLab';

/**
 * Resend configuration for sending emails
 */
export interface ResendConfig {
  apiKey?: string;
  fromEmail?: string;
  fromName?: string;
}

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  fromName?: string;
  fromEmail?: string;
  replyTo?: string;
  /** Optional: Use a custom Resend API key instead of the default */
  resendConfig?: ResendConfig;
}

/**
 * Send a single email via Resend
 * If resendConfig.apiKey is provided, uses the user's Resend account
 * Otherwise uses the default MagnetLab Resend account
 */
export async function sendEmail(params: SendEmailParams): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    // Use user's API key if provided, otherwise use default
    const resend = params.resendConfig?.apiKey
      ? createResendClient(params.resendConfig.apiKey)
      : getResendClient();

    // Priority: params > resendConfig > defaults
    const fromName = params.fromName || params.resendConfig?.fromName || DEFAULT_FROM_NAME;
    const fromEmail = params.fromEmail || params.resendConfig?.fromEmail || DEFAULT_FROM_EMAIL;

    const { data, error } = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: params.to,
      subject: params.subject,
      html: params.html,
      replyTo: params.replyTo || fromEmail,
    });

    if (error) {
      logError('integrations/resend', error);
      return { success: false, error: error.message };
    }

    return { success: true, id: data?.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logError('integrations/resend', error, { action: 'send_email' });
    return { success: false, error: message };
  }
}

/**
 * Convert plain text email body to HTML
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function emailBodyToHtml(body: string, senderName?: string): string {
  // Replace {{first_name}} placeholder for display
  const processedBody = body.replace(/\{\{first_name\}\}/g, '{{first_name}}');

  // Replace newlines with <br> and wrap in paragraphs
  const paragraphs = processedBody.split('\n\n');
  const htmlContent = paragraphs
    .map(p => {
      // Replace single newlines with <br>
      const lines = p.split('\n').join('<br>');
      return `<p style="margin: 0 0 16px 0;">${lines}</p>`;
    })
    .join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    p { margin: 0 0 16px 0; }
    a { color: #8b5cf6; }
  </style>
</head>
<body>
  ${htmlContent}
</body>
</html>`;
}

/**
 * Personalize email body by replacing placeholders
 */
export function personalizeEmail(body: string, data: { firstName?: string; email?: string }): string {
  let personalized = body;

  if (data.firstName) {
    personalized = personalized.replace(/\{\{first_name\}\}/g, data.firstName);
  } else {
    // Fallback to "there" if no first name
    personalized = personalized.replace(/\{\{first_name\}\}/g, 'there');
  }

  if (data.email) {
    personalized = personalized.replace(/\{\{email\}\}/g, data.email);
  }

  return personalized;
}

/**
 * Generate an HMAC token for unsubscribe link verification
 */
export function generateUnsubscribeToken(subscriberId: string): string {
  return crypto
    .createHmac('sha256', process.env.NEXTAUTH_SECRET || 'fallback')
    .update(subscriberId)
    .digest('hex')
    .slice(0, 32);
}

/**
 * Generate a full unsubscribe URL with HMAC token
 */
export function generateUnsubscribeUrl(subscriberId: string): string {
  const baseUrl = process.env.NEXTAUTH_URL || 'https://magnetlab.app';
  const token = generateUnsubscribeToken(subscriberId);
  return `${baseUrl}/api/email/unsubscribe?sid=${subscriberId}&token=${token}`;
}

/**
 * Build an HTML footer with unsubscribe link for emails
 */
export function buildEmailFooterHtml(subscriberId: string): string {
  const unsubscribeUrl = generateUnsubscribeUrl(subscriberId);
  return `
    <div style="font-size: 12px; color: #999; text-align: center; padding: 20px 0;">
      <hr style="border: none; border-top: 1px solid #eee; margin: 0 0 16px 0;" />
      <p style="margin: 0 0 8px 0;">You're receiving this because you subscribed to our emails.</p>
      <p style="margin: 0;"><a href="${unsubscribeUrl}" style="color: #999; text-decoration: underline;">Unsubscribe</a></p>
    </div>`;
}
