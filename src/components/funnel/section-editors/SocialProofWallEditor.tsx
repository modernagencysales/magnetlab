/** SocialProofWallEditor. Config editor for social_proof_wall sections. 2-6 testimonials. */
'use client';

import { Plus, Trash2 } from 'lucide-react';
import type { SocialProofWallConfig } from '@/lib/types/funnel';
import { FieldInput } from './FieldInput';

// ─── Constants ─────────────────────────────────────────
const MIN_TESTIMONIALS = 2;
const MAX_TESTIMONIALS = 6;

interface SocialProofWallEditorProps {
  config: SocialProofWallConfig;
  onChange: (c: Record<string, unknown>) => void;
}

export function SocialProofWallEditor({ config, onChange }: SocialProofWallEditorProps) {
  const testimonials = config.testimonials || [];

  const updateTestimonial = (idx: number, field: string, val: string) => {
    const newTestimonials = testimonials.map((t, i) => (i === idx ? { ...t, [field]: val } : t));
    onChange({ ...config, testimonials: newTestimonials });
  };

  const addTestimonial = () => {
    if (testimonials.length >= MAX_TESTIMONIALS) return;
    onChange({
      ...config,
      testimonials: [...testimonials, { quote: 'Amazing experience!', author: 'Name' }],
    });
  };

  const removeTestimonial = (idx: number) => {
    if (testimonials.length <= MIN_TESTIMONIALS) return;
    onChange({ ...config, testimonials: testimonials.filter((_, i) => i !== idx) });
  };

  return (
    <>
      {testimonials.map((testimonial, i) => (
        <div key={i} className="rounded border p-2 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Testimonial {i + 1}</span>
            {testimonials.length > MIN_TESTIMONIALS && (
              <button
                onClick={() => removeTestimonial(i)}
                className="p-0.5 text-muted-foreground hover:text-red-500 transition-colors"
                title="Remove testimonial"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </div>
          <FieldInput
            label="Quote"
            value={testimonial.quote}
            onChange={(v) => updateTestimonial(i, 'quote', v)}
            multiline
            placeholder="What they said..."
          />
          <FieldInput
            label="Author"
            value={testimonial.author}
            onChange={(v) => updateTestimonial(i, 'author', v)}
            placeholder="Jane Doe"
          />
          <FieldInput
            label="Role (optional)"
            value={testimonial.role || ''}
            onChange={(v) => updateTestimonial(i, 'role', v)}
            placeholder="CEO at Company"
          />
        </div>
      ))}
      {testimonials.length < MAX_TESTIMONIALS && (
        <button
          onClick={addTestimonial}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <Plus className="h-3 w-3" />
          Add Testimonial
        </button>
      )}
    </>
  );
}
