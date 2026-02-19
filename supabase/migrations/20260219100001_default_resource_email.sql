-- Default resource delivery email toggle
-- When true (default), system sends a resource delivery email on opt-in
-- When false, resource is shown directly on the thank-you page
ALTER TABLE funnel_pages ADD COLUMN IF NOT EXISTS send_resource_email BOOLEAN NOT NULL DEFAULT true;
