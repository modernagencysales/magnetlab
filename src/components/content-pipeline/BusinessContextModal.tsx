'use client';

import { useState, useEffect } from 'react';
import { X, Loader2, Save } from 'lucide-react';
import { Button, Input, Textarea, Label } from '@magnetlab/magnetui';
import * as businessContextApi from '@/frontend/api/content-pipeline/business-context';

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
    businessContextApi
      .getBusinessContext()
      .then((data) => {
        if (data.context && typeof data.context === 'object' && 'company_name' in data.context) {
          const ctx = data.context as Record<string, unknown>;
          setForm({
            company_name: (ctx.company_name as string) || '',
            industry: (ctx.industry as string) || '',
            company_description: (ctx.company_description as string) || '',
            icp_title: (ctx.icp_title as string) || '',
            icp_industry: (ctx.icp_industry as string) || '',
            icp_pain_points: ((ctx.icp_pain_points as string[]) || []).join('\n'),
            target_audience: (ctx.target_audience as string) || '',
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await businessContextApi.upsertBusinessContext({
        ...form,
        icp_pain_points: form.icp_pain_points
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Business Context"
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-background p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Business Context</h2>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <p className="mb-4 text-sm text-muted-foreground">
          Help the AI understand your business for better content personalization.
        </p>

        <div className="space-y-3">
          <div>
            <Label className="mb-1">Company Name</Label>
            <Input
              type="text"
              value={form.company_name}
              onChange={(e) => updateField('company_name', e.target.value)}
            />
          </div>
          <div>
            <Label className="mb-1">Industry</Label>
            <Input
              type="text"
              value={form.industry}
              onChange={(e) => updateField('industry', e.target.value)}
            />
          </div>
          <div>
            <Label className="mb-1">Company Description</Label>
            <Textarea
              value={form.company_description}
              onChange={(e) => updateField('company_description', e.target.value)}
              rows={2}
              className="resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1">ICP Job Title</Label>
              <Input
                type="text"
                value={form.icp_title}
                onChange={(e) => updateField('icp_title', e.target.value)}
                placeholder="e.g., Marketing Director"
              />
            </div>
            <div>
              <Label className="mb-1">ICP Industry</Label>
              <Input
                type="text"
                value={form.icp_industry}
                onChange={(e) => updateField('icp_industry', e.target.value)}
                placeholder="e.g., SaaS, E-commerce"
              />
            </div>
          </div>
          <div>
            <Label className="mb-1">ICP Pain Points (one per line)</Label>
            <Textarea
              value={form.icp_pain_points}
              onChange={(e) => updateField('icp_pain_points', e.target.value)}
              rows={3}
              placeholder="Can't generate enough leads&#10;Spending too much on ads&#10;Low conversion rates"
              className="resize-none"
            />
          </div>
          <div>
            <Label className="mb-1">Target Audience</Label>
            <Input
              type="text"
              value={form.target_audience}
              onChange={(e) => updateField('target_audience', e.target.value)}
              placeholder="e.g., B2B agency owners with 5-50 employees"
            />
          </div>
        </div>

        <div className="mt-6 flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button className="flex-1" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
