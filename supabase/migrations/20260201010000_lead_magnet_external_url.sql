-- Add external_url for imported lead magnets that are just a link
ALTER TABLE lead_magnets
  ADD COLUMN external_url TEXT;
