// HeyReach API Types

export interface HeyReachSyncParams {
  userId: string;
  funnelPageId: string;
  lead: {
    email: string;
    name?: string | null;
    linkedinUrl?: string | null;
    utmSource?: string | null;
    utmMedium?: string | null;
    utmCampaign?: string | null;
    isQualified?: boolean | null;
    qualificationAnswers?: Record<string, string> | null;
  };
  leadMagnetTitle: string;
  leadMagnetUrl: string;
  funnelSlug: string;
}

export interface HeyReachContact {
  linkedinUrl?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  company?: string;
  customFields?: Record<string, string>;
}

export interface HeyReachCampaign {
  id: number;
  name: string;
  status: string;
  createdAt?: string;
}

export interface HeyReachLinkedInAccount {
  id: number;
  firstName: string;
  lastName: string;
  emailAddress: string;
  isActive: boolean;
  authIsValid: boolean;
  profileUrl: string;
}

export interface AddContactsResult {
  success: boolean;
  added: number;
  error?: string;
}
