import {
  createSupabaseAdminClient
} from "../../../../../chunk-MDZYQ24F.mjs";
import {
  logger,
  schedules_exports
} from "../../../../../chunk-RPAAZZEF.mjs";
import "../../../../../chunk-NAHNRDWS.mjs";
import {
  __name,
  init_esm
} from "../../../../../chunk-R7N3VW3I.mjs";

// src/trigger/auto-publish-check.ts
init_esm();

// src/lib/integrations/leadshark.ts
init_esm();

// src/lib/integrations/base-client.ts
init_esm();
var BaseApiClient = class {
  static {
    __name(this, "BaseApiClient");
  }
  constructor(config) {
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.apiKey = config.apiKey;
    this.headers = {
      "Content-Type": "application/json",
      ...config.headers
    };
  }
  async request(method, path, body, customHeaders) {
    const url = `${this.baseUrl}${path}`;
    try {
      const response = await fetch(url, {
        method,
        headers: {
          ...this.headers,
          ...customHeaders
        },
        body: body ? JSON.stringify(body) : void 0
      });
      const status = response.status;
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage;
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.message || errorJson.error || errorText;
        } catch {
          errorMessage = errorText || `HTTP ${status}`;
        }
        console.error(`API Error: ${method} ${url} -> ${status}`, errorMessage);
        return { data: null, error: `HTTP ${status}: ${errorMessage}`, status };
      }
      const text = await response.text();
      if (!text) {
        return { data: null, error: null, status };
      }
      const data = JSON.parse(text);
      return { data, error: null, status };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return { data: null, error: message, status: 0 };
    }
  }
  get(path, headers) {
    return this.request("GET", path, void 0, headers);
  }
  post(path, body, headers) {
    return this.request("POST", path, body, headers);
  }
  async postMultipart(path, formData) {
    const url = `${this.baseUrl}${path}`;
    try {
      const headers = {};
      for (const [key, value] of Object.entries(this.headers)) {
        if (key.toLowerCase() !== "content-type") {
          headers[key] = value;
        }
      }
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: formData
      });
      const status = response.status;
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage;
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.message || errorJson.error || errorText;
        } catch {
          errorMessage = errorText || `HTTP ${status}`;
        }
        console.error(`API Error: POST (multipart) ${url} -> ${status}`, errorMessage);
        return { data: null, error: `HTTP ${status}: ${errorMessage}`, status };
      }
      const text = await response.text();
      if (!text) {
        return { data: null, error: null, status };
      }
      const data = JSON.parse(text);
      return { data, error: null, status };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return { data: null, error: message, status: 0 };
    }
  }
  put(path, body, headers) {
    return this.request("PUT", path, body, headers);
  }
  async putMultipart(path, formData) {
    const url = `${this.baseUrl}${path}`;
    try {
      const headers = {};
      for (const [key, value] of Object.entries(this.headers)) {
        if (key.toLowerCase() !== "content-type") {
          headers[key] = value;
        }
      }
      const response = await fetch(url, {
        method: "PUT",
        headers,
        body: formData
      });
      const status = response.status;
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage;
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.message || errorJson.error || errorText;
        } catch {
          errorMessage = errorText || `HTTP ${status}`;
        }
        console.error(`API Error: PUT (multipart) ${url} -> ${status}`, errorMessage);
        return { data: null, error: `HTTP ${status}: ${errorMessage}`, status };
      }
      const text = await response.text();
      if (!text) {
        return { data: null, error: null, status };
      }
      const data = JSON.parse(text);
      return { data, error: null, status };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return { data: null, error: message, status: 0 };
    }
  }
  patch(path, body, headers) {
    return this.request("PATCH", path, body, headers);
  }
  delete(path, headers) {
    return this.request("DELETE", path, void 0, headers);
  }
};

// src/lib/utils/encrypted-storage.ts
init_esm();
async function getUserIntegration(userId, service) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.from("user_integrations").select("id, user_id, service, api_key, is_active, last_verified_at, metadata, created_at, updated_at").eq("user_id", userId).eq("service", service).single();
  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    console.error("Error getting user integration:", error);
    throw new Error(`Failed to get integration: ${error.message}`);
  }
  return data;
}
__name(getUserIntegration, "getUserIntegration");

// src/lib/integrations/leadshark.ts
var LeadSharkClient = class extends BaseApiClient {
  static {
    __name(this, "LeadSharkClient");
  }
  constructor(config) {
    super({
      baseUrl: "https://apex.leadshark.io",
      headers: {
        "x-api-key": config.apiKey
      }
    });
  }
  // ============================================
  // ENRICHMENT
  // ============================================
  async enrichPerson(linkedinId, sections) {
    const params = new URLSearchParams({ linkedin_id: linkedinId });
    if (sections?.length) {
      params.append("linkedin_sections", sections.join(","));
    }
    return this.get(`/api/enrich/person?${params.toString()}`);
  }
  async enrichCompany(linkedinId) {
    return this.get(`/api/enrich/company?linkedin_id=${linkedinId}`);
  }
  // ============================================
  // LINKEDIN SEARCH
  // ============================================
  /**
   * Search LinkedIn profiles using filters
   * @param params - Search parameters (keywords, location, etc.)
   */
  async searchLinkedIn(params) {
    return this.post("/api/linkedin-search", { params });
  }
  // ============================================
  // AUTOMATIONS
  // ============================================
  async listAutomations() {
    return this.get("/api/automations");
  }
  async getAutomation(id) {
    return this.get(`/api/automations/${id}`);
  }
  async createAutomation(data) {
    return this.post("/api/automations", data);
  }
  async updateAutomation(id, data) {
    return this.put(`/api/automations/${id}`, data);
  }
  async deleteAutomation(id) {
    return this.delete(`/api/automations/${id}`);
  }
  // ============================================
  // SCHEDULED POSTS
  // ============================================
  async listScheduledPosts() {
    return this.get("/api/scheduled-posts");
  }
  async getScheduledPost(id) {
    return this.get(`/api/scheduled-posts?id=${id}`);
  }
  async createScheduledPost(data) {
    const jsonResult = await this.post("/api/scheduled-posts", {
      content: data.content,
      scheduled_time: data.scheduled_time,
      is_public: data.is_public ?? true,
      automation: data.automation
    });
    if (!jsonResult.error || jsonResult.status !== 405) {
      return jsonResult;
    }
    const formData = new FormData();
    formData.append("content", data.content);
    formData.append("scheduled_time", data.scheduled_time);
    if (data.is_public !== void 0) {
      formData.append("is_public", String(data.is_public));
    }
    if (data.automation) {
      formData.append("automation", JSON.stringify(data.automation));
    }
    return this.postMultipart("/api/scheduled-posts", formData);
  }
  async updateScheduledPost(id, data) {
    const formData = new FormData();
    if (data.content) formData.append("content", data.content);
    if (data.scheduled_time) formData.append("scheduled_time", data.scheduled_time);
    if (data.is_public !== void 0) formData.append("is_public", String(data.is_public));
    if (data.automation) formData.append("automation", JSON.stringify(data.automation));
    return this.putMultipart(`/api/scheduled-posts?id=${id}`, formData);
  }
  async deleteScheduledPost(id) {
    return this.delete(`/api/scheduled-posts?id=${id}`);
  }
  // ============================================
  // POST STATS
  // ============================================
  async listPostStats(limit = 10, cursor) {
    const params = new URLSearchParams({ limit: limit.toString() });
    if (cursor) params.append("cursor", cursor);
    return this.get(`/api/post-stats?${params.toString()}`);
  }
  // ============================================
  // BOOKMARKS
  // ============================================
  /**
   * List bookmarked LinkedIn profiles
   */
  async listBookmarks(options) {
    const params = new URLSearchParams();
    if (options?.page) params.append("page", options.page.toString());
    if (options?.limit) params.append("limit", options.limit.toString());
    if (options?.search) params.append("search", options.search);
    if (options?.tag_id) params.append("tag_id", options.tag_id);
    const query = params.toString();
    return this.get(`/api/bookmarks${query ? `?${query}` : ""}`);
  }
  /**
   * List all bookmark tags
   */
  async listBookmarkTags() {
    return this.get("/api/bookmarks/tags");
  }
  /**
   * Create or update a bookmark (updates if linkedin_id already exists)
   */
  async createBookmark(data) {
    return this.post("/api/bookmarks", data);
  }
  /**
   * Update a bookmark by ID
   */
  async updateBookmark(id, data) {
    return this.put(`/api/bookmarks/${id}`, data);
  }
  /**
   * Delete a bookmark
   */
  async deleteBookmark(id) {
    return this.delete(`/api/bookmarks/${id}`);
  }
  // ============================================
  // HEALTH CHECK
  // ============================================
  async verifyConnection() {
    const result = await this.listAutomations();
    if (result.error) {
      return { connected: false, error: result.error };
    }
    return { connected: true };
  }
};
async function getUserLeadSharkClient(userId) {
  const integration = await getUserIntegration(userId, "leadshark");
  if (!integration?.api_key || !integration.is_active) {
    return null;
  }
  return new LeadSharkClient({ apiKey: integration.api_key });
}
__name(getUserLeadSharkClient, "getUserLeadSharkClient");

// src/trigger/auto-publish-check.ts
var autoPublishCheck = schedules_exports.task({
  id: "auto-publish-check",
  cron: "0 * * * *",
  // Every hour
  maxDuration: 300,
  run: /* @__PURE__ */ __name(async () => {
    const supabase = createSupabaseAdminClient();
    logger.info("Starting auto-publish check");
    const { data: posts, error } = await supabase.from("cp_pipeline_posts").select("id, user_id, draft_content, final_content, scheduled_time, auto_publish_after").eq("status", "approved").not("auto_publish_after", "is", null).lte("auto_publish_after", (/* @__PURE__ */ new Date()).toISOString()).limit(20);
    if (error) {
      logger.error("Failed to query auto-publish posts", { error: error.message });
      return { processed: 0, errors: [error.message] };
    }
    if (!posts || posts.length === 0) {
      logger.info("No posts ready for auto-publish");
      return { processed: 0, errors: [] };
    }
    logger.info(`Found ${posts.length} posts ready for auto-publish`);
    let published = 0;
    const errors = [];
    for (const post of posts) {
      try {
        const content = post.final_content || post.draft_content;
        if (!content) {
          logger.warn(`Post ${post.id} has no content, skipping`);
          continue;
        }
        const scheduledTime = post.scheduled_time || (/* @__PURE__ */ new Date()).toISOString();
        let leadshark = null;
        try {
          leadshark = await getUserLeadSharkClient(post.user_id);
        } catch (lsErr) {
          logger.warn(`Failed to get LeadShark client for user ${post.user_id}`, {
            error: lsErr instanceof Error ? lsErr.message : String(lsErr)
          });
        }
        if (leadshark) {
          const result = await leadshark.createScheduledPost({
            content,
            scheduled_time: scheduledTime
          });
          if (result.error) {
            throw new Error(`LeadShark error: ${result.error}`);
          }
          await supabase.from("cp_pipeline_posts").update({
            status: "scheduled",
            leadshark_post_id: result.data?.id || null
          }).eq("id", post.id);
          logger.info(`Post ${post.id} scheduled via LeadShark`, { leadsharkId: result.data?.id });
        } else {
          await supabase.from("cp_pipeline_posts").update({ status: "scheduled" }).eq("id", post.id);
          logger.info(`Post ${post.id} marked as scheduled (no LeadShark)`);
        }
        published++;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        logger.error(`Failed to auto-publish post ${post.id}`, { error: message });
        errors.push(`Post ${post.id}: ${message}`);
        await supabase.from("cp_pipeline_posts").update({ status: "failed" }).eq("id", post.id);
      }
    }
    logger.info(`Auto-publish complete: ${published} published, ${errors.length} errors`);
    return { processed: published, errors };
  }, "run")
});
export {
  autoPublishCheck
};
//# sourceMappingURL=auto-publish-check.mjs.map
