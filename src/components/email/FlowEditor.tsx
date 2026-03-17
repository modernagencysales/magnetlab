'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  CheckCircle,
  Sparkles,
  Plus,
  PlayCircle,
  PauseCircle,
} from 'lucide-react';
import { Button, Badge } from '@magnetlab/magnetui';
import { FlowStepCard } from './FlowStepCard';
import type { EmailFlowWithSteps, EmailFlowStep } from '@/lib/types/email-system';
import * as flowsApi from '@/frontend/api/email/flows';
import * as leadMagnetApi from '@/frontend/api/lead-magnet';

interface FlowEditorProps {
  flowId: string;
}

interface LeadMagnetOption {
  id: string;
  title: string;
}

const STATUS_VARIANTS: Record<string, 'gray' | 'green' | 'orange'> = {
  draft: 'gray',
  active: 'green',
  paused: 'orange',
};

const GENERATING_MESSAGES = [
  'Analyzing your flow context...',
  'Crafting compelling subject lines...',
  'Writing personalized email copy...',
  'Adding engagement hooks and CTAs...',
  'Finalizing your email sequence...',
];

export function FlowEditor({ flowId }: FlowEditorProps) {
  const router = useRouter();

  // Flow state
  const [flow, setFlow] = useState<EmailFlowWithSteps | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Inline editing
  const [editingName, setEditingName] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [descriptionValue, setDescriptionValue] = useState('');

  // Trigger type
  const [leadMagnets, setLeadMagnets] = useState<LeadMagnetOption[]>([]);
  const [loadingLeadMagnets, setLoadingLeadMagnets] = useState(false);

  // AI generation
  const [generating, setGenerating] = useState(false);
  const [generatingMessage, setGeneratingMessage] = useState('');

  // Step management
  const [expandedStep, setExpandedStep] = useState<string | null>(null);
  const [addingStep, setAddingStep] = useState(false);

  // Status changes
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Fetch flow data
  const fetchFlow = useCallback(async () => {
    try {
      const data = await flowsApi.getFlow(flowId);
      const f = data.flow as EmailFlowWithSteps;
      setFlow(f);
      setNameValue(f.name);
      setDescriptionValue(f.description || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load flow');
    } finally {
      setLoading(false);
    }
  }, [flowId]);

  useEffect(() => {
    fetchFlow();
  }, [fetchFlow]);

  // Fetch lead magnets when trigger type is lead_magnet
  useEffect(() => {
    if (flow?.trigger_type === 'lead_magnet' && leadMagnets.length === 0) {
      setLoadingLeadMagnets(true);
      leadMagnetApi
        .listLeadMagnets()
        .then((data) => {
          const list = (data.leadMagnets || []) as Array<{ id: string; title: string }>;
          const magnets = list.map((lm) => ({ id: lm.id, title: lm.title }));
          setLeadMagnets(magnets);
        })
        .catch(() => {
          // Non-fatal
        })
        .finally(() => setLoadingLeadMagnets(false));
    }
  }, [flow?.trigger_type, leadMagnets.length]);

  // Update flow field
  const updateFlow = async (updates: Record<string, unknown>) => {
    setError(null);
    try {
      const data = await flowsApi.updateFlow(flowId, updates);
      setFlow((prev) =>
        prev ? { ...prev, ...(data.flow as EmailFlowWithSteps), steps: prev.steps } : prev
      );
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update flow');
      return false;
    }
  };

  // Save name on blur
  const handleNameBlur = async () => {
    setEditingName(false);
    if (nameValue.trim() && nameValue !== flow?.name) {
      await updateFlow({ name: nameValue.trim() });
    } else {
      setNameValue(flow?.name || '');
    }
  };

  // Save description on blur
  const handleDescriptionBlur = async () => {
    setEditingDescription(false);
    const newDesc = descriptionValue.trim();
    if (newDesc !== (flow?.description || '')) {
      await updateFlow({ description: newDesc || null });
    }
  };

  // Trigger type change
  const handleTriggerTypeChange = async (triggerType: string) => {
    if (triggerType === 'manual') {
      await updateFlow({ trigger_type: 'manual', trigger_lead_magnet_id: null });
    } else {
      // Set trigger type but require lead magnet selection
      if (flow) {
        setFlow({ ...flow, trigger_type: triggerType as 'lead_magnet' | 'manual' });
      }
    }
  };

  // Lead magnet selection
  const handleLeadMagnetChange = async (leadMagnetId: string) => {
    if (leadMagnetId) {
      await updateFlow({ trigger_type: 'lead_magnet', trigger_lead_magnet_id: leadMagnetId });
    }
  };

  // Status changes
  const handleActivate = async () => {
    setUpdatingStatus(true);
    setError(null);
    const ok = await updateFlow({ status: 'active' });
    if (ok) {
      setSuccess('Flow activated! Subscribers will now receive these emails.');
      setTimeout(() => setSuccess(null), 4000);
    }
    setUpdatingStatus(false);
  };

  const handlePause = async () => {
    setUpdatingStatus(true);
    setError(null);
    const ok = await updateFlow({ status: 'paused' });
    if (ok) {
      setSuccess('Flow paused. No new emails will be sent.');
      setTimeout(() => setSuccess(null), 4000);
    }
    setUpdatingStatus(false);
  };

  const handleBackToDraft = async () => {
    setUpdatingStatus(true);
    setError(null);
    const ok = await updateFlow({ status: 'draft' });
    if (ok) {
      setSuccess('Flow returned to draft.');
      setTimeout(() => setSuccess(null), 4000);
    }
    setUpdatingStatus(false);
  };

  // AI generation
  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    setSuccess(null);
    setGeneratingMessage(GENERATING_MESSAGES[0]);

    let msgIndex = 0;
    const msgInterval = setInterval(() => {
      msgIndex = Math.min(msgIndex + 1, GENERATING_MESSAGES.length - 1);
      setGeneratingMessage(GENERATING_MESSAGES[msgIndex]);
    }, 4000);

    try {
      const data = await flowsApi.generateFlowSteps(flowId, { stepCount: 5 });
      const steps = (data.steps || []) as EmailFlowStep[];
      setFlow((prev) => (prev ? { ...prev, steps } : prev));
      setSuccess(`Generated ${data.stepCount} email steps!`);
      setTimeout(() => setSuccess(null), 4000);

      if (steps.length > 0) {
        setExpandedStep(steps[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate steps');
    } finally {
      clearInterval(msgInterval);
      setGenerating(false);
      setGeneratingMessage('');
    }
  };

  // Add step
  const handleAddStep = async () => {
    if (!flow) return;
    setAddingStep(true);
    setError(null);

    const nextStepNumber = flow.steps.length;

    try {
      const data = await flowsApi.addFlowStep(flowId, {
        step_number: nextStepNumber,
        subject: '',
        body: '',
        delay_days: nextStepNumber === 0 ? 0 : 1,
      });
      const newStep = data.step as EmailFlowStep;
      setFlow((prev) => (prev ? { ...prev, steps: [...prev.steps, newStep] } : prev));
      setExpandedStep(newStep.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add step');
    } finally {
      setAddingStep(false);
    }
  };

  // Save step
  const handleSaveStep = (updatedStep: EmailFlowStep) => {
    setFlow((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        steps: prev.steps.map((s) => (s.id === updatedStep.id ? updatedStep : s)),
      };
    });
  };

  // Delete step
  const handleDeleteStep = (stepId: string) => {
    setFlow((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        steps: prev.steps.filter((s) => s.id !== stepId),
      };
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!flow) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => router.push('/email/flows')}>
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          Back to Flows
        </Button>
        <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-destructive">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p className="text-sm">{error || 'Flow not found.'}</p>
        </div>
      </div>
    );
  }

  const isEditable = flow.status === 'draft' || flow.status === 'paused';

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Back button */}
      <Button
        variant="ghost"
        size="sm"
        className="gap-1 text-muted-foreground hover:text-foreground"
        onClick={() => router.push('/email/flows')}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Flows
      </Button>

      {/* Header: name, description, status */}
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {editingName ? (
              <input
                type="text"
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                onBlur={handleNameBlur}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleNameBlur();
                  if (e.key === 'Escape') {
                    setNameValue(flow.name);
                    setEditingName(false);
                  }
                }}
                autoFocus
                className="w-full text-2xl font-bold bg-transparent border-b-2 border-primary outline-none pb-1"
              />
            ) : (
              <h1
                onClick={() => {
                  if (isEditable) {
                    setEditingName(true);
                  }
                }}
                className={`text-2xl font-bold ${isEditable ? 'cursor-pointer hover:text-primary/80' : ''}`}
                title={isEditable ? 'Click to edit' : undefined}
              >
                {flow.name}
              </h1>
            )}

            {editingDescription ? (
              <input
                type="text"
                value={descriptionValue}
                onChange={(e) => setDescriptionValue(e.target.value)}
                onBlur={handleDescriptionBlur}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleDescriptionBlur();
                  if (e.key === 'Escape') {
                    setDescriptionValue(flow.description || '');
                    setEditingDescription(false);
                  }
                }}
                autoFocus
                placeholder="Add a description..."
                className="w-full text-sm text-muted-foreground bg-transparent border-b border-primary/50 outline-none pb-0.5 mt-1"
              />
            ) : (
              <p
                onClick={() => {
                  if (isEditable) {
                    setEditingDescription(true);
                  }
                }}
                className={`text-sm text-muted-foreground mt-1 ${isEditable ? 'cursor-pointer hover:text-foreground/70' : ''}`}
                title={isEditable ? 'Click to edit' : undefined}
              >
                {flow.description ||
                  (isEditable ? 'Click to add a description...' : 'No description')}
              </p>
            )}
          </div>

          <Badge variant={STATUS_VARIANTS[flow.status] || 'gray'}>
            {flow.status.charAt(0).toUpperCase() + flow.status.slice(1)}
          </Badge>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-destructive">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />
          <p className="text-sm text-green-800 dark:text-green-200">{success}</p>
        </div>
      )}

      {/* Active flow notice */}
      {flow.status === 'active' && (
        <div className="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 shrink-0" />
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            Pause the flow to make changes.
          </p>
        </div>
      )}

      {/* Trigger type configuration */}
      <div className="rounded-lg border bg-card p-4 space-y-3">
        <h3 className="text-sm font-medium">Trigger</h3>
        <div className="flex flex-col sm:flex-row gap-3">
          <select
            value={flow.trigger_type}
            onChange={(e) => handleTriggerTypeChange(e.target.value)}
            disabled={!isEditable}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="manual">Manual</option>
            <option value="lead_magnet">Lead Magnet</option>
          </select>

          {flow.trigger_type === 'lead_magnet' && (
            <select
              value={flow.trigger_lead_magnet_id || ''}
              onChange={(e) => handleLeadMagnetChange(e.target.value)}
              disabled={!isEditable || loadingLeadMagnets}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 flex-1"
            >
              <option value="">
                {loadingLeadMagnets ? 'Loading lead magnets...' : 'Select a lead magnet'}
              </option>
              {leadMagnets.map((lm) => (
                <option key={lm.id} value={lm.id}>
                  {lm.title}
                </option>
              ))}
            </select>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {flow.trigger_type === 'manual'
            ? 'Subscribers are added to this flow manually or via API.'
            : 'Subscribers are added automatically when they opt in to the selected lead magnet.'}
        </p>
      </div>

      {/* Status controls */}
      <div className="flex items-center gap-3 flex-wrap">
        {flow.status === 'draft' && (
          <Button
            onClick={handleActivate}
            disabled={updatingStatus || flow.steps.length === 0}
            className="bg-green-600 hover:bg-green-700 text-white"
            title={flow.steps.length === 0 ? 'Add at least one step before activating' : undefined}
          >
            {updatingStatus ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <PlayCircle className="h-4 w-4" />
            )}
            Activate
          </Button>
        )}

        {flow.status === 'active' && (
          <Button
            variant="outline"
            onClick={handlePause}
            disabled={updatingStatus}
            className="border-yellow-300 text-yellow-700 hover:bg-yellow-50 dark:border-yellow-700 dark:text-yellow-300 dark:hover:bg-yellow-900/30"
          >
            {updatingStatus ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <PauseCircle className="h-4 w-4" />
            )}
            Pause
          </Button>
        )}

        {flow.status === 'paused' && (
          <>
            <Button
              onClick={handleActivate}
              disabled={updatingStatus || flow.steps.length === 0}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {updatingStatus ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <PlayCircle className="h-4 w-4" />
              )}
              Activate
            </Button>
            <Button
              variant="ghost"
              onClick={handleBackToDraft}
              disabled={updatingStatus}
              className="underline underline-offset-2"
            >
              Back to Draft
            </Button>
          </>
        )}

        {isEditable && (
          <Button
            variant="outline"
            onClick={handleGenerate}
            disabled={generating}
            className="ml-auto"
          >
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {flow.steps.length > 0 ? 'Regenerate with AI' : 'Generate with AI'}
          </Button>
        )}
      </div>

      {/* Generating overlay */}
      {generating && (
        <div className="text-center py-12 border-2 border-primary/30 rounded-lg bg-primary/5">
          <Loader2 className="h-10 w-10 mx-auto text-primary animate-spin mb-4" />
          <h4 className="font-medium mb-2">Generating Your Email Sequence</h4>
          <p className="text-sm text-muted-foreground animate-pulse">{generatingMessage}</p>
        </div>
      )}

      {/* Steps list */}
      {!generating && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">Steps ({flow.steps.length})</h3>

          {flow.steps.length === 0 ? (
            <div className="text-center py-8 border-2 border-dashed rounded-lg">
              <p className="text-sm text-muted-foreground mb-3">
                No steps yet. Add a step manually or generate with AI.
              </p>
              {isEditable && (
                <Button variant="outline" onClick={handleAddStep} disabled={addingStep}>
                  {addingStep ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  Add Step
                </Button>
              )}
            </div>
          ) : (
            <>
              {flow.steps.map((step, index) => (
                <FlowStepCard
                  key={step.id}
                  step={step}
                  stepIndex={index}
                  flowId={flowId}
                  flowStatus={flow.status}
                  isExpanded={expandedStep === step.id}
                  onToggle={() => setExpandedStep(expandedStep === step.id ? null : step.id)}
                  onSave={handleSaveStep}
                  onDelete={handleDeleteStep}
                />
              ))}

              {isEditable && (
                <Button
                  variant="outline"
                  onClick={handleAddStep}
                  disabled={addingStep}
                  className="w-full border-2 border-dashed text-muted-foreground hover:text-foreground hover:border-primary/50"
                >
                  {addingStep ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  Add Step
                </Button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
