/** MagnetLab API client. Provides typed methods for 40 MCP tools. Never imported by handlers directly — only via MagnetLabClient instance. */

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

  // ─── Team ID Helper ───────────────────────────────────────────────────────

  private appendTeamId(url: string, teamId?: string): string {
    if (!teamId) return url;
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}team_id=${teamId}`;
  }

  // ─── Lead Magnets ─────────────────────────────────────────────────────────

  async listLeadMagnets(params?: {
    status?: LeadMagnetStatusV2;
    limit?: number;
    offset?: number;
    teamId?: string;
  }) {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set('status', params.status);
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.offset) searchParams.set('offset', String(params.offset));
    const qs = searchParams.toString();
    const url = this.appendTeamId(`/lead-magnet${qs ? `?${qs}` : ''}`, params?.teamId);
    return this.request<{ leadMagnets: unknown[]; total: number }>('GET', url);
  }

  async getLeadMagnet(id: string, teamId?: string) {
    const url = this.appendTeamId(`/lead-magnet/${id}`, teamId);
    return this.request<unknown>('GET', url);
  }

  async createLeadMagnet(params: {
    title: string;
    archetype: Archetype;
    concept?: unknown;
    teamId?: string;
  }) {
    const { teamId, ...body } = params;
    const url = this.appendTeamId(`/lead-magnet`, teamId);
    return this.request<unknown>('POST', url, body);
  }

  /** Update lead magnet content with optional optimistic locking via expected_version. */
  async updateLeadMagnetContent(
    id: string,
    content: unknown,
    expectedVersion?: number,
    teamId?: string
  ) {
    const body: Record<string, unknown> = { content };
    if (expectedVersion !== undefined) {
      body.expected_version = expectedVersion;
    }
    const url = this.appendTeamId(`/lead-magnet/${id}`, teamId);
    return this.request<unknown>('PATCH', url, body);
  }

  async deleteLeadMagnet(id: string, teamId?: string) {
    const url = this.appendTeamId(`/lead-magnet/${id}`, teamId);
    return this.request<{ success: boolean }>('DELETE', url);
  }

  /** Compound action: create + funnel + publish a lead magnet end-to-end. */
  async launchLeadMagnet(data: {
    title: string;
    archetype: Archetype;
    content: Record<string, unknown>;
    slug: string;
    funnel_theme?: string;
    email_sequence?: {
      emails: Array<{ subject: string; body: string; delay_days: number }>;
    };
    teamId?: string;
  }) {
    const { teamId, ...body } = data;
    const url = this.appendTeamId(`/lead-magnet/launch`, teamId);
    return this.request<unknown>('POST', url, body);
  }

  // ─── Funnels ──────────────────────────────────────────────────────────────

  async listFunnels(teamId?: string) {
    const url = this.appendTeamId(`/funnel/all`, teamId);
    return this.request<{ funnels: unknown[] }>('GET', url);
  }

  async getFunnel(id: string, teamId?: string) {
    const url = this.appendTeamId(`/funnel/${id}`, teamId);
    return this.request<{ funnel: unknown }>('GET', url);
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
    teamId?: string;
  }) {
    const { teamId, ...body } = params;
    const url = this.appendTeamId(`/funnel`, teamId);
    return this.request<{ funnel: unknown }>('POST', url, body);
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
      teamId?: string;
    }
  ) {
    const { teamId, ...body } = params;
    const url = this.appendTeamId(`/funnel/${id}`, teamId);
    return this.request<{ funnel: unknown }>('PUT', url, body);
  }

  async deleteFunnel(id: string, teamId?: string) {
    const url = this.appendTeamId(`/funnel/${id}`, teamId);
    return this.request<{ success: boolean }>('DELETE', url);
  }

  async publishFunnel(id: string, teamId?: string) {
    const url = this.appendTeamId(`/funnel/${id}/publish`, teamId);
    return this.request<{ funnel: unknown; publicUrl: string | null }>('POST', url, {
      publish: true,
    });
  }

  async unpublishFunnel(id: string, teamId?: string) {
    const url = this.appendTeamId(`/funnel/${id}/publish`, teamId);
    return this.request<{ funnel: unknown }>('POST', url, { publish: false });
  }

  // ─── Libraries ──────────────────────────────────────────────────────────

  async createLibrary(params: {
    name: string;
    description?: string;
    icon?: string;
    slug?: string;
    autoFeatureDays?: number;
    teamId?: string;
  }) {
    const { teamId, ...body } = params;
    const url = this.appendTeamId('/libraries', teamId);
    return this.request<{ library: unknown }>('POST', url, body);
  }

  async listLibraries(limit?: number, offset?: number, teamId?: string) {
    const params = new URLSearchParams();
    if (limit !== undefined) params.set('limit', String(limit));
    if (offset !== undefined) params.set('offset', String(offset));
    const qs = params.toString();
    const path = qs ? `/libraries?${qs}` : '/libraries';
    const url = this.appendTeamId(path, teamId);
    return this.request<{ libraries: unknown[] }>('GET', url);
  }

  async getLibrary(id: string, teamId?: string) {
    const url = this.appendTeamId(`/libraries/${id}`, teamId);
    return this.request<{ library: unknown; items: unknown[] }>('GET', url);
  }

  async updateLibrary(
    id: string,
    params: {
      name?: string;
      description?: string | null;
      icon?: string;
      slug?: string;
      autoFeatureDays?: number;
      teamId?: string;
    }
  ) {
    const { teamId, ...body } = params;
    const url = this.appendTeamId(`/libraries/${id}`, teamId);
    return this.request<{ library: unknown }>('PUT', url, body);
  }

  async deleteLibrary(id: string, teamId?: string) {
    const url = this.appendTeamId(`/libraries/${id}`, teamId);
    return this.request<{ success: boolean }>('DELETE', url);
  }

  async addLibraryItem(
    libraryId: string,
    params: {
      assetType: string;
      leadMagnetId?: string;
      externalResourceId?: string;
      iconOverride?: string;
      sortOrder?: number;
      isFeatured?: boolean;
      teamId?: string;
    }
  ) {
    const { teamId, ...body } = params;
    const url = this.appendTeamId(`/libraries/${libraryId}/items`, teamId);
    return this.request<{ item: unknown }>('POST', url, body);
  }

  async removeLibraryItem(libraryId: string, itemId: string, teamId?: string) {
    const url = this.appendTeamId(`/libraries/${libraryId}/items/${itemId}`, teamId);
    return this.request<{ success: boolean }>('DELETE', url);
  }

  async reorderLibraryItems(
    libraryId: string,
    items: Array<{ id: string; sortOrder: number }>,
    teamId?: string
  ) {
    const url = this.appendTeamId(`/libraries/${libraryId}/items/reorder`, teamId);
    return this.request<{ success: boolean }>('POST', url, { items });
  }

  // ─── Knowledge Base ───────────────────────────────────────────────────────

  async searchKnowledge(params: {
    query?: string;
    category?: KnowledgeCategory;
    type?: KnowledgeType;
    topic?: string;
    min_quality?: number;
    since?: string;
    teamId?: string;
  }) {
    const searchParams = new URLSearchParams();
    if (params.query) searchParams.set('q', params.query);
    if (params.category) searchParams.set('category', params.category);
    if (params.type) searchParams.set('type', params.type);
    if (params.topic) searchParams.set('topic', params.topic);
    if (params.min_quality) searchParams.set('min_quality', String(params.min_quality));
    if (params.since) searchParams.set('since', params.since);
    const qs = searchParams.toString();
    const url = this.appendTeamId(
      `/content-pipeline/knowledge${qs ? `?${qs}` : ''}`,
      params.teamId
    );
    return this.request<{ entries?: unknown[]; total_count?: number }>('GET', url);
  }

  async browseKnowledge(params?: {
    category?: KnowledgeCategory;
    tag?: string;
    limit?: number;
    teamId?: string;
  }) {
    const searchParams = new URLSearchParams();
    if (params?.category) searchParams.set('category', params.category);
    if (params?.tag) searchParams.set('tag', params.tag);
    if (params?.limit) searchParams.set('limit', String(params.limit));
    const qs = searchParams.toString();
    const url = this.appendTeamId(
      `/content-pipeline/knowledge${qs ? `?${qs}` : ''}`,
      params?.teamId
    );
    return this.request<{ entries?: unknown[]; tags?: unknown[]; total_count?: number }>(
      'GET',
      url
    );
  }

  async getKnowledgeClusters(teamId?: string) {
    const url = this.appendTeamId(`/content-pipeline/knowledge/clusters`, teamId);
    return this.request<{ clusters: unknown[] }>('GET', url);
  }

  async askKnowledge(params: { question: string; teamId?: string }) {
    const { teamId, ...body } = params;
    const url = this.appendTeamId(`/content-pipeline/knowledge/ask`, teamId);
    return this.aiRequest<{ answer: string; sources: unknown[] }>('POST', url, body);
  }

  // ─── Transcripts ──────────────────────────────────────────────────────────

  async submitTranscript(params: { transcript: string; title?: string; teamId?: string }) {
    const { teamId, ...body } = params;
    const url = this.appendTeamId(`/content-pipeline/transcripts`, teamId);
    return this.request<{ success: boolean; transcript_id: string }>('POST', url, body);
  }

  // ─── Posts ────────────────────────────────────────────────────────────────

  async listPosts(params?: {
    status?: PipelinePostStatus;
    isBuffer?: boolean;
    limit?: number;
    teamId?: string;
  }) {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set('status', params.status);
    if (params?.isBuffer !== undefined) searchParams.set('is_buffer', String(params.isBuffer));
    if (params?.limit) searchParams.set('limit', String(params.limit));
    const qs = searchParams.toString();
    const url = this.appendTeamId(`/content-pipeline/posts${qs ? `?${qs}` : ''}`, params?.teamId);
    return this.request<{ posts: unknown[] }>('GET', url);
  }

  async getPost(id: string, teamId?: string) {
    const url = this.appendTeamId(`/content-pipeline/posts/${id}`, teamId);
    return this.request<{ post: unknown }>('GET', url);
  }

  /** Create a new post directly (agent-authored). */
  async createPost(params: {
    body: string;
    title?: string;
    pillar?: ContentPillar;
    content_type?: ContentType;
    teamId?: string;
  }) {
    const { teamId, ...body } = params;
    const url = this.appendTeamId(`/content-pipeline/posts`, teamId);
    return this.request<{ post: unknown }>('POST', url, body);
  }

  async updatePost(id: string, params: Record<string, unknown>, teamId?: string) {
    const url = this.appendTeamId(`/content-pipeline/posts/${id}`, teamId);
    return this.request<{ post: unknown }>('PATCH', url, params);
  }

  async deletePost(id: string, teamId?: string) {
    const url = this.appendTeamId(`/content-pipeline/posts/${id}`, teamId);
    return this.request<{ success: boolean }>('DELETE', url);
  }

  async publishPost(id: string, teamId?: string) {
    const url = this.appendTeamId(`/content-pipeline/posts/${id}/publish`, teamId);
    return this.request<unknown>('POST', url, {});
  }

  /** Compound action: schedule a full content week with agent-authored posts. */
  async scheduleContentWeek(
    data: {
      posts: Array<{
        body: string;
        title?: string;
        pillar?: ContentPillar;
        content_type?: ContentType;
      }>;
      week_start?: string;
    },
    teamId?: string
  ) {
    const url = this.appendTeamId(`/content-pipeline/posts/schedule-week`, teamId);
    return this.request<unknown>('POST', url, data);
  }

  // ─── Email Sequences ──────────────────────────────────────────────────────

  async getEmailSequence(leadMagnetId: string, teamId?: string) {
    const url = this.appendTeamId(`/email-sequence/${leadMagnetId}`, teamId);
    return this.request<{ emailSequence: unknown | null }>('GET', url);
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
    },
    teamId?: string
  ) {
    const url = this.appendTeamId(`/email-sequence/${leadMagnetId}`, teamId);
    return this.request<{ emailSequence: unknown }>('PUT', url, data);
  }

  async activateEmailSequence(leadMagnetId: string, teamId?: string) {
    const url = this.appendTeamId(`/email-sequence/${leadMagnetId}/activate`, teamId);
    return this.request<unknown>('POST', url, {});
  }

  // ─── Leads ────────────────────────────────────────────────────────────────

  async listLeads(params?: {
    funnelId?: string;
    leadMagnetId?: string;
    qualified?: boolean;
    search?: string;
    limit?: number;
    offset?: number;
    teamId?: string;
  }) {
    const searchParams = new URLSearchParams();
    if (params?.funnelId) searchParams.set('funnelId', params.funnelId);
    if (params?.leadMagnetId) searchParams.set('leadMagnetId', params.leadMagnetId);
    if (params?.qualified !== undefined) searchParams.set('qualified', String(params.qualified));
    if (params?.search) searchParams.set('search', params.search);
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.offset) searchParams.set('offset', String(params.offset));
    const qs = searchParams.toString();
    const url = this.appendTeamId(`/leads${qs ? `?${qs}` : ''}`, params?.teamId);
    return this.request<{ leads: unknown[]; total: number }>('GET', url);
  }

  async getLead(id: string, teamId?: string) {
    const url = this.appendTeamId(`/leads/${id}`, teamId);
    return this.request<{ lead: unknown }>('GET', url);
  }

  async exportLeads(params?: {
    funnelId?: string;
    leadMagnetId?: string;
    qualified?: boolean;
    teamId?: string;
  }) {
    const searchParams = new URLSearchParams();
    if (params?.funnelId) searchParams.set('funnelId', params.funnelId);
    if (params?.leadMagnetId) searchParams.set('leadMagnetId', params.leadMagnetId);
    if (params?.qualified !== undefined) searchParams.set('qualified', String(params.qualified));
    const qs = searchParams.toString();
    const url = this.appendTeamId(`/leads/export${qs ? `?${qs}` : ''}`, params?.teamId);
    return this.request<{ csv: string }>('GET', url);
  }

  // ─── Business Context ─────────────────────────────────────────────────────

  async getBusinessContext(teamId?: string) {
    const url = this.appendTeamId(`/content-pipeline/business-context`, teamId);
    return this.request<{ businessContext: unknown }>('GET', url);
  }

  // ─── Analytics ────────────────────────────────────────────────────────────

  async getPerformanceInsights(period?: string, teamId?: string) {
    const qs = period ? `?period=${encodeURIComponent(period)}` : '';
    const url = this.appendTeamId(`/analytics/performance-insights${qs}`, teamId);
    return this.request<unknown>('GET', url);
  }

  async getRecommendations(teamId?: string) {
    const url = this.appendTeamId(`/analytics/recommendations`, teamId);
    return this.request<unknown>('GET', url);
  }

  // ─── Content Queue ────────────────────────────────────────────────────────

  async listContentQueue() {
    return this.request<{ teams: unknown[] }>('GET', `/content-queue`);
  }

  async updateQueuePost(
    postId: string,
    params: {
      draft_content?: string;
      mark_edited?: boolean;
    }
  ) {
    return this.request<{ success: boolean }>('PATCH', `/content-queue/posts/${postId}`, params);
  }

  async submitQueueBatch(teamId: string) {
    return this.request<{ success: boolean; dfy_callback_sent: boolean }>(
      'POST',
      `/content-queue/submit`,
      { team_id: teamId }
    );
  }

  async reviewLeadMagnet(lmId: string, reviewed: boolean) {
    return this.request<{ success: boolean }>(
      'PATCH',
      `/content-queue/lead-magnets/${lmId}/review`,
      { reviewed }
    );
  }

  async reviewFunnel(funnelId: string, reviewed: boolean) {
    return this.request<{ success: boolean }>(
      'PATCH',
      `/content-queue/funnels/${funnelId}/review`,
      { reviewed }
    );
  }

  async submitAssetReview(teamId: string) {
    return this.request<{ success: boolean; dfy_callback_sent: boolean }>(
      'POST',
      `/content-queue/submit`,
      { team_id: teamId, submit_type: 'assets' }
    );
  }

  // ─── Teams ────────────────────────────────────────────────────────────────

  async listTeams() {
    return this.request<{ teams: unknown[] }>('GET', `/teams`);
  }

  // ─── Exploits ─────────────────────────────────────────────────────────────

  async listExploits(params?: { category?: string; creativeType?: string; withStats?: boolean }) {
    const searchParams = new URLSearchParams();
    if (params?.category) searchParams.set('category', params.category);
    if (params?.creativeType) searchParams.set('creative_type', params.creativeType);
    if (params?.withStats !== undefined) searchParams.set('with_stats', String(params.withStats));
    const qs = searchParams.toString();
    return this.request<{ exploits: unknown[] }>(
      'GET',
      `/content-pipeline/exploits${qs ? `?${qs}` : ''}`
    );
  }

  /** Generate a LinkedIn post from any combination of primitives (creative, exploit, knowledge, template, idea, style, hook, instructions). */
  async generatePost(params: {
    creativeId?: string;
    exploitId?: string;
    knowledgeIds?: string[];
    templateId?: string;
    ideaId?: string;
    styleId?: string;
    hook?: string;
    instructions?: string;
  }) {
    return this.aiRequest<{ post: unknown }>('POST', `/content-pipeline/posts/generate`, {
      creative_id: params.creativeId,
      exploit_id: params.exploitId,
      knowledge_ids: params.knowledgeIds,
      template_id: params.templateId,
      idea_id: params.ideaId,
      style_id: params.styleId,
      hook: params.hook,
      instructions: params.instructions,
    });
  }

  // ─── Creatives ────────────────────────────────────────────────────────────

  async createCreative(params: {
    contentText: string;
    sourcePlatform?: string;
    sourceUrl?: string;
    sourceAuthor?: string;
    imageUrl?: string;
    teamId?: string;
  }) {
    const { teamId, contentText, sourcePlatform, sourceUrl, sourceAuthor, imageUrl } = params;
    return this.request<{ creative: unknown }>('POST', `/content-pipeline/creatives`, {
      content_text: contentText,
      source_platform: sourcePlatform,
      source_url: sourceUrl,
      source_author: sourceAuthor,
      image_url: imageUrl,
      team_id: teamId,
    });
  }

  async listCreatives(params?: {
    status?: string;
    sourcePlatform?: string;
    minScore?: number;
    limit?: number;
  }) {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set('status', params.status);
    if (params?.sourcePlatform) searchParams.set('source_platform', params.sourcePlatform);
    if (params?.minScore !== undefined) searchParams.set('min_score', String(params.minScore));
    if (params?.limit) searchParams.set('limit', String(params.limit));
    const qs = searchParams.toString();
    return this.request<{ creatives: unknown[] }>(
      'GET',
      `/content-pipeline/creatives${qs ? `?${qs}` : ''}`
    );
  }

  async runScanner() {
    return this.request<{ success: boolean; message: string }>(
      'POST',
      `/content-pipeline/scanner/run`,
      {}
    );
  }

  async configureScanner(params: {
    action: 'add' | 'remove';
    sourceType?: string;
    sourceValue?: string;
    sourceId?: string;
    priority?: number;
  }) {
    const { action, sourceType, sourceValue, sourceId, priority } = params;
    if (action === 'remove') {
      return this.request<{ deleted: boolean }>('DELETE', `/content-pipeline/scanner/sources`, {
        source_id: sourceId,
      });
    }
    return this.request<{ source: unknown }>('POST', `/content-pipeline/scanner/sources`, {
      source_type: sourceType,
      source_value: sourceValue,
      priority,
    });
  }

  async listRecyclablePosts(params: { limit?: number }) {
    const searchParams = new URLSearchParams();
    if (params.limit !== undefined) searchParams.set('limit', String(params.limit));
    const qs = searchParams.toString();
    return this.request<{ posts: unknown[] }>(
      'GET',
      `/content-pipeline/posts/recyclable${qs ? `?${qs}` : ''}`
    );
  }

  async recyclePost(params: { postId: string; type: 'repost' | 'cousin' }) {
    return this.request<{ post: unknown }>(
      'POST',
      `/content-pipeline/posts/${params.postId}/recycle`,
      { type: params.type }
    );
  }

  // ─── Trends ───────────────────────────────────────────────────────────────

  /** Get trending topics from recently scanned creatives. */
  async getTrends(params?: { limit?: number }) {
    const searchParams = new URLSearchParams();
    if (params?.limit !== undefined) searchParams.set('limit', String(params.limit));
    const qs = searchParams.toString();
    return this.request<{ topics: unknown[] }>(
      'GET',
      `/content-pipeline/trends${qs ? `?${qs}` : ''}`
    );
  }
}
