-- Expand cp_inspiration_sources source_type CHECK constraint to include Reddit source types.
-- reddit_subreddit: tracks a subreddit by name (e.g., "ExperiencedDevs")
-- reddit_search: tracks a keyword search query across all of Reddit

ALTER TABLE cp_inspiration_sources
  DROP CONSTRAINT IF EXISTS cp_inspiration_sources_source_type_check;

ALTER TABLE cp_inspiration_sources
  ADD CONSTRAINT cp_inspiration_sources_source_type_check
  CHECK (source_type IN ('creator', 'search_term', 'hashtag', 'competitor', 'reddit_subreddit', 'reddit_search'));
