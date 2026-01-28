// LeadShark API Client
// Base URL: https://apex.leadshark.io
// Auth: x-api-key header
// Rate Limits: 100/min, 250/hr, 1000/day

import { BaseApiClient, ApiResponse } from './base-client';
import type {
  LeadSharkAutomation,
  LeadSharkScheduledPost,
  LeadSharkEnrichmentResult,
} from '@/lib/types/integrations';

export interface LeadSharkConfig {
  apiKey: string;
}

// Automation creation - used for LinkedIn comment → DM automations
export interface CreateAutomationRequest {
  name: string;
  post_id: string;
  linkedin_post_url: string;
  keywords: string[];
  dm_template: string;
  auto_connect: boolean;
  auto_like: boolean;
  status?: 'Draft' | 'Running' | 'Paused';
  enable_follow_up?: boolean;
  follow_up_template?: string;
  follow_up_delay_minutes?: number;
  follow_up_only_if_no_response?: boolean;
  comment_reply_template?: string[];
  non_first_degree_reply_template?: string[];
}

// Scheduled post with optional pre-automation
export interface SchedulePostRequest {
  content: string;
  scheduled_time: string;
  is_public?: boolean;
  automation?: Partial<CreateAutomationRequest>;
}

// Bookmark for saving LinkedIn profiles
export interface CreateBookmarkRequest {
  linkedin_id: string;
  name: string;
  headline?: string;
  location?: string;
  profile_url?: string;
  profile_picture_url?: string;
  notes?: string;
  tags?: string[];
}

// Person enrichment sections
export type LinkedInSection =
  | 'experience'
  | 'education'
  | 'languages'
  | 'skills'
  | 'certifications'
  | 'about'
  | 'volunteering_experience'
  | 'projects'
  | 'recommendations_received'
  | 'recommendations_given';

export class LeadSharkClient extends BaseApiClient {
  constructor(config: LeadSharkConfig) {
    super({
      baseUrl: 'https://apex.leadshark.io',
      headers: {
        'x-api-key': config.apiKey,
      },
    });
  }

  // ============================================
  // ENRICHMENT
  // ============================================

  async enrichPerson(
    linkedinId: string,
    sections?: LinkedInSection[]
  ): Promise<ApiResponse<LeadSharkEnrichmentResult>> {
    const params = new URLSearchParams({ linkedin_id: linkedinId });
    if (sections?.length) {
      params.append('linkedin_sections', sections.join(','));
    }
    return this.get<LeadSharkEnrichmentResult>(`/api/enrich/person?${params.toString()}`);
  }

  async enrichCompany(linkedinId: string): Promise<ApiResponse<Record<string, unknown>>> {
    return this.get<Record<string, unknown>>(`/api/enrich/company?linkedin_id=${linkedinId}`);
  }

  // ============================================
  // LINKEDIN SEARCH
  // ============================================

  /**
   * Search LinkedIn profiles using filters
   * @param params - Search parameters (keywords, location, etc.)
   */
  async searchLinkedIn(params: {
    keywords?: string;
    location?: string;
    [key: string]: string | undefined;
  }): Promise<ApiResponse<LeadSharkEnrichmentResult[]>> {
    return this.post<LeadSharkEnrichmentResult[]>('/api/linkedin-search', { params });
  }

  // ============================================
  // AUTOMATIONS
  // ============================================

  async listAutomations(): Promise<ApiResponse<LeadSharkAutomation[]>> {
    return this.get<LeadSharkAutomation[]>('/api/automations');
  }

  async getAutomation(id: string): Promise<ApiResponse<LeadSharkAutomation>> {
    return this.get<LeadSharkAutomation>(`/api/automations/${id}`);
  }

  async createAutomation(data: CreateAutomationRequest): Promise<ApiResponse<LeadSharkAutomation>> {
    return this.post<LeadSharkAutomation>('/api/automations', data);
  }

  async updateAutomation(id: string, data: Partial<CreateAutomationRequest>): Promise<ApiResponse<LeadSharkAutomation>> {
    return this.put<LeadSharkAutomation>(`/api/automations/${id}`, data);
  }

  async deleteAutomation(id: string): Promise<ApiResponse<void>> {
    return this.delete<void>(`/api/automations/${id}`);
  }

  // ============================================
  // SCHEDULED POSTS
  // ============================================

  async listScheduledPosts(): Promise<ApiResponse<LeadSharkScheduledPost[]>> {
    return this.get<LeadSharkScheduledPost[]>('/api/scheduled-posts');
  }

  async getScheduledPost(id: string): Promise<ApiResponse<LeadSharkScheduledPost>> {
    return this.get<LeadSharkScheduledPost>(`/api/scheduled-posts?id=${id}`);
  }

  async createScheduledPost(data: SchedulePostRequest): Promise<ApiResponse<LeadSharkScheduledPost>> {
    // First try with JSON
    const jsonResult = await this.post<LeadSharkScheduledPost>('/api/scheduled-posts', {
      content: data.content,
      scheduled_time: data.scheduled_time,
      is_public: data.is_public ?? true,
      automation: data.automation,
    });

    // If JSON works, return it
    if (!jsonResult.error || jsonResult.status !== 405) {
      return jsonResult;
    }

    // If we get 405, try multipart/form-data (some endpoints require it)
    const formData = new FormData();
    formData.append('content', data.content);
    formData.append('scheduled_time', data.scheduled_time);

    if (data.is_public !== undefined) {
      formData.append('is_public', String(data.is_public));
    }

    if (data.automation) {
      formData.append('automation', JSON.stringify(data.automation));
    }

    return this.postMultipart<LeadSharkScheduledPost>('/api/scheduled-posts', formData);
  }

  async updateScheduledPost(id: string, data: Partial<SchedulePostRequest>): Promise<ApiResponse<LeadSharkScheduledPost>> {
    const formData = new FormData();
    if (data.content) formData.append('content', data.content);
    if (data.scheduled_time) formData.append('scheduled_time', data.scheduled_time);
    if (data.is_public !== undefined) formData.append('is_public', String(data.is_public));
    if (data.automation) formData.append('automation', JSON.stringify(data.automation));

    return this.putMultipart<LeadSharkScheduledPost>(`/api/scheduled-posts?id=${id}`, formData);
  }

  async deleteScheduledPost(id: string): Promise<ApiResponse<void>> {
    return this.delete<void>(`/api/scheduled-posts?id=${id}`);
  }

  // ============================================
  // POST STATS
  // ============================================

  async listPostStats(limit = 10, cursor?: string): Promise<ApiResponse<{
    posts: Array<{
      id: string;
      likes: number;
      comments: number;
      shares: number;
      views: number;
    }>;
    cursor?: string;
  }>> {
    const params = new URLSearchParams({ limit: limit.toString() });
    if (cursor) params.append('cursor', cursor);
    return this.get(`/api/post-stats?${params.toString()}`);
  }

  // ============================================
  // BOOKMARKS
  // ============================================

  /**
   * List bookmarked LinkedIn profiles
   */
  async listBookmarks(options?: {
    page?: number;
    limit?: number;
    search?: string;
    tag_id?: string;
  }): Promise<ApiResponse<Array<{
    id: string;
    linkedin_id: string;
    name: string;
    headline?: string;
    location?: string;
    profile_url?: string;
    profile_picture_url?: string;
    notes?: string;
    tags: string[];
  }>>> {
    const params = new URLSearchParams();
    if (options?.page) params.append('page', options.page.toString());
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.search) params.append('search', options.search);
    if (options?.tag_id) params.append('tag_id', options.tag_id);
    const query = params.toString();
    return this.get(`/api/bookmarks${query ? `?${query}` : ''}`);
  }

  /**
   * List all bookmark tags
   */
  async listBookmarkTags(): Promise<ApiResponse<Array<{ id: string; name: string }>>> {
    return this.get('/api/bookmarks/tags');
  }

  /**
   * Create or update a bookmark (updates if linkedin_id already exists)
   */
  async createBookmark(data: CreateBookmarkRequest): Promise<ApiResponse<{ id: string }>> {
    return this.post('/api/bookmarks', data);
  }

  /**
   * Update a bookmark by ID
   */
  async updateBookmark(id: string, data: Partial<CreateBookmarkRequest>): Promise<ApiResponse<{ id: string }>> {
    return this.put(`/api/bookmarks/${id}`, data);
  }

  /**
   * Delete a bookmark
   */
  async deleteBookmark(id: string): Promise<ApiResponse<void>> {
    return this.delete(`/api/bookmarks/${id}`);
  }

  // ============================================
  // HEALTH CHECK
  // ============================================

  async verifyConnection(): Promise<{ connected: boolean; error?: string }> {
    const result = await this.listAutomations();
    if (result.error) {
      return { connected: false, error: result.error };
    }
    return { connected: true };
  }
}

// Factory function for global API key (fallback)
export function getLeadSharkClient(): LeadSharkClient {
  const apiKey = process.env.LEADSHARK_API_KEY;
  if (!apiKey) {
    throw new Error('LEADSHARK_API_KEY is not set');
  }
  return new LeadSharkClient({ apiKey });
}

// Factory function for user-specific API key
export function createLeadSharkClientWithKey(apiKey: string): LeadSharkClient {
  return new LeadSharkClient({ apiKey });
}

// Helper to get user's LeadShark API key from database
// Note: API keys are encrypted at rest and decrypted only when needed
import { getUserIntegration } from '@/lib/utils/encrypted-storage';

export async function getUserLeadSharkClient(userId: string): Promise<LeadSharkClient | null> {
  // Get integration with decrypted API key
  const integration = await getUserIntegration(userId, 'leadshark');

  if (!integration?.api_key || !integration.is_active) {
    return null;
  }

  return new LeadSharkClient({ apiKey: integration.api_key });
}
