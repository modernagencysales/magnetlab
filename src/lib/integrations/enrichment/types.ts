/** Email finder result */
export interface EmailFinderResult {
  email: string | null;
  confidence: number;
  provider?: string;
}

/** Email finder parameters - supports both camelCase and snake_case */
export interface EmailFinderParams {
  firstName?: string;
  lastName?: string;
  domain?: string;
  linkedinUrl?: string;
  company?: string;
  first_name?: string;
  last_name?: string;
  company_domain?: string;
  linkedin_url?: string;
}

/** Email finder provider interface */
export interface EmailFinderProvider {
  name: string;
  findEmail(params: EmailFinderParams): Promise<EmailFinderResult>;
  isConfigured(): boolean;
}

/** Email validation status */
export type EmailValidationStatus =
  | 'valid'
  | 'invalid'
  | 'catch_all'
  | 'unknown'
  | 'spamtrap'
  | 'abuse'
  | 'do_not_mail';

/** Email validation result */
export interface EmailValidationResult {
  email: string;
  status: EmailValidationStatus;
  is_valid: boolean;
  provider?: string;
}

/** Email validator provider interface */
export interface EmailValidatorProvider {
  name: string;
  validateEmail(email: string): Promise<EmailValidationResult>;
  isConfigured(): boolean;
}

/** Waterfall email finder result */
export interface WaterfallResult {
  email: string | null;
  provider: string | null;
  confidence: number;
  validated: boolean;
  validation_status?: string;
  attempts: Array<{
    provider: string;
    email?: string | null;
    error?: string;
  }>;
}
