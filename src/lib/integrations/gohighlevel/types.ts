// GoHighLevel API v1 Types

export interface GHLContactPayload {
  email: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  tags?: string[];
  source?: string;
  customField?: Record<string, string>;
}

export interface GHLContactResponse {
  contact: {
    id: string;
    email: string;
    tags: string[];
  };
}

export interface GHLErrorResponse {
  message?: string;
  error?: string;
  statusCode?: number;
}

export interface GHLSyncParams {
  userId: string;
  funnelPageId: string;
  lead: {
    email: string;
    name?: string | null;
    utmSource?: string | null;
    utmMedium?: string | null;
    utmCampaign?: string | null;
    isQualified?: boolean | null;
    qualificationAnswers?: Record<string, string> | null;
  };
  leadMagnetTitle: string;
  funnelSlug: string;
}
