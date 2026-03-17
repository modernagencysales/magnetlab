# Email Marketing Integrations

Kit, MailerLite, Mailchimp (OAuth), ActiveCampaign. Connect in Settings, map funnels to list+tag. Leads auto-subscribed on opt-in (fire-and-forget).

## Providers

| Provider | Auth | Subscribe |
|----------|------|-----------|
| Kit | API key | Form subscribe + tag |
| MailerLite | Bearer | POST /subscribers |
| Mailchimp | OAuth | Member upsert + tag |
| ActiveCampaign | Api-Token | Contact + list + tag |

## Routes

`email-marketing/connect`, `disconnect`, `verify`, `lists`, `tags`, `connected` | `mailchimp/authorize`, `callback`

## Data

`user_integrations` (credentials) | `funnel_integrations` (per-funnel mappings)
