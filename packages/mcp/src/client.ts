// packages/mcp/src/client.ts

import type {
  Archetype,
  LeadMagnetStatus,
  FunnelTheme,
  BackgroundStyle,
  FunnelTargetType,
  IdeaStatus,
  ContentPillar,
  ContentType,
  KnowledgeCategory,
  KnowledgeType,
  ReadinessGoal,
  PipelinePostStatus,
  AnalyticsPeriod,
  ExtractContentType,
} from './constants.js'

const DEFAULT_BASE_URL = 'https://www.magnetlab.app/api'

export interface MagnetLabClientOptions {
  baseUrl?: string
}

// Default timeout for regular API calls (15 seconds)
const DEFAULT_TIMEOUT_MS = 15_000
// Extended timeout for AI generation calls (120 seconds)
const AI_TIMEOUT_MS = 120_000

export class MagnetLabClient {
  private apiKey: string
  private baseUrl: string

  constructor(apiKey: string, options: MagnetLabClientOptions = {}) {
    this.apiKey = apiKey
    this.baseUrl = options.baseUrl || DEFAULT_BASE_URL
  }

  async request<T>(method: string, path: string, body?: unknown, timeoutMs?: number): Promise<T> {
    const url = `${this.baseUrl}${path}`
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    }

    const controller = new AbortController()
    const timeout = timeoutMs ?? DEFAULT_TIMEOUT_MS
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    try {
      let response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        redirect: 'manual',
        signal: controller.signal,
      })

      // Follow redirects manually to preserve the Authorization header
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location')
        if (location) {
          response = await fetch(location, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined,
            redirect: 'manual',
            signal: controller.signal,
          })
        }
      }

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(error.error || `Request failed: ${response.status}`)
      }

      // Handle CSV responses (exports)
      const contentType = response.headers.get('content-type')
      if (contentType?.includes('text/csv')) {
        return { csv: await response.text() } as T
      }

      return response.json()
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new Error(`Request timed out after ${Math.round(timeout / 1000)}s — try again or use a simpler operation`)
      }
      throw err
    } finally {
      clearTimeout(timeoutId)
    }
  }

  /** Make a request with extended timeout for AI generation operations */
  async aiRequest<T>(method: string, path: string, body?: unknown): Promise<T> {
    return this.request<T>(method, path, body, AI_TIMEOUT_MS)
  }

  // ============================================================
  // Lead Magnets
  // ============================================================

  async listLeadMagnets(params?: {
    status?: LeadMagnetStatus
    limit?: number
    offset?: number
  }) {
    const searchParams = new URLSearchParams()
    if (params?.status) searchParams.set('status', params.status)
    if (params?.limit) searchParams.set('limit', String(params.limit))
    if (params?.offset) searchParams.set('offset', String(params.offset))
    return this.request<{ leadMagnets: unknown[]; total: number }>('GET', `/lead-magnet?${searchParams}`)
  }

  async getLeadMagnet(id: string) {
    return this.request<unknown>('GET', `/lead-magnet/${id}`)
  }

  async createLeadMagnet(params: {
    title: string
    archetype: Archetype
    concept?: unknown
    extractedContent?: unknown
    linkedinPost?: string
    postVariations?: unknown
    dmTemplate?: string
    ctaWord?: string
  }) {
    return this.request<unknown>('POST', `/lead-magnet`, params)
  }

  async deleteLeadMagnet(id: string) {
    return this.request<{ success: boolean }>('DELETE', `/lead-magnet/${id}`)
  }

  async ideateLeadMagnets(params: {
    businessDescription: string
    businessType: string
    credibilityMarkers?: string[]
    urgentPains?: string[]
    templates?: string[]
    processes?: string[]
    tools?: string[]
    frequentQuestions?: string[]
    results?: string[]
    successExample?: string
  }) {
    return this.aiRequest<{ jobId: string; status: string }>('POST', `/lead-magnet/ideate`, params)
  }

  async extractContent(leadMagnetId: string, params: {
    archetype: Archetype
    concept: unknown
    answers: Record<string, string>
  }) {
    return this.aiRequest<unknown>('POST', `/lead-magnet/extract`, { ...params, leadMagnetId })
  }

  async generateContent(leadMagnetId: string, params: {
    archetype: Archetype
    concept: unknown
    answers: Record<string, string>
  }) {
    return this.aiRequest<unknown>('POST', `/lead-magnet/generate`, { ...params, leadMagnetId })
  }

  async writeLinkedInPosts(leadMagnetId: string, params: {
    leadMagnetTitle: string
    contents: string
    problemSolved: string
  }) {
    return this.aiRequest<unknown>('POST', `/lead-magnet/write-post`, { ...params, leadMagnetId })
  }

  async polishLeadMagnetContent(leadMagnetId: string) {
    return this.aiRequest<unknown>('POST', `/lead-magnet/${leadMagnetId}/polish`, {})
  }

  async getLeadMagnetStats(leadMagnetId: string) {
    return this.request<{
      success: boolean
      data: { leadMagnetId: string; views: number; leads: number; conversionRate: number }
    }>('GET', `/external/lead-magnets/${leadMagnetId}/stats`)
  }

  async importLeadMagnet(data: unknown) {
    return this.request<unknown>('POST', `/lead-magnet/import`, data)
  }

  async analyzeCompetitor(params: { url: string }) {
    return this.aiRequest<unknown>('POST', `/lead-magnet/analyze-competitor`, params)
  }

  async analyzeTranscript(params: { transcript: string }) {
    return this.aiRequest<unknown>('POST', `/lead-magnet/analyze-transcript`, params)
  }

  // ============================================================
  // Funnels
  // ============================================================

  async listFunnels() {
    return this.request<{ funnels: unknown[] }>('GET', `/funnel/all`)
  }

  async getFunnel(id: string) {
    return this.request<{ funnel: unknown }>('GET', `/funnel/${id}`)
  }

  async getFunnelByTarget(params: {
    leadMagnetId?: string
    libraryId?: string
    externalResourceId?: string
  }) {
    const searchParams = new URLSearchParams()
    if (params.leadMagnetId) searchParams.set('leadMagnetId', params.leadMagnetId)
    if (params.libraryId) searchParams.set('libraryId', params.libraryId)
    if (params.externalResourceId) searchParams.set('externalResourceId', params.externalResourceId)
    return this.request<{ funnel: unknown | null }>('GET', `/funnel?${searchParams}`)
  }

  async createFunnel(params: {
    leadMagnetId?: string
    libraryId?: string
    externalResourceId?: string
    targetType?: FunnelTargetType
    slug: string
    optinHeadline?: string
    optinSubline?: string
    optinButtonText?: string
    optinSocialProof?: string
    thankyouHeadline?: string
    thankyouSubline?: string
    vslUrl?: string
    calendlyUrl?: string
    theme?: FunnelTheme
    primaryColor?: string
    backgroundStyle?: BackgroundStyle
    logoUrl?: string
    qualificationFormId?: string
  }) {
    return this.request<{ funnel: unknown }>('POST', `/funnel`, params)
  }

  async updateFunnel(id: string, params: {
    slug?: string
    optinHeadline?: string
    optinSubline?: string
    optinButtonText?: string
    optinSocialProof?: string
    thankyouHeadline?: string
    thankyouSubline?: string
    vslUrl?: string
    calendlyUrl?: string
    theme?: FunnelTheme
    primaryColor?: string
    backgroundStyle?: BackgroundStyle
    logoUrl?: string
    qualificationFormId?: string | null
    qualificationPassMessage?: string
    qualificationFailMessage?: string
    redirectTrigger?: string
    redirectUrl?: string | null
    redirectFailUrl?: string | null
    homepageUrl?: string | null
    homepageLabel?: string | null
    sendResourceEmail?: boolean
  }) {
    return this.request<{ funnel: unknown }>('PUT', `/funnel/${id}`, params)
  }

  async deleteFunnel(id: string) {
    return this.request<{ success: boolean }>('DELETE', `/funnel/${id}`)
  }

  async publishFunnel(id: string) {
    return this.request<{ funnel: unknown; publicUrl: string | null }>('POST', `/funnel/${id}/publish`, { publish: true })
  }

  async unpublishFunnel(id: string) {
    return this.request<{ funnel: unknown }>('POST', `/funnel/${id}/publish`, { publish: false })
  }

  async getFunnelStats() {
    return this.request<{ stats: Record<string, unknown> }>('GET', `/funnel/stats`)
  }

  async generateFunnelContent(params: { leadMagnetId: string }) {
    return this.aiRequest<unknown>('POST', `/funnel/generate-content`, params)
  }

  // ============================================================
  // Leads
  // ============================================================

  async listLeads(params?: {
    funnelId?: string
    leadMagnetId?: string
    qualified?: boolean
    search?: string
    limit?: number
    offset?: number
  }) {
    const searchParams = new URLSearchParams()
    if (params?.funnelId) searchParams.set('funnelId', params.funnelId)
    if (params?.leadMagnetId) searchParams.set('leadMagnetId', params.leadMagnetId)
    if (params?.qualified !== undefined) searchParams.set('qualified', String(params.qualified))
    if (params?.search) searchParams.set('search', params.search)
    if (params?.limit) searchParams.set('limit', String(params.limit))
    if (params?.offset) searchParams.set('offset', String(params.offset))
    return this.request<{ leads: unknown[]; total: number }>('GET', `/leads?${searchParams}`)
  }

  async exportLeads(params?: {
    funnelId?: string
    leadMagnetId?: string
    qualified?: boolean
  }) {
    const searchParams = new URLSearchParams()
    if (params?.funnelId) searchParams.set('funnelId', params.funnelId)
    if (params?.leadMagnetId) searchParams.set('leadMagnetId', params.leadMagnetId)
    if (params?.qualified !== undefined) searchParams.set('qualified', String(params.qualified))
    return this.request<{ csv: string }>('GET', `/leads/export?${searchParams}`)
  }

  // ============================================================
  // Brand Kit
  // ============================================================

  async getBrandKit() {
    return this.request<{
      brandKit: unknown | null
      savedIdeation: unknown | null
      ideationGeneratedAt: string | null
    }>('GET', `/brand-kit`)
  }

  async updateBrandKit(params: {
    businessDescription?: string
    businessType?: string
    credibilityMarkers?: string[]
    urgentPains?: string[]
    templates?: string[]
    processes?: string[]
    tools?: string[]
    frequentQuestions?: string[]
    results?: string[]
    successExample?: string
    audienceTools?: string[]
    preferredTone?: string
    styleProfile?: unknown
  }) {
    return this.request<unknown>('POST', `/brand-kit`, params)
  }

  async extractBusinessContext(params: {
    content: string
    contentType?: ExtractContentType
  }) {
    return this.aiRequest<unknown>('POST', `/brand-kit/extract`, params)
  }

  // ============================================================
  // Email Sequences
  // ============================================================

  async getEmailSequence(leadMagnetId: string) {
    return this.request<{ emailSequence: unknown | null }>('GET', `/email-sequence/${leadMagnetId}`)
  }

  async generateEmailSequence(params: {
    leadMagnetId: string
    useAI?: boolean
  }) {
    return this.aiRequest<{ emailSequence: unknown; generated: boolean }>('POST', `/email-sequence/generate`, params)
  }

  async updateEmailSequence(leadMagnetId: string, params: {
    emails?: Array<{
      day: number
      subject: string
      body: string
      replyTrigger: string
    }>
    status?: 'draft' | 'synced' | 'active'
  }) {
    return this.request<{ emailSequence: unknown }>('PUT', `/email-sequence/${leadMagnetId}`, params)
  }

  async activateEmailSequence(leadMagnetId: string) {
    return this.request<unknown>('POST', `/email-sequence/${leadMagnetId}/activate`, {})
  }

  // ============================================================
  // Email System — Flows
  // ============================================================

  async listEmailFlows() {
    return this.request<{ flows: unknown[] }>('GET', '/email/flows')
  }

  async getEmailFlow(id: string) {
    return this.request<{ flow: unknown }>('GET', `/email/flows/${id}`)
  }

  async createEmailFlow(params: {
    name: string
    trigger_type: 'lead_magnet' | 'manual'
    description?: string
    trigger_lead_magnet_id?: string
  }) {
    return this.request<{ flow: unknown }>('POST', '/email/flows', params)
  }

  async updateEmailFlow(id: string, params: {
    name?: string
    description?: string | null
    status?: 'draft' | 'active' | 'paused'
    trigger_type?: 'lead_magnet' | 'manual'
    trigger_lead_magnet_id?: string | null
  }) {
    return this.request<{ flow: unknown }>('PUT', `/email/flows/${id}`, params)
  }

  async deleteEmailFlow(id: string) {
    return this.request<void>('DELETE', `/email/flows/${id}`)
  }

  async addFlowStep(flowId: string, params: {
    step_number: number
    subject: string
    body: string
    delay_days: number
  }) {
    return this.request<{ step: unknown }>('POST', `/email/flows/${flowId}/steps`, params)
  }

  async generateFlowEmails(flowId: string, stepCount?: number) {
    return this.aiRequest<unknown>('POST', `/email/flows/${flowId}/generate`, stepCount ? { stepCount } : {})
  }

  // ============================================================
  // Email System — Broadcasts
  // ============================================================

  async listBroadcasts() {
    return this.request<{ broadcasts: unknown[] }>('GET', '/email/broadcasts')
  }

  async getBroadcast(id: string) {
    return this.request<{ broadcast: unknown }>('GET', `/email/broadcasts/${id}`)
  }

  async createBroadcast(params?: { subject?: string; body?: string }) {
    return this.request<{ broadcast: unknown }>('POST', '/email/broadcasts', params || {})
  }

  async updateBroadcast(id: string, params: {
    subject?: string
    body?: string
    audience_filter?: { engagement?: string; source?: string } | null
  }) {
    return this.request<{ broadcast: unknown }>('PUT', `/email/broadcasts/${id}`, params)
  }

  async sendBroadcast(id: string) {
    return this.request<{ message: string; recipientCount: number }>('POST', `/email/broadcasts/${id}/send`, {})
  }

  // ============================================================
  // Email System — Subscribers
  // ============================================================

  async listSubscribers(params?: {
    search?: string
    status?: string
    source?: string
    page?: number
    limit?: number
  }) {
    const searchParams = new URLSearchParams()
    if (params?.search) searchParams.set('search', params.search)
    if (params?.status) searchParams.set('status', params.status)
    if (params?.source) searchParams.set('source', params.source)
    if (params?.page) searchParams.set('page', String(params.page))
    if (params?.limit) searchParams.set('limit', String(params.limit))
    return this.request<{ subscribers: unknown[]; total: number; page: number; limit: number }>(
      'GET',
      `/email/subscribers?${searchParams}`
    )
  }

  async addSubscriber(params: { email: string; first_name?: string; last_name?: string }) {
    return this.request<{ subscriber: unknown }>('POST', '/email/subscribers', params)
  }

  async unsubscribeSubscriber(id: string) {
    return this.request<{ message: string }>('DELETE', `/email/subscribers/${id}`)
  }

  // ============================================================
  // Content Pipeline - Transcripts
  // ============================================================

  async listTranscripts() {
    return this.request<{ transcripts: unknown[] }>('GET', `/content-pipeline/transcripts`)
  }

  async submitTranscript(params: { transcript: string; title?: string }) {
    return this.request<{ success: boolean; transcript_id: string }>('POST', `/content-pipeline/transcripts`, params)
  }

  async deleteTranscript(id: string) {
    return this.request<{ success: boolean }>('DELETE', `/content-pipeline/transcripts?id=${id}`)
  }

  // ============================================================
  // Content Pipeline - Knowledge Base
  // ============================================================

  async searchKnowledge(params: {
    query?: string
    category?: KnowledgeCategory
    view?: 'tags'
    type?: KnowledgeType
    topic?: string
    min_quality?: number
    since?: string
  }) {
    const searchParams = new URLSearchParams()
    if (params.query) searchParams.set('q', params.query)
    if (params.category) searchParams.set('category', params.category)
    if (params.view) searchParams.set('view', params.view)
    if (params.type) searchParams.set('type', params.type)
    if (params.topic) searchParams.set('topic', params.topic)
    if (params.min_quality) searchParams.set('min_quality', String(params.min_quality))
    if (params.since) searchParams.set('since', params.since)
    return this.request<{ entries?: unknown[]; tags?: unknown[]; total_count?: number }>(
      'GET',
      `/content-pipeline/knowledge?${searchParams}`
    )
  }

  async getKnowledgeClusters() {
    return this.request<{ clusters: unknown[] }>('GET', `/content-pipeline/knowledge/clusters`)
  }

  async askKnowledge(params: { question: string }) {
    return this.aiRequest<{ answer: string; sources: unknown[] }>(
      'POST',
      `/content-pipeline/knowledge/ask`,
      params
    )
  }

  async getKnowledgeGaps() {
    return this.request<{ gaps: unknown[] }>('GET', `/content-pipeline/knowledge/gaps`)
  }

  async getKnowledgeReadiness(params: { topic: string; goal: ReadinessGoal }) {
    const searchParams = new URLSearchParams({ topic: params.topic, goal: params.goal })
    return this.request<{ readiness: unknown }>(
      'GET',
      `/content-pipeline/knowledge/readiness?${searchParams}`
    )
  }

  async getRecentKnowledge(params: { days?: number }) {
    const searchParams = params.days ? `?days=${params.days}` : ''
    return this.request<{ digest: unknown }>(
      'GET',
      `/content-pipeline/knowledge/recent${searchParams}`
    )
  }

  async exportKnowledge(params: { topic: string; format?: string }) {
    const searchParams = new URLSearchParams({ topic: params.topic })
    if (params.format) searchParams.set('format', params.format)
    return this.request<{ export: unknown }>(
      'GET',
      `/content-pipeline/knowledge/export?${searchParams}`
    )
  }

  async listKnowledgeTopics(params?: { limit?: number }) {
    const searchParams = params?.limit ? `?limit=${params.limit}` : ''
    return this.request<{ topics: unknown[] }>(
      'GET',
      `/content-pipeline/knowledge/topics${searchParams}`
    )
  }

  async getTopicDetail(slug: string) {
    return this.request<{ topic: unknown }>(
      'GET',
      `/content-pipeline/knowledge/topics/${slug}`
    )
  }

  // ============================================================
  // Content Pipeline - Ideas
  // ============================================================

  async listIdeas(params?: {
    status?: IdeaStatus
    pillar?: ContentPillar
    contentType?: ContentType
    limit?: number
  }) {
    const searchParams = new URLSearchParams()
    if (params?.status) searchParams.set('status', params.status)
    if (params?.pillar) searchParams.set('pillar', params.pillar)
    if (params?.contentType) searchParams.set('content_type', params.contentType)
    if (params?.limit) searchParams.set('limit', String(params.limit))
    return this.request<{ ideas: unknown[] }>('GET', `/content-pipeline/ideas?${searchParams}`)
  }

  async updateIdeaStatus(ideaId: string, status: IdeaStatus) {
    return this.request<{ idea: unknown }>('PATCH', `/content-pipeline/ideas`, { ideaId, status })
  }

  async getIdea(id: string) {
    return this.request<{ idea: unknown }>('GET', `/content-pipeline/ideas/${id}`)
  }

  async deleteIdea(id: string) {
    return this.request<{ success: boolean }>('DELETE', `/content-pipeline/ideas/${id}`)
  }

  async writePostFromIdea(ideaId: string) {
    return this.aiRequest<unknown>('POST', `/content-pipeline/ideas/${ideaId}/write`, {})
  }

  // ============================================================
  // Content Pipeline - Posts
  // ============================================================

  async listPosts(params?: {
    status?: PipelinePostStatus
    isBuffer?: boolean
    limit?: number
  }) {
    const searchParams = new URLSearchParams()
    if (params?.status) searchParams.set('status', params.status)
    if (params?.isBuffer !== undefined) searchParams.set('is_buffer', String(params.isBuffer))
    if (params?.limit) searchParams.set('limit', String(params.limit))
    return this.request<{ posts: unknown[] }>('GET', `/content-pipeline/posts?${searchParams}`)
  }

  async getPost(id: string) {
    return this.request<{ post: unknown }>('GET', `/content-pipeline/posts/${id}`)
  }

  async updatePost(id: string, params: Record<string, unknown>) {
    return this.request<{ post: unknown }>('PATCH', `/content-pipeline/posts/${id}`, params)
  }

  async deletePost(id: string) {
    return this.request<{ success: boolean }>('DELETE', `/content-pipeline/posts/${id}`)
  }

  async polishPost(id: string) {
    return this.aiRequest<{ success: boolean; polishResult: unknown }>('POST', `/content-pipeline/posts/${id}/polish`, {})
  }

  async publishPost(id: string) {
    return this.request<unknown>('POST', `/content-pipeline/posts/${id}/publish`, {})
  }

  async schedulePost(params: { postId: string; scheduledTime: string }) {
    return this.request<unknown>('POST', `/content-pipeline/posts/schedule`, params)
  }

  async getPostsByDateRange(params: { startDate: string; endDate: string }) {
    const searchParams = new URLSearchParams()
    searchParams.set('start_date', params.startDate)
    searchParams.set('end_date', params.endDate)
    return this.request<{ posts: unknown[] }>('GET', `/content-pipeline/posts/by-date-range?${searchParams}`)
  }

  async quickWritePost(params: { topic: string; style?: string; template?: string }) {
    return this.aiRequest<unknown>('POST', `/content-pipeline/quick-write`, params)
  }

  // ============================================================
  // Content Pipeline - Schedule & Autopilot
  // ============================================================

  async listPostingSlots() {
    return this.request<{ slots: unknown[] }>('GET', `/content-pipeline/schedule/slots`)
  }

  async createPostingSlot(params: { dayOfWeek: number; time: string }) {
    return this.request<{ slot: unknown }>('POST', `/content-pipeline/schedule/slots`, params)
  }

  async updatePostingSlot(id: string, params: { dayOfWeek?: number; time?: string }) {
    return this.request<{ slot: unknown }>('PUT', `/content-pipeline/schedule/slots/${id}`, params)
  }

  async deletePostingSlot(id: string) {
    return this.request<{ success: boolean }>('DELETE', `/content-pipeline/schedule/slots/${id}`)
  }

  async getAutopilotStatus() {
    return this.request<{
      bufferSize: number
      nextScheduledSlot: string
      pillarCounts: Record<string, number>
    }>('GET', `/content-pipeline/schedule/autopilot`)
  }

  async triggerAutopilot(params?: {
    postsPerBatch?: number
    bufferTarget?: number
    autoPublish?: boolean
  }) {
    return this.request<{ triggered: boolean; runId: string }>('POST', `/content-pipeline/schedule/autopilot`, params || {})
  }

  async getBuffer() {
    return this.request<{ posts: unknown[] }>('GET', `/content-pipeline/schedule/buffer`)
  }

  // ============================================================
  // Content Pipeline - Styles & Templates
  // ============================================================

  async listWritingStyles() {
    return this.request<{ styles: unknown[] }>('GET', `/content-pipeline/styles`)
  }

  async extractWritingStyle(params: { linkedinUrl: string }) {
    return this.aiRequest<unknown>('POST', `/content-pipeline/styles/extract`, params)
  }

  async getWritingStyle(id: string) {
    return this.request<{ style: unknown }>('GET', `/content-pipeline/styles/${id}`)
  }

  async listTemplates(params?: { limit?: number }) {
    const searchParams = new URLSearchParams()
    if (params?.limit) searchParams.set('limit', String(params.limit))
    return this.request<{ templates: unknown[] }>('GET', `/content-pipeline/templates?${searchParams}`)
  }

  async getTemplate(id: string) {
    return this.request<{ template: unknown }>('GET', `/content-pipeline/templates/${id}`)
  }

  async matchTemplate(params: { ideaId: string }) {
    return this.request<{ matches: unknown[] }>('POST', `/content-pipeline/templates/match`, params)
  }

  // ============================================================
  // Content Pipeline - Planner
  // ============================================================

  async getPlan() {
    return this.request<{ plan: unknown }>('GET', `/content-pipeline/planner`)
  }

  async generatePlan(params?: { weekCount?: number }) {
    return this.aiRequest<unknown>('POST', `/content-pipeline/planner/generate`, params || {})
  }

  async approvePlan(params: { planId: string }) {
    return this.request<unknown>('POST', `/content-pipeline/planner/approve`, params)
  }

  async updatePlanItem(id: string, params: Record<string, unknown>) {
    return this.request<unknown>('PATCH', `/content-pipeline/planner/${id}`, params)
  }

  // ============================================================
  // Content Pipeline - Business Context
  // ============================================================

  async getBusinessContext() {
    return this.request<{ businessContext: unknown }>('GET', `/content-pipeline/business-context`)
  }

  async updateBusinessContext(params: Record<string, unknown>) {
    return this.request<unknown>('POST', `/content-pipeline/business-context`, params)
  }

  // ============================================================
  // Swipe File
  // ============================================================

  async browseSwipeFilePosts(params?: {
    niche?: string
    type?: string
    featured?: boolean
    limit?: number
    offset?: number
  }) {
    const searchParams = new URLSearchParams()
    if (params?.niche) searchParams.set('niche', params.niche)
    if (params?.type) searchParams.set('type', params.type)
    if (params?.featured) searchParams.set('featured', 'true')
    if (params?.limit) searchParams.set('limit', String(params.limit))
    if (params?.offset) searchParams.set('offset', String(params.offset))
    return this.request<{ posts: unknown[]; total: number }>('GET', `/swipe-file/posts?${searchParams}`)
  }

  async browseSwipeFileLeadMagnets(params?: {
    niche?: string
    format?: string
    featured?: boolean
    limit?: number
    offset?: number
  }) {
    const searchParams = new URLSearchParams()
    if (params?.niche) searchParams.set('niche', params.niche)
    if (params?.format) searchParams.set('format', params.format)
    if (params?.featured) searchParams.set('featured', 'true')
    if (params?.limit) searchParams.set('limit', String(params.limit))
    if (params?.offset) searchParams.set('offset', String(params.offset))
    return this.request<{ leadMagnets: unknown[]; total: number }>('GET', `/swipe-file/lead-magnets?${searchParams}`)
  }

  async submitToSwipeFile(params: { content: string; type: string; niche: string }) {
    return this.request<unknown>('POST', `/swipe-file/submit`, params)
  }

  // ============================================================
  // Analytics
  // ============================================================

  async getFunnelAnalytics() {
    return this.request<{ stats: Record<string, unknown> }>('GET', `/funnel/stats`)
  }

  async getLeadMagnetAnalytics(leadMagnetId: string) {
    return this.request<{
      success: boolean
      data: { leadMagnetId: string; views: number; leads: number; conversionRate: number }
    }>('GET', `/external/lead-magnets/${leadMagnetId}/stats`)
  }

  // ============================================================
  // Libraries
  // ============================================================

  async listLibraries() {
    return this.request<{ libraries: unknown[] }>('GET', `/libraries`)
  }

  async getLibrary(id: string) {
    return this.request<{ library: unknown }>('GET', `/libraries/${id}`)
  }

  async createLibrary(params: { name: string; description?: string }) {
    return this.request<{ library: unknown }>('POST', `/libraries`, params)
  }

  async updateLibrary(id: string, params: { name?: string; description?: string }) {
    return this.request<{ library: unknown }>('PUT', `/libraries/${id}`, params)
  }

  async deleteLibrary(id: string) {
    return this.request<{ success: boolean }>('DELETE', `/libraries/${id}`)
  }

  async listLibraryItems(libraryId: string) {
    return this.request<{ items: unknown[] }>('GET', `/libraries/${libraryId}/items`)
  }

  async createLibraryItem(libraryId: string, params: Record<string, unknown>) {
    return this.request<{ item: unknown }>('POST', `/libraries/${libraryId}/items`, params)
  }

  // ============================================================
  // External Resources
  // ============================================================

  async listExternalResources() {
    return this.request<{ resources: unknown[] }>('GET', `/external-resources`)
  }

  async getExternalResource(id: string) {
    return this.request<{ resource: unknown }>('GET', `/external-resources/${id}`)
  }

  async createExternalResource(params: { title: string; url: string; description?: string }) {
    return this.request<{ resource: unknown }>('POST', `/external-resources`, params)
  }

  // ============================================================
  // Qualification Forms
  // ============================================================

  async listQualificationForms() {
    return this.request<{ forms: unknown[] }>('GET', `/qualification-forms`)
  }

  async getQualificationForm(id: string) {
    return this.request<{ form: unknown }>('GET', `/qualification-forms/${id}`)
  }

  async createQualificationForm(params: { name: string }) {
    return this.request<{ form: unknown }>('POST', `/qualification-forms`, params)
  }

  async listQuestions(formId: string) {
    return this.request<{ questions: unknown[] }>('GET', `/qualification-forms/${formId}/questions`)
  }

  async createQuestion(formId: string, params: Record<string, unknown>) {
    return this.request<{ question: unknown }>('POST', `/qualification-forms/${formId}/questions`, params)
  }

  // ============================================================
  // Integrations
  // ============================================================

  async listIntegrations() {
    return this.request<{ integrations: unknown[] }>('GET', `/integrations`)
  }

  async verifyIntegration(params: { provider: string; apiKey: string }) {
    return this.request<{ valid: boolean }>('POST', `/integrations/verify`, params)
  }

  // ============================================================
  // Jobs
  // ============================================================

  async getJobStatus(id: string) {
    return this.request<unknown>('GET', `/jobs/${id}`)
  }
}
