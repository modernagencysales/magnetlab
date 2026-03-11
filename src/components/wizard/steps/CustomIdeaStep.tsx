'use client';

import { useState } from 'react';
import { ArrowLeft, Lightbulb } from 'lucide-react';
import {
  Button,
  Input,
  Textarea,
  Label,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@magnetlab/magnetui';
import type { LeadMagnetArchetype, LeadMagnetConcept } from '@/lib/types/lead-magnet';
import { ARCHETYPE_NAMES } from '@/lib/types/lead-magnet';

interface CustomIdeaStepProps {
  onSubmit: (concept: LeadMagnetConcept) => void;
  onBack: () => void;
}

const ARCHETYPE_DEFAULT_FORMATS: Record<LeadMagnetArchetype, string> = {
  'single-breakdown': 'Google Doc / PDF',
  'single-system': 'Google Doc / PDF',
  'focused-toolkit': 'Google Drive Folder',
  'single-calculator': 'Google Sheet',
  'focused-directory': 'Google Sheet',
  'mini-training': 'Loom Video + Doc',
  'one-story': 'Google Doc / PDF',
  prompt: 'Google Doc / PDF',
  assessment: 'Google Sheet / Typeform',
  workflow: 'Make.com / Zapier Template',
};

const ARCHETYPE_DESCRIPTIONS: Record<LeadMagnetArchetype, string> = {
  'single-breakdown': 'Deep dive into one topic, strategy, or process',
  'single-system': 'A complete framework or methodology',
  'focused-toolkit': 'Collection of templates, checklists, or resources',
  'single-calculator': 'Spreadsheet that calculates something useful',
  'focused-directory': 'Curated list of resources, tools, or contacts',
  'mini-training': 'Short video training or tutorial',
  'one-story': 'Case study or success story breakdown',
  prompt: 'AI prompts or script templates',
  assessment: 'Quiz, scorecard, or diagnostic tool',
  workflow: 'Automation template or workflow',
};

export function CustomIdeaStep({ onSubmit, onBack }: CustomIdeaStepProps) {
  const [archetype, setArchetype] = useState<LeadMagnetArchetype>('single-breakdown');
  const [title, setTitle] = useState('');
  const [painSolved, setPainSolved] = useState('');
  const [deliveryFormat, setDeliveryFormat] = useState('');

  const effectiveFormat = deliveryFormat || ARCHETYPE_DEFAULT_FORMATS[archetype];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !painSolved.trim()) {
      return;
    }

    const concept: LeadMagnetConcept = {
      archetype,
      archetypeName: ARCHETYPE_NAMES[archetype],
      title: title.trim(),
      painSolved: painSolved.trim(),
      whyNowHook: '',
      linkedinPost: '',
      contents: '',
      deliveryFormat: effectiveFormat,
      viralCheck: {
        highValue: true,
        urgentPain: true,
        actionableUnder1h: true,
        simple: true,
        authorityBoosting: true,
      },
      creationTimeEstimate: '1-2 hours',
      bundlePotential: [],
    };

    onSubmit(concept);
  };

  const isValid = title.trim() && painSolved.trim();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Enter your lead magnet idea</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Tell us about the lead magnet you want to create. We&apos;ll guide you through
            extracting your expertise.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Archetype Selection */}
        <div>
          <Label className="text-xs">What type of lead magnet is this?</Label>
          <Select
            value={archetype}
            onValueChange={(v) => {
              const newArchetype = v as LeadMagnetArchetype;
              setArchetype(newArchetype);
              if (!deliveryFormat) {
                setDeliveryFormat('');
              }
            }}
          >
            <SelectTrigger className="mt-2 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.entries(ARCHETYPE_NAMES) as [LeadMagnetArchetype, string][]).map(
                ([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                )
              )}
            </SelectContent>
          </Select>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {ARCHETYPE_DESCRIPTIONS[archetype]}
          </p>
        </div>

        {/* Title */}
        <div>
          <Label className="text-xs">What&apos;s the name of your lead magnet?</Label>
          <Input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., The 5-Step Content Calendar System"
            className="mt-2"
            required
          />
        </div>

        {/* Pain Solved */}
        <div>
          <Label className="text-xs">What problem does this solve for your audience?</Label>
          <Textarea
            value={painSolved}
            onChange={(e) => setPainSolved(e.target.value)}
            placeholder="e.g., Coaches who struggle to post consistently and end up ghosting their audience for weeks"
            rows={3}
            className="mt-2 resize-none"
            required
          />
        </div>

        {/* Delivery Format */}
        <div>
          <Label className="text-xs">Delivery format (optional)</Label>
          <Input
            type="text"
            value={deliveryFormat}
            onChange={(e) => setDeliveryFormat(e.target.value)}
            placeholder={`Default: ${ARCHETYPE_DEFAULT_FORMATS[archetype]}`}
            className="mt-2"
          />
          <p className="mt-1.5 text-xs text-muted-foreground">
            Leave blank to use the default format for this type
          </p>
        </div>

        <Button type="submit" disabled={!isValid} className="w-full">
          <Lightbulb className="h-4 w-4" />
          Continue to Extraction Questions
        </Button>
      </form>
    </div>
  );
}
