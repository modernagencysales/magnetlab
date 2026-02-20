export type EmailMarketingProviderName = 'kit' | 'mailerlite' | 'mailchimp' | 'activecampaign';

export interface EmailMarketingList {
  id: string;
  name: string;
}

export interface EmailMarketingTag {
  id: string;
  name: string;
}

export interface SubscribeParams {
  listId: string;
  email: string;
  firstName?: string;
  tagId?: string;
}

export interface SubscribeResult {
  success: boolean;
  error?: string;
}

export interface EmailMarketingProvider {
  validateCredentials(): Promise<boolean>;
  getLists(): Promise<EmailMarketingList[]>;
  getTags(listId?: string): Promise<EmailMarketingTag[]>;
  subscribe(params: SubscribeParams): Promise<SubscribeResult>;
}

export interface ProviderCredentials {
  apiKey: string;
  metadata?: Record<string, string>;
}
