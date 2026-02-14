-- Remove Notion integration (never actively used, replaced by self-hosted content pages)

-- Drop decryption view
DROP VIEW IF EXISTS public.notion_connections_secure;

-- Drop helper functions
DROP FUNCTION IF EXISTS public.upsert_notion_connection;
DROP FUNCTION IF EXISTS public.get_notion_connection;

-- Drop the table
DROP TABLE IF EXISTS public.notion_connections CASCADE;

-- Remove Notion columns from lead_magnets
ALTER TABLE public.lead_magnets
  DROP COLUMN IF EXISTS notion_page_id,
  DROP COLUMN IF EXISTS notion_page_url;
