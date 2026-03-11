-- Add unique constraint for diagnostic rules upsert
ALTER TABLE diagnostic_rules
  ADD CONSTRAINT uq_diagnostic_rules_module_metric UNIQUE (module_id, metric_key);
