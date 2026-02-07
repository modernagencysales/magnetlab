'use client';

import { useState } from 'react';
import { Loader2, Sparkles, Check, AlertTriangle, Edit2, ChevronDown, ChevronUp } from 'lucide-react';
import type { BusinessContext, ExtractionResult, ConfidenceLevel } from '@/lib/types/lead-magnet';
import { BUSINESS_TYPE_LABELS } from '@/lib/types/lead-magnet';

interface SmartImportTabProps {
  onExtracted: (context: Partial<BusinessContext>) => void;
}

type ExtractionState = 'idle' | 'extracting' | 'review' | 'error';

const LOADING_MESSAGES = [
  'Analyzing your content...',
  'Extracting business context...',
  'Identifying credibility markers...',
  'Finding pain points...',
  'Almost done...',
];

export function SmartImportTab({ onExtracted }: SmartImportTabProps) {
  const [content, setContent] = useState('');
  const [state, setState] = useState<ExtractionState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExtractionResult | null>(null);
  const [editedContext, setEditedContext] = useState<Partial<BusinessContext>>({});
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const [expandedFields, setExpandedFields] = useState<Set<string>>(new Set());

  const handleExtract = async () => {
    if (!content.trim()) {
      setError('Please paste some content to extract from.');
      return;
    }

    if (content.trim().length < 50) {
      setError('Please provide more content (at least 50 characters) for meaningful extraction.');
      return;
    }

    setState('extracting');
    setError(null);
    setLoadingMessageIndex(0);

    // Cycle through loading messages
    const messageInterval = setInterval(() => {
      setLoadingMessageIndex((prev) =>
        prev < LOADING_MESSAGES.length - 1 ? prev + 1 : prev
      );
    }, 2000);

    try {
      const response = await fetch('/api/brand-kit/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, contentType: 'other' }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to extract context');
      }

      const data: ExtractionResult = await response.json();
      setResult(data);
      setEditedContext(data.extracted);
      setState('review');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      setState('error');
    } finally {
      clearInterval(messageInterval);
    }
  };

  const handleUseContext = () => {
    onExtracted(editedContext);
  };

  const updateField = <K extends keyof BusinessContext>(key: K, value: BusinessContext[K]) => {
    setEditedContext((prev) => ({ ...prev, [key]: value }));
  };

  const toggleExpanded = (field: string) => {
    setExpandedFields((prev) => {
      const next = new Set(prev);
      if (next.has(field)) {
        next.delete(field);
      } else {
        next.add(field);
      }
      return next;
    });
  };

  const resetToIdle = () => {
    setState('idle');
    setResult(null);
    setEditedContext({});
    setError(null);
  };

  if (state === 'extracting') {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="relative">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <Sparkles className="h-5 w-5 text-yellow-500 absolute -top-1 -right-1 animate-pulse" />
        </div>
        <p className="mt-4 text-foreground font-medium">
          {LOADING_MESSAGES[loadingMessageIndex]}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          This may take a moment
        </p>
      </div>
    );
  }

  if (state === 'review' && result) {
    return (
      <div className="space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold">Review Extracted Context</h3>
            <p className="text-sm text-muted-foreground mt-1">
              We found the following from your content. Review and edit anything that needs adjusting.
            </p>
          </div>
          <button
            type="button"
            onClick={resetToIdle}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            title="Clear this extraction and paste new content"
          >
            Start over
          </button>
        </div>

        {/* Suggestions */}
        {result.suggestions.length > 0 && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Suggestions to improve</p>
                <ul className="mt-1 text-sm text-amber-700 dark:text-amber-300 list-disc list-inside">
                  {result.suggestions.map((suggestion, index) => (
                    <li key={index}>{suggestion}</li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                  Tip: You can add or edit items in any field below without starting over.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Extracted Fields */}
        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
          <ExtractedField
            label="Business Description"
            value={editedContext.businessDescription}
            confidence={result.confidence.businessDescription}
            onChange={(value) => updateField('businessDescription', value)}
            type="textarea"
          />

          <ExtractedField
            label="Business Type"
            value={editedContext.businessType}
            confidence={result.confidence.businessType}
            onChange={(value) => updateField('businessType', value as BusinessContext['businessType'])}
            type="select"
            options={Object.entries(BUSINESS_TYPE_LABELS).map(([value, label]) => ({
              value,
              label,
            }))}
          />

          <ExtractedArrayField
            label="Credibility Markers"
            items={editedContext.credibilityMarkers || []}
            confidence={result.confidence.credibilityMarkers}
            onChange={(items) => updateField('credibilityMarkers', items)}
            expanded={expandedFields.has('credibilityMarkers')}
            onToggle={() => toggleExpanded('credibilityMarkers')}
          />

          <ExtractedArrayField
            label="Urgent Pains"
            items={editedContext.urgentPains || []}
            confidence={result.confidence.urgentPains}
            onChange={(items) => updateField('urgentPains', items)}
            expanded={expandedFields.has('urgentPains')}
            onToggle={() => toggleExpanded('urgentPains')}
          />

          <ExtractedArrayField
            label="Results"
            items={editedContext.results || []}
            confidence={result.confidence.results}
            onChange={(items) => updateField('results', items)}
            expanded={expandedFields.has('results')}
            onToggle={() => toggleExpanded('results')}
          />

          <ExtractedField
            label="Success Example"
            value={editedContext.successExample}
            confidence={result.confidence.successExample}
            onChange={(value) => updateField('successExample', value)}
            type="textarea"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4 border-t">
          <button
            type="button"
            onClick={handleUseContext}
            className="flex-1 px-4 py-3 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
          >
            <Check className="h-4 w-4" />
            Use This Context
          </button>
        </div>
      </div>
    );
  }

  // Idle state - paste content
  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-muted-foreground mb-4">
          Paste any content that describes your business - offer docs, LinkedIn profiles, sales pages, or anything else.
          We&apos;ll extract the key details automatically.
        </p>
      </div>

      {/* Textarea */}
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-2">
          Paste Your Content
        </label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={`Paste your content here...

Examples of what works well:
• Your LinkedIn About section
• An offer doc or sales page
• Email sequences
• Course descriptions
• Client testimonials`}
          rows={10}
          className="w-full px-4 py-3 bg-muted/50 dark:bg-muted/20 border border-border rounded-lg text-sm placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-colors resize-none"
        />
        <p className="text-xs text-muted-foreground mt-1">
          {content.length} characters {content.length < 50 && content.length > 0 && '(minimum 50)'}
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Extract Button */}
      <button
        type="button"
        onClick={handleExtract}
        disabled={!content.trim() || content.trim().length < 50}
        className="w-full px-4 py-3 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
      >
        <Sparkles className="h-4 w-4" />
        Extract Business Context
      </button>
    </div>
  );
}

// Confidence badge component
function ConfidenceBadge({ confidence }: { confidence?: ConfidenceLevel }) {
  if (!confidence) return null;

  const styles = {
    high: 'bg-green-500/10 text-green-600',
    medium: 'bg-yellow-500/10 text-yellow-600',
    low: 'bg-muted text-muted-foreground',
  };

  const icons = {
    high: <Check className="h-3 w-3" />,
    medium: <AlertTriangle className="h-3 w-3" />,
    low: <AlertTriangle className="h-3 w-3" />,
  };

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full ${styles[confidence]}`}>
      {icons[confidence]}
      {confidence}
    </span>
  );
}

// Extracted field component (for single values)
interface ExtractedFieldProps {
  label: string;
  value?: string;
  confidence?: ConfidenceLevel;
  onChange: (value: string) => void;
  type: 'text' | 'textarea' | 'select';
  options?: { value: string; label: string }[];
}

function ExtractedField({ label, value, confidence, onChange, type, options }: ExtractedFieldProps) {
  const [isEditing, setIsEditing] = useState(false);

  if (!value && !isEditing) {
    return (
      <div className="bg-muted/50 rounded-lg p-3 border">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">{label}</span>
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="text-xs text-primary hover:text-primary/80 flex items-center gap-1"
          >
            <Edit2 className="h-3 w-3" />
            Add
          </button>
        </div>
        <p className="text-sm text-muted-foreground mt-1 italic">Not found in content</p>
      </div>
    );
  }

  return (
    <div className="bg-background rounded-lg p-3 border">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{label}</span>
          <ConfidenceBadge confidence={confidence} />
        </div>
        {!isEditing && (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="text-xs text-primary hover:text-primary/80 flex items-center gap-1"
          >
            <Edit2 className="h-3 w-3" />
            Edit
          </button>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-2">
          {type === 'select' && options ? (
            <select
              value={value || ''}
              onChange={(e) => onChange(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg bg-background text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              <option value="">Select...</option>
              {options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          ) : type === 'textarea' ? (
            <textarea
              value={value || ''}
              onChange={(e) => onChange(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border rounded-lg bg-background text-sm focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
            />
          ) : (
            <input
              type="text"
              value={value || ''}
              onChange={(e) => onChange(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg bg-background text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          )}
          <button
            type="button"
            onClick={() => setIsEditing(false)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Done
          </button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          {type === 'select' && options
            ? options.find((o) => o.value === value)?.label || value
            : value}
        </p>
      )}
    </div>
  );
}

// Extracted array field component
interface ExtractedArrayFieldProps {
  label: string;
  items: string[];
  confidence?: ConfidenceLevel;
  onChange: (items: string[]) => void;
  expanded: boolean;
  onToggle: () => void;
}

function ExtractedArrayField({ label, items, confidence, onChange, expanded, onToggle }: ExtractedArrayFieldProps) {
  const [newItem, setNewItem] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');

  const addItem = () => {
    if (newItem.trim()) {
      onChange([...items, newItem.trim()]);
      setNewItem('');
    }
  };

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const startEdit = (index: number) => {
    setEditingIndex(index);
    setEditValue(items[index]);
  };

  const saveEdit = () => {
    if (editingIndex !== null && editValue.trim()) {
      const updated = [...items];
      updated[editingIndex] = editValue.trim();
      onChange(updated);
    }
    setEditingIndex(null);
    setEditValue('');
  };

  const displayItems = expanded ? items : items.slice(0, 3);
  const hasMore = items.length > 3;

  return (
    <div className="bg-background rounded-lg p-3 border">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{label}</span>
          <ConfidenceBadge confidence={confidence} />
          {items.length > 0 && (
            <span className="text-xs text-muted-foreground">({items.length})</span>
          )}
        </div>
        {hasMore && (
          <button
            type="button"
            onClick={onToggle}
            className="text-xs text-primary hover:text-primary/80 flex items-center gap-1"
          >
            {expanded ? (
              <>
                <ChevronUp className="h-3 w-3" />
                Show less
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3" />
                Show all
              </>
            )}
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground italic mb-2">Not found in content</p>
      ) : (
        <ul className="space-y-1 mb-2">
          {displayItems.map((item, index) => (
            <li key={index} className="flex items-start gap-2 group">
              {editingIndex === index ? (
                <div className="flex-1 flex gap-2">
                  <input
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                    className="flex-1 px-2 py-1 border rounded text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={saveEdit}
                    className="text-xs text-primary hover:text-primary/80"
                  >
                    Save
                  </button>
                </div>
              ) : (
                <>
                  <span className="text-primary">•</span>
                  <span className="text-sm text-muted-foreground flex-1">{item}</span>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                    <button
                      type="button"
                      onClick={() => startEdit(index)}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="text-xs text-destructive hover:text-destructive/80"
                    >
                      Remove
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Add new item */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addItem()}
          placeholder={`Add ${label.toLowerCase()}...`}
          className="flex-1 px-2 py-1 border rounded text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
        />
        <button
          type="button"
          onClick={addItem}
          disabled={!newItem.trim()}
          className="px-2 py-1 text-xs bg-secondary text-secondary-foreground rounded hover:bg-secondary/80 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Add
        </button>
      </div>
    </div>
  );
}
