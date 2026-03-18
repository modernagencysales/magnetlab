# Unipile API Reference — magnetlab

> Verified 2026-03-18 from https://developer.unipile.com

## Authentication

All requests require `X-API-KEY` header (or `Access-Token` header).
Base URL: `https://{UNIPILE_DSN}/api/v1`

---

## Posts

### Create a Post
```
POST /api/v1/posts
Content-Type: multipart/form-data
```

**Fields:**
- `account_id` (required) — Unipile account ID
- `text` (required) — Post content
- `attachments` — File upload (image, PDF, etc.) via multipart form-data

**Response:**
```json
{
  "object": "PostCreated",
  "post_id": "7368649927968571392"
}
```

**Notes:**
- Supports image attachments via multipart/form-data file upload
- Returns `post_id` (used as `linkedin_post_id` / social_id)

### Retrieve a Post
```
GET /api/v1/posts/{post_id}?account_id={account_id}
```

**Response:**
```json
{
  "object": "Post",
  "provider": "LINKEDIN",
  "social_id": "urn:li:activity:7332661864792854528",
  "share_url": "https://www.linkedin.com/posts/...",
  "date": "3d",
  "parsed_datetime": "2025-05-26T19:01:02.468Z",
  "comment_counter": 0,
  "impressions_counter": 0,
  "reaction_counter": 6,
  "repost_counter": 0,
  "permissions": {
    "can_post_comments": true,
    "can_react": true,
    "can_share": true
  },
  "text": "Post content...",
  "attachments": [{
    "id": "D4D22AQE5ozOIW8_vfQ",
    "type": "img",
    "url": "https://media.licdn.com/..."
  }],
  "author": {
    "public_identifier": "username",
    "name": "Company Name",
    "is_company": true
  },
  "is_repost": false,
  "id": "7332661864792854528"
}
```

### List Comments on a Post
```
GET /api/v1/posts/{post_id}/comments?account_id={account_id}
```

### List Reactions on a Post
```
GET /api/v1/posts/{post_id}/reactions?account_id={account_id}
```

---

## Comments

### Comment on a Post
```
POST /api/v1/posts/{post_id}/comments
Content-Type: application/json
```

**Body:**
```json
{
  "account_id": "7ioiu6zHRO67yQBazvXDuQ",
  "text": "Hey"
}
```

**Thread reply (reply to specific comment):**
```json
{
  "account_id": "7ioiu6zHRO67yQBazvXDuQ",
  "text": "Hi {{0}}, thanks",
  "comment_id": "7335000001439513601",
  "mentions": [{
    "name": "John Doe",
    "profile_id": "ACoAASss4UBzQV9fDt_ziQ45zzpCVnAhxbW"
  }]
}
```

**Notes:**
- `post_id` MUST use `social_id` format (e.g., `urn:li:activity:XXXX`) for reliability
- Supports `{{0}}`, `{{1}}` mention placeholders with `mentions` array
- Supports `\n` for line breaks
- `comment_id` for replying to a specific comment within a thread
- ANY account can comment on a PUBLIC post (cross-account commenting works)

---

## Reactions

### Add a Reaction to a Post
```
POST /api/v1/posts/reaction
```

**Body:**
```json
{
  "account_id": "7ioiu6zHRO67yQBazvXDuQ",
  "post_id": "urn:li:activity:7332661864792854528",
  "reaction_type": "LIKE"
}
```

**Notes:**
- Can react to posts OR comments
- Reaction types: LIKE, CELEBRATE, LOVE, INSIGHTFUL, FUNNY, SUPPORT

---

## Messaging (DMs)

### Start a New Chat (Send DM)
```
POST /api/v1/chats
Content-Type: multipart/form-data
```

**Fields:**
- `account_id` (required) — Sending account's Unipile ID
- `attendees_ids` (required) — Recipient's provider_id (LinkedIn internal ID)
- `text` (required) — Message content
- `attachments` (optional) — File attachment, max 15MB

**Example (cURL):**
```bash
curl --request POST \
  --url https://{DSN}/api/v1/chats \
  --header 'X-API-KEY: {TOKEN}' \
  --header 'content-type: multipart/form-data' \
  --form account_id=Yk08cDzzdsqs9_8ds \
  --form 'text=Hello world!' \
  --form attendees_ids=ACoAAAcDMMQBODyLwZrRcgYhrkCafURGqva0U4E
```

**Example (Node.js SDK):**
```javascript
const response = await client.messaging.startNewChat({
  account_id: 'Yk08cDzzdsqs9_8ds',
  text: 'Hello world!',
  attendees_ids: ['ACoAAAcDMMQBODyLwZrRcgYhrkCafURGqva0U4E'],
});
```

**LinkedIn InMail (Premium only):**
```bash
--form linkedin[api]=classic \
--form linkedin[inmail]=true
```

**Notes:**
- Creates chat if it doesn't exist, syncs user if not already an attendee
- Regular LinkedIn messages require existing connection (must be 1st-degree)
- Use invitation API to establish connections first

### Send Message in Existing Chat
```
POST /api/v1/chats/{chat_id}/messages
Content-Type: multipart/form-data
```

**Fields:**
- `text` (required) — Message content
- `attachments` (optional) — File attachment

---

## Users & Invitations

### Retrieve a User Profile
```
GET /api/v1/users/{identifier}?account_id={account_id}
```

- `identifier` — LinkedIn public_identifier (username from profile URL)
- Returns full profile including `provider_id` (needed for DMs and invitations)

**Notes:**
- ~100 profile retrievals per day per account
- Needed to convert public username → private provider_id

### Send Invitation (Connection Request)
```
POST /api/v1/users/invite
Content-Type: application/json
```

**Body:**
```json
{
  "provider_id": "ACoAAAEkwwAB9KEc2TrQgOLEQ-vzRyZeCDyc6DQ",
  "account_id": "tvKrFOnCQEeTTpO3GNklng",
  "message": "Hello\nWorld"
}
```

**Example (Node.js SDK):**
```javascript
await client.users.sendInvitation({
  account_id: '3H-KVe-mQ2GT9M0hKSkgHgs',
  provider_id: 'ACoAAAcDMMQBODyLwZrRcgYhrkCafURGqva0U4E',
  message: 'Hello',
});
```

**Notes:**
- Requires `provider_id` (get via profile retrieval first)
- `message` is optional — invitations without notes have higher accept rate on free accounts
- LinkedIn restricts invitations from new/low-engagement accounts
- Free accounts: ~150 invitations/week without note, ~5/month with note
- Paid accounts: 80-100/day, ~200/week

### List Received Invitations
```
GET /api/v1/users/invite/received?account_id={account_id}
```

Returns list of pending connection requests received.

### Accept/Decline an Invitation
```
POST /api/v1/users/invite/received/{invitation_id}
```

**Body:**
```json
{
  "action": "accept"
}
```

Action values: `accept` or `decline`

### List Sent Invitations
```
GET /api/v1/users/invite/sent?account_id={account_id}
```

Returns pending sent invitations (useful for tracking which haven't been accepted).

### Cancel a Sent Invitation
```
DELETE /api/v1/users/invite/{invitation_id}
```

### List Relations (Connections)
```
GET /api/v1/users/relations?account_id={account_id}
```

Returns all 1st-degree connections, sorted by recently added.

---

## Detecting Accepted Invitations

Three methods (from most to least real-time):

### 1. New Message Webhook (fastest, limited)
- Only works if invitation included a message
- Accepting creates a chat with the invite message
- Monitor via "new message" webhook
- Near real-time

### 2. New Relation Webhook (reliable, delayed)
- Webhook type: "USERS WEBHOOK", event: "new_relation"
- **NOT real-time** — LinkedIn doesn't support real-time events
- Unipile polls at random intervals
- Latency: **up to 8 hours** after acceptance

**Webhook payload:**
```json
{
  "user_full_name": "...",
  "user_provider_id": "...",
  "user_public_identifier": "...",
  "profile_url": "...",
  "picture_url": "..."
}
```

### 3. Periodic Polling (manual)
- Poll relations list sorted by recently added
- Compare against sent invitations
- Space checks few times per day with random delay
- Most control, but requires tracking state

**Recommendation for our use case:** Use Method 3 (polling) since we already have
a 20-min poll cycle. The 8-hour webhook delay is too slow for our DM delivery.

---

## LinkedIn Post ID Formats

LinkedIn uses multiple ID formats for the same post. **Always use `social_id` for interactions.**

| URL contains | ID format |
|---|---|
| `activity` | `urn:li:activity:7332661864792854528` |
| `ugcPost` | `urn:li:ugcPost:7336013677930006817` |
| `share` | `urn:li:share:7336013677930006817` |

**Extracting from URL:** Parse the numeric portion from the URL path.

---

## LinkedIn Limits (via Unipile)

| Action | Daily limit | Weekly limit | Notes |
|---|---|---|---|
| Connection requests (paid) | 80-100 | ~200 | We use 10/day (very conservative) |
| Connection requests (free, no note) | — | ~150 | Higher weekly but no message |
| Connection requests (free, with note) | — | ~5/month | Very limited |
| Profile retrievals | ~100 | — | Needed for provider_id lookup |
| Profile retrievals (Sales Nav) | ~2,000 | — | With recruiter/SN license |
| Posts, comments, reactions, messages | ~100 each | — | Per action type |
| InMail (free InMail credits) | 30-50 recommended | — | ~800/month cap |

**General guidance:**
- Space calls randomly, not at fixed intervals
- Use real accounts with 150+ connections minimum
- New/inactive accounts: start low, increase gradually
- Our safety limits are well within Unipile's recommendations

---

## Accounts

### List All Accounts
```
GET /api/v1/accounts
```

### Retrieve an Account
```
GET /api/v1/accounts/{id}
```

### Connect via Hosted Auth
```
POST /api/v1/hosted/request-link
```

Returns a URL for the user to authenticate their LinkedIn account.

### Delete an Account
```
DELETE /api/v1/accounts/{id}
```

---

## Webhooks

### Create a Webhook
```
POST /api/v1/webhooks
```

### Available Webhook Events
- `new_message` — New chat message received
- `new_relation` — New connection (accepted invitation)
- `account_status` — Account connection status changes
- `new_email` — New email received
- `calendar_event` — Calendar event created/updated/deleted

---

## Node.js SDK

```bash
npm install unipile-node-sdk
```

```javascript
import { UnipileClient } from 'unipile-node-sdk';
const client = new UnipileClient('https://{DSN}', '{ACCESS_TOKEN}');

// Posts
await client.post.createPost({ account_id, text, attachments });
await client.post.getPost(post_id, { account_id });

// Comments
await client.post.sendComment(post_id, { account_id, text });

// Reactions
await client.post.addReaction({ account_id, post_id, reaction_type });

// Messaging
await client.messaging.startNewChat({ account_id, attendees_ids, text });
await client.messaging.sendMessage({ chat_id, text });

// Users
await client.users.getProfile(identifier, { account_id });
await client.users.sendInvitation({ account_id, provider_id, message });
await client.users.listInvitationsReceived({ account_id });
await client.users.handleInvitation(invitation_id, { action: 'accept' });
```
