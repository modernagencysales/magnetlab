// Fathom integration -- webhook-based (no OAuth)
// Webhook handler: src/app/api/webhooks/fathom/[userId]/route.ts
// Settings UI: src/components/settings/FathomSettings.tsx

export interface FathomWebhookPayload {
  call_id?: string;
  id?: string;
  meeting_id?: string;
  title?: string;
  created_at?: string;
  date?: string;
  duration?: number;
  duration_seconds?: number;
  duration_minutes?: number;
  attendees?: string[];
  participants?: string[];
  transcript?: string;
  transcript_text?: string;
}
