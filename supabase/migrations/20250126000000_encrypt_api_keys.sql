-- Migration: Encrypt API Keys at Rest
-- Uses pgsodium for field-level encryption of sensitive credentials
-- This provides transparent column encryption using authenticated encryption

-- Enable required extensions (pgsodium is usually pre-enabled on Supabase)
CREATE EXTENSION IF NOT EXISTS pgsodium WITH SCHEMA pgsodium;

-- =============================================================================
-- CREATE ENCRYPTION KEY
-- =============================================================================

-- Create a named key for encrypting application secrets
-- The key is managed by pgsodium and never exposed to the application
DO $$
BEGIN
  -- Check if our key already exists
  IF NOT EXISTS (
    SELECT 1 FROM pgsodium.valid_key WHERE name = 'magnetlab_secrets_key'
  ) THEN
    -- Create a new key for our secrets
    PERFORM pgsodium.create_key(
      name := 'magnetlab_secrets_key',
      key_type := 'aead-det'
    );
  END IF;
END $$;

-- =============================================================================
-- ENCRYPTION HELPER FUNCTIONS
-- =============================================================================

-- These functions provide a consistent interface for encrypting/decrypting
-- sensitive data. They use pgsodium's deterministic authenticated encryption
-- (AEAD) which is suitable for column-level encryption.

-- Encrypt function: Takes plaintext and returns encrypted bytea as base64
-- Uses our named encryption key
CREATE OR REPLACE FUNCTION encrypt_secret(secret TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  encrypted_bytes BYTEA;
  key_id BIGINT;
BEGIN
  IF secret IS NULL OR secret = '' THEN
    RETURN NULL;
  END IF;

  -- Get our named encryption key
  SELECT id INTO key_id
  FROM pgsodium.valid_key
  WHERE name = 'magnetlab_secrets_key'
  LIMIT 1;

  IF key_id IS NULL THEN
    RAISE EXCEPTION 'Encryption key not found. Please run the key creation migration.';
  END IF;

  -- Encrypt using pgsodium deterministic AEAD
  -- The key_id is used to derive the actual key from the root key
  encrypted_bytes := pgsodium.crypto_aead_det_encrypt(
    convert_to(secret, 'utf8'),  -- message
    ''::bytea,                    -- additional data (empty)
    key_id                        -- key id
  );

  -- Return as base64 encoded string for storage in TEXT column
  RETURN encode(encrypted_bytes, 'base64');
END;
$$;

-- Decrypt function: Takes encrypted base64 text and returns plaintext
CREATE OR REPLACE FUNCTION decrypt_secret(encrypted_secret TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  decrypted_bytes BYTEA;
  key_id BIGINT;
BEGIN
  IF encrypted_secret IS NULL OR encrypted_secret = '' THEN
    RETURN NULL;
  END IF;

  -- Get our named encryption key
  SELECT id INTO key_id
  FROM pgsodium.valid_key
  WHERE name = 'magnetlab_secrets_key'
  LIMIT 1;

  IF key_id IS NULL THEN
    RAISE EXCEPTION 'Encryption key not found';
  END IF;

  -- Decode from base64 and decrypt
  decrypted_bytes := pgsodium.crypto_aead_det_decrypt(
    decode(encrypted_secret, 'base64'),  -- ciphertext
    ''::bytea,                            -- additional data (empty)
    key_id                                -- key id
  );

  RETURN convert_from(decrypted_bytes, 'utf8');
END;
$$;

-- =============================================================================
-- MIGRATE EXISTING DATA
-- =============================================================================

-- Add new encrypted columns (temporarily keep old columns)
ALTER TABLE user_integrations
  ADD COLUMN IF NOT EXISTS api_key_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS webhook_secret_encrypted TEXT;

ALTER TABLE notion_connections
  ADD COLUMN IF NOT EXISTS access_token_encrypted TEXT;

-- Migrate existing plaintext data to encrypted columns
-- Note: This only runs if there's data to migrate
DO $$
BEGIN
  -- Migrate user_integrations.api_key
  UPDATE user_integrations
  SET api_key_encrypted = encrypt_secret(api_key)
  WHERE api_key IS NOT NULL
    AND api_key != ''
    AND api_key_encrypted IS NULL;

  -- Migrate user_integrations.webhook_secret
  UPDATE user_integrations
  SET webhook_secret_encrypted = encrypt_secret(webhook_secret)
  WHERE webhook_secret IS NOT NULL
    AND webhook_secret != ''
    AND webhook_secret_encrypted IS NULL;

  -- Migrate notion_connections.access_token
  UPDATE notion_connections
  SET access_token_encrypted = encrypt_secret(access_token)
  WHERE access_token IS NOT NULL
    AND access_token != ''
    AND access_token_encrypted IS NULL;
END $$;

-- =============================================================================
-- CREATE SECURE VIEWS
-- =============================================================================

-- Create views that automatically decrypt for authorized access
-- These views handle the encryption/decryption transparently

CREATE OR REPLACE VIEW user_integrations_secure AS
SELECT
  id,
  user_id,
  service,
  decrypt_secret(api_key_encrypted) as api_key,
  decrypt_secret(webhook_secret_encrypted) as webhook_secret,
  is_active,
  last_verified_at,
  metadata,
  created_at,
  updated_at
FROM user_integrations;

CREATE OR REPLACE VIEW notion_connections_secure AS
SELECT
  id,
  user_id,
  decrypt_secret(access_token_encrypted) as access_token,
  workspace_id,
  workspace_name,
  workspace_icon,
  bot_id,
  default_parent_page_id,
  default_parent_page_name,
  token_expires_at,
  created_at,
  updated_at
FROM notion_connections;

-- =============================================================================
-- CREATE SECURE UPSERT FUNCTIONS
-- =============================================================================

-- Function to upsert user integration with automatic encryption
CREATE OR REPLACE FUNCTION upsert_user_integration(
  p_user_id UUID,
  p_service TEXT,
  p_api_key TEXT DEFAULT NULL,
  p_webhook_secret TEXT DEFAULT NULL,
  p_is_active BOOLEAN DEFAULT TRUE,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS TABLE(
  id UUID,
  user_id UUID,
  service TEXT,
  is_active BOOLEAN,
  last_verified_at TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  INSERT INTO user_integrations (
    user_id,
    service,
    api_key_encrypted,
    webhook_secret_encrypted,
    is_active,
    metadata,
    updated_at
  ) VALUES (
    p_user_id,
    p_service,
    encrypt_secret(p_api_key),
    encrypt_secret(p_webhook_secret),
    p_is_active,
    p_metadata,
    NOW()
  )
  ON CONFLICT (user_id, service) DO UPDATE SET
    api_key_encrypted = CASE
      WHEN p_api_key IS NOT NULL THEN encrypt_secret(p_api_key)
      ELSE user_integrations.api_key_encrypted
    END,
    webhook_secret_encrypted = CASE
      WHEN p_webhook_secret IS NOT NULL THEN encrypt_secret(p_webhook_secret)
      ELSE user_integrations.webhook_secret_encrypted
    END,
    is_active = p_is_active,
    metadata = p_metadata,
    updated_at = NOW()
  RETURNING
    user_integrations.id,
    user_integrations.user_id,
    user_integrations.service,
    user_integrations.is_active,
    user_integrations.last_verified_at,
    user_integrations.metadata,
    user_integrations.created_at,
    user_integrations.updated_at;
END;
$$;

-- Function to upsert notion connection with automatic encryption
CREATE OR REPLACE FUNCTION upsert_notion_connection(
  p_user_id UUID,
  p_access_token TEXT,
  p_workspace_id TEXT DEFAULT NULL,
  p_workspace_name TEXT DEFAULT NULL,
  p_workspace_icon TEXT DEFAULT NULL,
  p_bot_id TEXT DEFAULT NULL
)
RETURNS TABLE(
  id UUID,
  user_id UUID,
  workspace_id TEXT,
  workspace_name TEXT,
  workspace_icon TEXT,
  bot_id TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  INSERT INTO notion_connections (
    user_id,
    access_token_encrypted,
    workspace_id,
    workspace_name,
    workspace_icon,
    bot_id,
    updated_at
  ) VALUES (
    p_user_id,
    encrypt_secret(p_access_token),
    p_workspace_id,
    p_workspace_name,
    p_workspace_icon,
    p_bot_id,
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    access_token_encrypted = encrypt_secret(p_access_token),
    workspace_id = COALESCE(p_workspace_id, notion_connections.workspace_id),
    workspace_name = COALESCE(p_workspace_name, notion_connections.workspace_name),
    workspace_icon = COALESCE(p_workspace_icon, notion_connections.workspace_icon),
    bot_id = COALESCE(p_bot_id, notion_connections.bot_id),
    updated_at = NOW()
  RETURNING
    notion_connections.id,
    notion_connections.user_id,
    notion_connections.workspace_id,
    notion_connections.workspace_name,
    notion_connections.workspace_icon,
    notion_connections.bot_id,
    notion_connections.created_at,
    notion_connections.updated_at;
END;
$$;

-- Function to get decrypted user integration
CREATE OR REPLACE FUNCTION get_user_integration(
  p_user_id UUID,
  p_service TEXT
)
RETURNS TABLE(
  id UUID,
  user_id UUID,
  service TEXT,
  api_key TEXT,
  webhook_secret TEXT,
  is_active BOOLEAN,
  last_verified_at TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ui.id,
    ui.user_id,
    ui.service,
    decrypt_secret(ui.api_key_encrypted) as api_key,
    decrypt_secret(ui.webhook_secret_encrypted) as webhook_secret,
    ui.is_active,
    ui.last_verified_at,
    ui.metadata,
    ui.created_at,
    ui.updated_at
  FROM user_integrations ui
  WHERE ui.user_id = p_user_id
    AND ui.service = p_service;
END;
$$;

-- Function to get decrypted notion connection
CREATE OR REPLACE FUNCTION get_notion_connection(p_user_id UUID)
RETURNS TABLE(
  id UUID,
  user_id UUID,
  access_token TEXT,
  workspace_id TEXT,
  workspace_name TEXT,
  workspace_icon TEXT,
  bot_id TEXT,
  default_parent_page_id TEXT,
  default_parent_page_name TEXT,
  token_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    nc.id,
    nc.user_id,
    decrypt_secret(nc.access_token_encrypted) as access_token,
    nc.workspace_id,
    nc.workspace_name,
    nc.workspace_icon,
    nc.bot_id,
    nc.default_parent_page_id,
    nc.default_parent_page_name,
    nc.token_expires_at,
    nc.created_at,
    nc.updated_at
  FROM notion_connections nc
  WHERE nc.user_id = p_user_id;
END;
$$;

-- =============================================================================
-- DROP OLD PLAINTEXT COLUMNS (AFTER MIGRATION VERIFIED)
-- =============================================================================

-- Remove the old plaintext columns now that data is migrated
-- Note: Run this AFTER verifying the migration was successful
ALTER TABLE user_integrations
  DROP COLUMN IF EXISTS api_key,
  DROP COLUMN IF EXISTS webhook_secret;

ALTER TABLE notion_connections
  DROP COLUMN IF EXISTS access_token;

-- =============================================================================
-- SECURITY: REVOKE DIRECT TABLE ACCESS
-- =============================================================================

-- Revoke direct access to the encrypted columns from the anon and authenticated roles
-- Users must use the secure functions/views to access decrypted data
REVOKE ALL ON user_integrations FROM anon, authenticated;
REVOKE ALL ON notion_connections FROM anon, authenticated;

-- Grant access to the secure views
GRANT SELECT ON user_integrations_secure TO authenticated;
GRANT SELECT ON notion_connections_secure TO authenticated;

-- Grant execute on the secure functions
GRANT EXECUTE ON FUNCTION upsert_user_integration TO authenticated;
GRANT EXECUTE ON FUNCTION upsert_notion_connection TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_integration TO authenticated;
GRANT EXECUTE ON FUNCTION get_notion_connection TO authenticated;

-- Service role still has full access for admin operations
GRANT ALL ON user_integrations TO service_role;
GRANT ALL ON notion_connections TO service_role;

-- Add comments documenting the encryption
COMMENT ON COLUMN user_integrations.api_key_encrypted IS 'Encrypted API key using pgsodium AEAD deterministic encryption';
COMMENT ON COLUMN user_integrations.webhook_secret_encrypted IS 'Encrypted webhook secret using pgsodium AEAD deterministic encryption';
COMMENT ON COLUMN notion_connections.access_token_encrypted IS 'Encrypted OAuth access token using pgsodium AEAD deterministic encryption';
COMMENT ON FUNCTION encrypt_secret IS 'Encrypts a secret using pgsodium AEAD deterministic encryption';
COMMENT ON FUNCTION decrypt_secret IS 'Decrypts a secret encrypted with encrypt_secret';
