// Encrypted Storage Utilities
// Provides type-safe interfaces for storing and retrieving encrypted secrets
// Uses Supabase Vault functions for encryption/decryption at the database level

import { createSupabaseAdminClient } from './supabase-server';

// =============================================================================
// TYPES
// =============================================================================

export interface UserIntegration {
  id: string;
  user_id: string;
  service: string;
  api_key: string | null;
  webhook_secret: string | null;
  is_active: boolean;
  last_verified_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface UserIntegrationPublic {
  id: string;
  user_id: string;
  service: string;
  is_active: boolean;
  last_verified_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface NotionConnection {
  id: string;
  user_id: string;
  access_token: string;
  workspace_id: string | null;
  workspace_name: string | null;
  workspace_icon: string | null;
  bot_id: string | null;
  default_parent_page_id: string | null;
  default_parent_page_name: string | null;
  token_expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface NotionConnectionPublic {
  id: string;
  user_id: string;
  workspace_id: string | null;
  workspace_name: string | null;
  workspace_icon: string | null;
  bot_id: string | null;
  default_parent_page_id: string | null;
  default_parent_page_name: string | null;
  token_expires_at: string | null;
  created_at: string;
  updated_at: string;
}

// =============================================================================
// USER INTEGRATIONS
// =============================================================================

/**
 * Save or update a user integration with encrypted API key
 * Uses the database-level encryption function
 */
export async function upsertUserIntegration(params: {
  userId: string;
  service: string;
  apiKey?: string | null;
  webhookSecret?: string | null;
  isActive?: boolean;
  metadata?: Record<string, unknown>;
}): Promise<UserIntegrationPublic | null> {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase.rpc('upsert_user_integration', {
    p_user_id: params.userId,
    p_service: params.service,
    p_api_key: params.apiKey ?? null,
    p_webhook_secret: params.webhookSecret ?? null,
    p_is_active: params.isActive ?? true,
    p_metadata: params.metadata ?? {},
  });

  if (error) {
    console.error('Error upserting user integration:', error);
    throw new Error(`Failed to save integration: ${error.message}`);
  }

  // The RPC returns an array, get the first result
  const result = Array.isArray(data) ? data[0] : data;
  return result as UserIntegrationPublic;
}

/**
 * Get a user integration with decrypted API key
 * Only use this when you actually need the API key for making API calls
 */
export async function getUserIntegration(
  userId: string,
  service: string
): Promise<UserIntegration | null> {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase.rpc('get_user_integration', {
    p_user_id: userId,
    p_service: service,
  });

  if (error) {
    console.error('Error getting user integration:', error);
    throw new Error(`Failed to get integration: ${error.message}`);
  }

  // The RPC returns an array, get the first result
  const result = Array.isArray(data) ? data[0] : data;
  return result as UserIntegration | null;
}

/**
 * List user integrations WITHOUT exposing API keys
 * Use this for displaying integration status in the UI
 */
export async function listUserIntegrations(
  userId: string
): Promise<UserIntegrationPublic[]> {
  const supabase = createSupabaseAdminClient();

  // Query the table directly, only selecting non-sensitive columns
  const { data, error } = await supabase
    .from('user_integrations')
    .select('id, user_id, service, is_active, last_verified_at, metadata, created_at, updated_at')
    .eq('user_id', userId);

  if (error) {
    console.error('Error listing user integrations:', error);
    throw new Error(`Failed to list integrations: ${error.message}`);
  }

  return (data ?? []) as UserIntegrationPublic[];
}

/**
 * Update the last_verified_at timestamp for an integration
 */
export async function updateIntegrationVerified(
  userId: string,
  service: string
): Promise<void> {
  const supabase = createSupabaseAdminClient();

  const { error } = await supabase
    .from('user_integrations')
    .update({
      last_verified_at: new Date().toISOString(),
      is_active: true,
    })
    .eq('user_id', userId)
    .eq('service', service);

  if (error) {
    console.error('Error updating integration verified status:', error);
    throw new Error(`Failed to update integration: ${error.message}`);
  }
}

/**
 * Delete a user integration
 */
export async function deleteUserIntegration(
  userId: string,
  service: string
): Promise<void> {
  const supabase = createSupabaseAdminClient();

  const { error } = await supabase
    .from('user_integrations')
    .delete()
    .eq('user_id', userId)
    .eq('service', service);

  if (error) {
    console.error('Error deleting user integration:', error);
    throw new Error(`Failed to delete integration: ${error.message}`);
  }
}

// =============================================================================
// NOTION CONNECTIONS
// =============================================================================

/**
 * Save or update a Notion connection with encrypted access token
 */
export async function upsertNotionConnection(params: {
  userId: string;
  accessToken: string;
  workspaceId?: string | null;
  workspaceName?: string | null;
  workspaceIcon?: string | null;
  botId?: string | null;
}): Promise<NotionConnectionPublic | null> {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase.rpc('upsert_notion_connection', {
    p_user_id: params.userId,
    p_access_token: params.accessToken,
    p_workspace_id: params.workspaceId ?? null,
    p_workspace_name: params.workspaceName ?? null,
    p_workspace_icon: params.workspaceIcon ?? null,
    p_bot_id: params.botId ?? null,
  });

  if (error) {
    console.error('Error upserting notion connection:', error);
    throw new Error(`Failed to save Notion connection: ${error.message}`);
  }

  const result = Array.isArray(data) ? data[0] : data;
  return result as NotionConnectionPublic;
}

/**
 * Get a Notion connection with decrypted access token
 * Only use this when you need the token to make API calls
 */
export async function getNotionConnection(
  userId: string
): Promise<NotionConnection | null> {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase.rpc('get_notion_connection', {
    p_user_id: userId,
  });

  if (error) {
    console.error('Error getting notion connection:', error);
    throw new Error(`Failed to get Notion connection: ${error.message}`);
  }

  const result = Array.isArray(data) ? data[0] : data;
  return result as NotionConnection | null;
}

/**
 * Get Notion connection info WITHOUT the access token
 * Use this for displaying connection status in the UI
 */
export async function getNotionConnectionPublic(
  userId: string
): Promise<NotionConnectionPublic | null> {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from('notion_connections')
    .select('id, user_id, workspace_id, workspace_name, workspace_icon, bot_id, default_parent_page_id, default_parent_page_name, token_expires_at, created_at, updated_at')
    .eq('user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') {
    // PGRST116 is "no rows returned" - that's expected if user has no connection
    console.error('Error getting notion connection:', error);
    throw new Error(`Failed to get Notion connection: ${error.message}`);
  }

  return data as NotionConnectionPublic | null;
}

/**
 * Update Notion connection default parent page
 */
export async function updateNotionDefaultPage(
  userId: string,
  pageId: string,
  pageName: string
): Promise<void> {
  const supabase = createSupabaseAdminClient();

  const { error } = await supabase
    .from('notion_connections')
    .update({
      default_parent_page_id: pageId,
      default_parent_page_name: pageName,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  if (error) {
    console.error('Error updating notion default page:', error);
    throw new Error(`Failed to update Notion default page: ${error.message}`);
  }
}

/**
 * Delete a Notion connection
 */
export async function deleteNotionConnection(userId: string): Promise<void> {
  const supabase = createSupabaseAdminClient();

  const { error } = await supabase
    .from('notion_connections')
    .delete()
    .eq('user_id', userId);

  if (error) {
    console.error('Error deleting notion connection:', error);
    throw new Error(`Failed to delete Notion connection: ${error.message}`);
  }
}
