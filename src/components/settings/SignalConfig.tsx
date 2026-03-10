'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, Plus, X, Save, CheckCircle, Settings2 } from 'lucide-react';
import { Button, Input, Label, Switch } from '@magnetlab/magnetui';
import * as signalsApi from '@/frontend/api/signals';

interface SignalConfigData {
  target_countries: string[];
  target_job_titles: string[];
  exclude_job_titles: string[];
  default_heyreach_campaign_id: string;
  enrichment_enabled: boolean;
  sentiment_scoring_enabled: boolean;
  auto_push_enabled: boolean;
}

const DEFAULT_CONFIG: SignalConfigData = {
  target_countries: [],
  target_job_titles: [],
  exclude_job_titles: [],
  default_heyreach_campaign_id: '',
  enrichment_enabled: false,
  sentiment_scoring_enabled: false,
  auto_push_enabled: false,
};

function TagInput({
  label,
  placeholder,
  tags,
  onAdd,
  onRemove,
}: {
  label: string;
  placeholder: string;
  tags: string[];
  onAdd: (tag: string) => void;
  onRemove: (index: number) => void;
}) {
  const [inputValue, setInputValue] = useState('');

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const trimmed = inputValue.trim().replace(/,$/g, '');
      if (trimmed && !tags.includes(trimmed)) {
        onAdd(trimmed);
        setInputValue('');
      }
    }
  };

  const handleAddClick = () => {
    const trimmed = inputValue.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onAdd(trimmed);
      setInputValue('');
    }
  };

  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {tags.map((tag, index) => (
          <span
            key={`${tag}-${index}`}
            className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
          >
            {tag}
            <button
              onClick={() => onRemove(index)}
              className="rounded-full hover:bg-primary/20 p-0.5 transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="flex-1"
        />
        <Button variant="outline" size="sm" onClick={handleAddClick} disabled={!inputValue.trim()}>
          <Plus className="h-3 w-3" />
          Add
        </Button>
      </div>
    </div>
  );
}

function ToggleSwitch({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

export function SignalConfig() {
  const [config, setConfig] = useState<SignalConfigData>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const fetchConfig = useCallback(async () => {
    try {
      const data = await signalsApi.getSignalsConfig();
      const c = data.config as SignalConfigData | null | undefined;
      if (c) {
        setConfig({
          target_countries: c.target_countries || [],
          target_job_titles: c.target_job_titles || [],
          exclude_job_titles: c.exclude_job_titles || [],
          default_heyreach_campaign_id: c.default_heyreach_campaign_id || '',
          enrichment_enabled: c.enrichment_enabled ?? false,
          sentiment_scoring_enabled: c.sentiment_scoring_enabled ?? false,
          auto_push_enabled: c.auto_push_enabled ?? false,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await signalsApi.updateSignalsConfig(config as unknown as Record<string, unknown>);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-4 rounded-lg border p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
            <Settings2 className="h-5 w-5 text-blue-500" />
          </div>
          <div>
            <p className="font-medium">ICP Configuration</p>
            <p className="text-xs text-muted-foreground">
              Configure your Ideal Customer Profile for signal scoring
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading...
        </div>
      ) : (
        <div className="space-y-4">
          {/* Tag Inputs */}
          <TagInput
            label="Target Countries"
            placeholder='e.g. "US", "UK", "CA"'
            tags={config.target_countries}
            onAdd={(tag) =>
              setConfig((prev) => ({
                ...prev,
                target_countries: [...prev.target_countries, tag],
              }))
            }
            onRemove={(index) =>
              setConfig((prev) => ({
                ...prev,
                target_countries: prev.target_countries.filter((_, i) => i !== index),
              }))
            }
          />

          <TagInput
            label="Target Job Titles"
            placeholder='e.g. "VP Sales", "Head of Marketing"'
            tags={config.target_job_titles}
            onAdd={(tag) =>
              setConfig((prev) => ({
                ...prev,
                target_job_titles: [...prev.target_job_titles, tag],
              }))
            }
            onRemove={(index) =>
              setConfig((prev) => ({
                ...prev,
                target_job_titles: prev.target_job_titles.filter((_, i) => i !== index),
              }))
            }
          />

          <TagInput
            label="Exclude Job Titles"
            placeholder='e.g. "Intern", "Student", "Junior"'
            tags={config.exclude_job_titles}
            onAdd={(tag) =>
              setConfig((prev) => ({
                ...prev,
                exclude_job_titles: [...prev.exclude_job_titles, tag],
              }))
            }
            onRemove={(index) =>
              setConfig((prev) => ({
                ...prev,
                exclude_job_titles: prev.exclude_job_titles.filter((_, i) => i !== index),
              }))
            }
          />

          {/* Text Input */}
          <div>
            <Label>Default HeyReach Campaign ID</Label>
            <Input
              type="text"
              value={config.default_heyreach_campaign_id}
              onChange={(e) =>
                setConfig((prev) => ({
                  ...prev,
                  default_heyreach_campaign_id: e.target.value,
                }))
              }
              placeholder="Campaign ID for auto-push"
              className="mt-1"
            />
          </div>

          {/* Toggles */}
          <div className="space-y-3 pt-2 border-t">
            <ToggleSwitch
              label="Enrichment Enabled"
              description="Automatically enrich signals with company data"
              checked={config.enrichment_enabled}
              onChange={(checked) =>
                setConfig((prev) => ({ ...prev, enrichment_enabled: checked }))
              }
            />
            <ToggleSwitch
              label="Sentiment Scoring Enabled"
              description="Score signal sentiment using AI"
              checked={config.sentiment_scoring_enabled}
              onChange={(checked) =>
                setConfig((prev) => ({ ...prev, sentiment_scoring_enabled: checked }))
              }
            />
            <ToggleSwitch
              label="Auto Push to HeyReach"
              description="Automatically push matching leads to HeyReach"
              checked={config.auto_push_enabled}
              onChange={(checked) => setConfig((prev) => ({ ...prev, auto_push_enabled: checked }))}
            />
          </div>

          {/* Save Button */}
          <div className="pt-2">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Configuration
            </Button>
          </div>

          {saved && (
            <p className="flex items-center gap-2 text-sm text-green-600">
              <CheckCircle className="h-4 w-4" />
              Configuration saved successfully
            </p>
          )}
        </div>
      )}

      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
    </div>
  );
}
