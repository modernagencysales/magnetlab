'use client';

import { useState, useEffect } from 'react';
import { X, Loader2, Save } from 'lucide-react';

interface BusinessContextModalProps {
  onClose: () => void;
}

export function BusinessContextModal({ onClose }: BusinessContextModalProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    company_name: '',
    industry: '',
    company_description: '',
    icp_title: '',
    icp_industry: '',
    icp_pain_points: '',
    target_audience: '',
  });

  useEffect(() => {
    fetch('/api/content-pipeline/business-context')
      .then((r) => r.json())
      .then((data) => {
        if (data.context) {
          setForm({
            company_name: data.context.company_name || '',
            industry: data.context.industry || '',
            company_description: data.context.company_description || '',
            icp_title: data.context.icp_title || '',
            icp_industry: data.context.icp_industry || '',
            icp_pain_points: (data.context.icp_pain_points || []).join('\n'),
            target_audience: data.context.target_audience || '',
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch('/api/content-pipeline/business-context', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          icp_pain_points: form.icp_pain_points
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean),
        }),
      });
      onClose();
    } catch {
      // Silent failure
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="rounded-xl bg-background p-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-background p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Business Context</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-secondary">
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mb-4 text-sm text-muted-foreground">
          Help the AI understand your business for better content personalization.
        </p>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium">Company Name</label>
            <input
              type="text"
              value={form.company_name}
              onChange={(e) => updateField('company_name', e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Industry</label>
            <input
              type="text"
              value={form.industry}
              onChange={(e) => updateField('industry', e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Company Description</label>
            <textarea
              value={form.company_description}
              onChange={(e) => updateField('company_description', e.target.value)}
              rows={2}
              className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium">ICP Job Title</label>
              <input
                type="text"
                value={form.icp_title}
                onChange={(e) => updateField('icp_title', e.target.value)}
                placeholder="e.g., Marketing Director"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">ICP Industry</label>
              <input
                type="text"
                value={form.icp_industry}
                onChange={(e) => updateField('icp_industry', e.target.value)}
                placeholder="e.g., SaaS, E-commerce"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">ICP Pain Points (one per line)</label>
            <textarea
              value={form.icp_pain_points}
              onChange={(e) => updateField('icp_pain_points', e.target.value)}
              rows={3}
              placeholder="Can't generate enough leads&#10;Spending too much on ads&#10;Low conversion rates"
              className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Target Audience</label>
            <input
              type="text"
              value={form.target_audience}
              onChange={(e) => updateField('target_audience', e.target.value)}
              placeholder="e.g., B2B agency owners with 5-50 employees"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        <div className="mt-6 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
