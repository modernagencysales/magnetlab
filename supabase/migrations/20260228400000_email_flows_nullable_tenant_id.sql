-- Allow email flows/contacts without tenant_id (magnetlab uses team_id + user_id instead)
ALTER TABLE email_flows ALTER COLUMN tenant_id DROP NOT NULL;
ALTER TABLE email_flow_contacts ALTER COLUMN tenant_id DROP NOT NULL;
