-- Backfill team_id on funnel_leads from their parent funnel_page's team_id
UPDATE funnel_leads fl
SET team_id = fp.team_id
FROM funnel_pages fp
WHERE fl.funnel_page_id = fp.id
  AND fl.team_id IS NULL
  AND fp.team_id IS NOT NULL;
