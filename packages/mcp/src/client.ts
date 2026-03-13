/** MagnetLab API client. Provides typed methods for 35 MCP tools. Never imported by handlers directly — only via MagnetLabClient instance. */

import type {
  Archetype,
  LeadMagnetStatusV2,
  FunnelTheme,
  BackgroundStyle,
  FunnelTargetType,
  KnowledgeCategory,
  KnowledgeType,
  PipelinePostStatus,
  ContentPillar,
  ContentType,
  EmailSequenceStatus,
} from './constants.js';

// ─── Configuration ─────────────────────────────────────────────────────────────

const DEFAULT_BASE_URL = 'https://www.magnetlab.app/api';

/** Default timeout for regular API calls (15 seconds) */
const DEFAULT_TIMEOUT_MS = 15_000;

/** Extended timeout for AI generation calls (120 seconds) */
const AI_TIMEOUT_MS = 120_000;

export interface MagnetLabClientOptions {
  baseUrl?: string;
}

// ─── Client ────────────────────────────────────────────────────────────────────

export class MagnetLabClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, options: MagnetLabClientOptions = {}) {
    this.apiKey = apiKey;
    this.baseUrl = options.baseUrl || DEFAULT_BASE_URL;
  }

  // ─── HTTP Infrastructure ───────────────────────────────────────────────────

  async request<T>(method: string, path: string, body?: unknown, timeoutMs?: number): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };

    const controller = new AbortController();
    const timeout = timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      let response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        redirect: 'manual',
        signal: controller.signal,
      });

      // Follow redirects manually to preserve the Authorization header
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (location) {
          response = await fetch(location, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined,
            redirect: 'manual',
            signal: controller.signal,
          });
        }
      }

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.error || `Request failed: ${response.status}`);
      }

      // Handle CSV responses (exports)
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('text/csv')) {
        return { csv: await response.text() } as T;
      }

      return response.json();
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new Error(
          `Request timed out after ${Math.round(timeout / 1000)}s — try again or use a simpler operation`
        );
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /** Make a request with extended timeout for AI generation operations */
  async aiRequest<T>(method: string, path: string, body?: unknown): Promise<T> {
    return this.request<T>(method, path, body, AI_TIMEOUT_MS);
  }

  // ─── Lead Magnets ─────────────────────────────────────────────────────────

  async listLeadMagnets(params?: { status?: LeadMagnetStatusV2; limit?: number; offset?: number }) {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set('status', params.status);
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.offset) searchParams.set('offset', String(params.offset));
    const qs = searchParams.toString();
    return this.request<{ leadMagnets: unknown[]; total: number }>(
      'GET',
      `/lead-magnet${qs ? `?${qs}` : ''}`
    );
  }

  async getLeadMagnet(id: string) {
    return this.request<unknown>('GET', `/lead-magnet/${id}`);
  }

  async createLeadMagnet(params: { title: string; archetype: Archetype; concept?: unknown }) {
    return this.request<unknown>('POST', `/lead-magnet`, params);
  }

  /** Update lead magnet content with optional optimistic locking via expected_version. */
  async updateLeadMagnetContent(id: string, content: unknown, expectedVersion?: number) {
    const body: Record<string, unknown> = { content };
    if (expectedVersion !== undefined) {
      body.expected_version = expectedVersion;
    }
    return this.request<unknown>('PATCH', `/lead-magnet/${id}`, body);
  }

  async deleteLeadMagnet(id: string) {
    return this.request<{ success: boolean }>('DELETE', `/lead-magnet/${id}`);
  }

  /** Compound action: launch a lead magnet end-to-end. */
  async launchLeadMagnet(data: {
    lead_magnet_id: string;
    slug?: string;
    funnel_overrides?: Record<string, unknown>;
    activate_email_sequence?: boolean;
  }) {
    return this.request<unknown>('POST', `/lead-magnet/launch`, data);
  }

  // ─── Funnels ──────────────────────────────────────────────────────────────

  async listFunnels() {
    return this.request<{ funnels: unknown[] }>('GET', `/funnel/all`);
  }

  async getFunnel(id: string) {
    return this.request<{ funnel: unknown }>('GET', `/funnel/${id}`);
  }

  async createFunnel(params: {
    leadMagnetId?: string;
    libraryId?: string;
    externalResourceId?: string;
    targetType?: FunnelTargetType;
    slug: string;
    optinHeadline?: string;
    optinSubline?: string;
    optinButtonText?: string;
    optinSocialProof?: string;
    thankyouHeadline?: string;
    thankyouSubline?: string;
    vslUrl?: string;
    calendlyUrl?: string;
    theme?: FunnelTheme;
    primaryColor?: string;
    backgroundStyle?: BackgroundStyle;
    logoUrl?: string;
    qualificationFormId?: string;
  }) {
    return this.request<{ funnel: unknown }>('POST', `/funnel`, params);
  }

  async updateFunnel(
    id: string,
    params: {
      slug?: string;
      optinHeadline?: string;
      optinSubline?: string;
      optinButtonText?: string;
      optinSocialProof?: string;
      thankyouHeadline?: string;
      thankyouSubline?: string;
      vslUrl?: string;
      calendlyUrl?: string;
      theme?: FunnelTheme;
      primaryColor?: string;
      backgroundStyle?: BackgroundStyle;
      logoUrl?: string;
      qualificationFormId?: string | null;
      qualificationPassMessage?: string;
      qualificationFailMessage?: string;
      redirectTrigger?: string;
      redirectUrl?: string | null;
      redirectFailUrl?: string | null;
      homepageUrl?: string | null;
      homepageLabel?: string | null;
      sendResourceEmail?: boolean;
    }
  ) {
    return this.request<{ funnel: unknown }>('PUT', `/funnel/${id}`, params);
  }

  async deleteFunnel(id: string) {
    return this.request<{ success: boolean }>('DELETE', `/funnel/${id}`);
  }

  async publishFunnel(id: string) {
    return this.request<{ funnel: unknown; publicUrl: string | null }>(
      'POST',
      `/funnel/${id}/publish`,
      { publish: true }
    );
  }

  async unpublishFunnel(id: string) {
    return this.request<{ funnel: unknown }>('POST', `/funnel/${id}/publish`, { publish: false });
  }

  // ─── Knowledge Base ───────────────────────────────────────────────────────

  async searchKnowledge(params: {
    query?: string;
    category?: KnowledgeCategory;
    type?: KnowledgeType;
    topic?: string;
    min_quality?: number;
    since?: string;
  }) {
    const searchParams = new URLSearchParams();
    if (params.query) searchParams.set('q', params.query);
    if (params.category) searchParams.set('category', params.category);
    if (params.type) searchParams.set('type', params.type);
    if (params.topic) searchParams.set('topic', params.topic);
    if (params.min_quality) searchParams.set('min_quality', String(params.min_quality));
    if (params.since) searchParams.set('since', params.since);
    const qs = searchParams.toString();
    return this.request<{ entries?: unknown[]; total_count?: number }>(
      'GET',
      `/content-pipeline/knowledge${qs ? `?${qs}` : ''}`
    );
  }

  async browseKnowledge(params?: { category?: KnowledgeCategory; tag?: string; limit?: number }) {
    const searchParams = new URLSearchParams();
    if (params?.category) searchParams.set('category', params.category);
    if (params?.tag) searchParams.set('tag', params.tag);
    if (params?.limit) searchParams.set('limit', String(params.limit));
    const qs = searchParams.toString();
    return this.request<{ entries?: unknown[]; tags?: unknown[]; total_count?: number }>(
      'GET',
      `/content-pipeline/knowledge${qs ? `?${qs}` : ''}`
    );
  }

  async getKnowledgeClusters() {
    return this.request<{ clusters: unknown[] }>('GET', `/content-pipeline/knowledge/clusters`);
  }

  async askKnowledge(params: { question: string }) {
    return this.aiRequest<{ answer: string; sources: unknown[] }>(
      'POST',
      `/content-pipeline/knowledge/ask`,
      params
    );
  }

  // ─── Transcripts ──────────────────────────────────────────────────────────

  async submitTranscript(params: { transcript: string; title?: string }) {
    return this.request<{ success: boolean; transcript_id: string }>(
      'POST',
      `/content-pipeline/transcripts`,
      params
    );
  }

  // ─── Posts ────────────────────────────────────────────────────────────────

  async listPosts(params?: { status?: PipelinePostStatus; isBuffer?: boolean; limit?: number }) {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set('status', params.status);
    if (params?.isBuffer !== undefined) searchParams.set('is_buffer', String(params.isBuffer));
    if (params?.limit) searchParams.set('limit', String(params.limit));
    const qs = searchParams.toString();
    return this.request<{ posts: unknown[] }>(
      'GET',
      `/content-pipeline/posts${qs ? `?${qs}` : ''}`
    );
  }

  async getPost(id: string) {
    return this.request<{ post: unknown }>('GET', `/content-pipeline/posts/${id}`);
  }

  /** Create a new post directly (agent-authored). */
  async createPost(params: {
    body: string;
    title?: string;
    pillar?: ContentPillar;
    content_type?: ContentType;
  }) {
    return this.request<{ post: unknown }>('POST', `/content-pipeline/posts`, params);
  }

  async updatePost(id: string, params: Record<string, unknown>) {
    return this.request<{ post: unknown }>('PATCH', `/content-pipeline/posts/${id}`, params);
  }

  async deletePost(id: string) {
    return this.request<{ success: boolean }>('DELETE', `/content-pipeline/posts/${id}`);
  }

  async publishPost(id: string) {
    return this.request<unknown>('POST', `/content-pipeline/posts/${id}/publish`, {});
  }

  /** Compound action: schedule a full content week. */
  async scheduleContentWeek(data: {
    start_date?: string;
    posts_per_day?: number;
    pillars?: ContentPillar[];
    auto_approve?: boolean;
  }) {
    return this.request<unknown>('POST', `/content-pipeline/posts/schedule-week`, data);
  }

  // ─── Email Sequences ──────────────────────────────────────────────────────

  async getEmailSequence(leadMagnetId: string) {
    return this.request<{ emailSequence: unknown | null }>(
      'GET',
      `/email-sequence/${leadMagnetId}`
    );
  }

  /** Full-replace save of an email sequence. */
  async saveEmailSequence(
    leadMagnetId: string,
    data: {
      emails?: Array<{
        day: number;
        subject: string;
        body: string;
        replyTrigger?: string;
      }>;
      status?: EmailSequenceStatus;
    }
  ) {
    return this.request<{ emailSequence: unknown }>('PUT', `/email-sequence/${leadMagnetId}`, data);
  }

  async activateEmailSequence(leadMagnetId: string) {
    return this.request<unknown>('POST', `/email-sequence/${leadMagnetId}/activate`, {});
  }

  // ─── Leads ────────────────────────────────────────────────────────────────

  async listLeads(params?: {
    funnelId?: string;
    leadMagnetId?: string;
    qualified?: boolean;
    search?: string;
    limit?: number;
    offset?: number;
  }) {
    const searchParams = new URLSearchParams();
    if (params?.funnelId) searchParams.set('funnelId', params.funnelId);
    if (params?.leadMagnetId) searchParams.set('leadMagnetId', params.leadMagnetId);
    if (params?.qualified !== undefined) searchParams.set('qualified', String(params.qualified));
    if (params?.search) searchParams.set('search', params.search);
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.offset) searchParams.set('offset', String(params.offset));
    const qs = searchParams.toString();
    return this.request<{ leads: unknown[]; total: number }>('GET', `/leads${qs ? `?${qs}` : ''}`);
  }

  async getLead(id: string) {
    return this.request<{ lead: unknown }>('GET', `/leads/${id}`);
  }

  async exportLeads(params?: { funnelId?: string; leadMagnetId?: string; qualified?: boolean }) {
    const searchParams = new URLSearchParams();
    if (params?.funnelId) searchParams.set('funnelId', params.funnelId);
    if (params?.leadMagnetId) searchParams.set('leadMagnetId', params.leadMagnetId);
    if (params?.qualified !== undefined) searchParams.set('qualified', String(params.qualified));
    const qs = searchParams.toString();
    return this.request<{ csv: string }>('GET', `/leads/export${qs ? `?${qs}` : ''}`);
  }

  // ─── Business Context ─────────────────────────────────────────────────────

  async getBusinessContext() {
    return this.request<{ businessContext: unknown }>('GET', `/content-pipeline/business-context`);
  }

  // ─── Analytics ────────────────────────────────────────────────────────────

  async getPerformanceInsights(period?: string) {
    const qs = period ? `?period=${encodeURIComponent(period)}` : '';
    return this.request<unknown>('GET', `/analytics/performance-insights${qs}`);
  }

  async getRecommendations() {
    return this.request<unknown>('GET', `/analytics/recommendations`);
  }

  // ─── Teams ────────────────────────────────────────────────────────────────

  async listTeams() {
    return this.request<{ teams: unknown[] }>('GET', `/teams`);
  }
}
