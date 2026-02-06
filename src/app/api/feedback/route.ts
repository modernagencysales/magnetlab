import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { ApiErrors, logApiError } from '@/lib/api/errors';

// Linear constants
const LINEAR_API_URL = 'https://api.linear.app/graphql';
const TEAM_ID = 'c7f962be-0a7e-470b-9d61-ccf0808aaa7d';
const TRIAGE_STATE_ID = 'f2412f79-de1d-4cf5-a7ff-2e5f9308280a';

// Repo context — change these when porting to other repos
const REPO_NAME = 'magnetlab';
const REPO_URL = 'https://github.com/modernagencysales/magnetlab';

// Label IDs
const LABELS = {
  bug: '46e41c8b-4582-484b-8b00-01c9c8d82dd3',
  feature: '5a97afe8-f69c-4828-acba-8bff6cb2586d',
  improvement: '9b52111a-b4ff-4088-9d7c-7d07b842a27c',
  magnetlab: '46736281-ed8d-4f9d-8d2d-f6eb9d25a6a6',
} as const;

// Priority mapping: severity -> Linear priority int
const PRIORITY_MAP: Record<string, number> = {
  critical: 1, // Urgent
  high: 2,     // High
  medium: 3,   // Medium
  low: 4,      // Low
};

const feedbackSchema = z.object({
  type: z.enum(['bug', 'feature', 'feedback']),
  severity: z.enum(['critical', 'high', 'medium', 'low']).optional(),
  title: z.string().min(1).max(120),
  description: z.string().min(1).max(2000),
  metadata: z.object({
    url: z.string(),
    userEmail: z.string().nullable(),
    userId: z.string().nullable(),
    browser: z.string(),
    os: z.string(),
    screenResolution: z.string(),
    appName: z.string(),
    appVersion: z.string(),
    timestamp: z.string(),
  }),
});

// Cache the "User Reported" label ID so we only create it once per process
let userReportedLabelId: string | null = null;

async function getOrCreateUserReportedLabel(apiKey: string): Promise<string> {
  if (userReportedLabelId) return userReportedLabelId;

  // Search for existing label
  const searchRes = await fetch(LINEAR_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: apiKey,
    },
    body: JSON.stringify({
      query: `query { issueLabels(filter: { name: { eq: "User Reported" }, team: { id: { eq: "${TEAM_ID}" } } }) { nodes { id name } } }`,
    }),
  });

  const searchData = await searchRes.json();
  const existing = searchData?.data?.issueLabels?.nodes?.[0];

  if (existing) {
    userReportedLabelId = existing.id;
    return existing.id;
  }

  // Create label
  const createRes = await fetch(LINEAR_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: apiKey,
    },
    body: JSON.stringify({
      query: `mutation { issueLabelCreate(input: { name: "User Reported", color: "#8B5CF6", teamId: "${TEAM_ID}" }) { success issueLabel { id } } }`,
    }),
  });

  const createData = await createRes.json();
  const newId = createData?.data?.issueLabelCreate?.issueLabel?.id;

  if (newId) {
    userReportedLabelId = newId;
    return newId;
  }

  // If label creation failed (e.g. race condition), try search again
  const retryRes = await fetch(LINEAR_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: apiKey,
    },
    body: JSON.stringify({
      query: `query { issueLabels(filter: { name: { eq: "User Reported" }, team: { id: { eq: "${TEAM_ID}" } } }) { nodes { id } } }`,
    }),
  });

  const retryData = await retryRes.json();
  const retryId = retryData?.data?.issueLabels?.nodes?.[0]?.id;

  if (retryId) {
    userReportedLabelId = retryId;
    return retryId;
  }

  throw new Error('Failed to get or create "User Reported" label');
}

function getTypeLabel(type: string): string {
  if (type === 'bug') return LABELS.bug;
  if (type === 'feature') return LABELS.feature;
  return LABELS.improvement; // 'feedback' maps to Improvement
}

function buildDescription(
  userDescription: string,
  metadata: z.infer<typeof feedbackSchema>['metadata']
): string {
  return `${userDescription}

---

| Field | Value |
|-------|-------|
| **URL** | ${metadata.url || 'N/A'} |
| **Email** | ${metadata.userEmail || 'Anonymous'} |
| **User ID** | ${metadata.userId || 'N/A'} |
| **Browser** | ${metadata.browser} |
| **OS** | ${metadata.os} |
| **Screen** | ${metadata.screenResolution} |
| **App** | ${metadata.appName} v${metadata.appVersion} |
| **Repo** | [${REPO_NAME}](${REPO_URL}) |
| **Timestamp** | ${metadata.timestamp} |`;
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.LINEAR_API_KEY;
    if (!apiKey) {
      logApiError('feedback', new Error('LINEAR_API_KEY not configured'));
      return ApiErrors.internalError('Feedback system is not configured');
    }

    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const body = await request.json();
    const parsed = feedbackSchema.safeParse(body);

    if (!parsed.success) {
      return ApiErrors.validationError('Invalid feedback data', parsed.error.flatten());
    }

    const { type, severity, title, description, metadata } = parsed.data;

    // Get label IDs
    const userReportedId = await getOrCreateUserReportedLabel(apiKey);
    const labelIds = [getTypeLabel(type), LABELS.magnetlab, userReportedId];

    // Determine priority
    const priority = type === 'bug' && severity ? (PRIORITY_MAP[severity] ?? 0) : 0;

    // Build issue
    const issueTitle = `[MagnetLab] ${title}`;
    const issueDescription = buildDescription(description, metadata);

    const mutation = `
      mutation CreateFeedbackIssue($input: IssueCreateInput!) {
        issueCreate(input: $input) {
          success
          issue {
            id
            identifier
            url
          }
        }
      }
    `;

    const res = await fetch(LINEAR_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: apiKey,
      },
      body: JSON.stringify({
        query: mutation,
        variables: {
          input: {
            teamId: TEAM_ID,
            title: issueTitle,
            description: issueDescription,
            priority,
            stateId: TRIAGE_STATE_ID,
            labelIds,
          },
        },
      }),
    });

    const data = await res.json();

    if (data.errors) {
      logApiError('feedback/linear', new Error(JSON.stringify(data.errors)), { type, title });
      return ApiErrors.internalError('Failed to create feedback issue');
    }

    const issue = data.data?.issueCreate?.issue;

    if (!issue) {
      logApiError('feedback/linear', new Error('No issue returned'), { data });
      return ApiErrors.internalError('Failed to create feedback issue');
    }

    return NextResponse.json({
      success: true,
      issueId: issue.identifier,
      issueUrl: issue.url,
    });
  } catch (error) {
    logApiError('feedback', error);
    return ApiErrors.internalError('Failed to send feedback');
  }
}
