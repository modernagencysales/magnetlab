export type FeedbackType = 'bug' | 'feature' | 'feedback';

export type BugSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface FeedbackPayload {
  type: FeedbackType;
  severity?: BugSeverity;
  title: string;
  description: string;
  metadata: FeedbackMetadata;
}

export interface FeedbackMetadata {
  url: string;
  userEmail: string | null;
  userId: string | null;
  browser: string;
  os: string;
  screenResolution: string;
  appName: string;
  appVersion: string;
  timestamp: string;
}

export interface FeedbackResponse {
  success: boolean;
  issueId?: string;
  issueUrl?: string;
  error?: string;
}
