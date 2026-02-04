# Background Jobs Architecture Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace synchronous AI API calls with background Trigger.dev tasks so users aren't blocked by timeouts.

**Architecture:** Create a `background_jobs` table to track job status. Each AI-heavy operation (ideation, extraction, polish, posts) gets its own Trigger.dev task. API endpoints trigger tasks and return job IDs immediately. Frontend polls for completion.

**Tech Stack:** Trigger.dev v3, Supabase (PostgreSQL), Next.js API routes, React polling hooks

---

## Overview

### Current Problem
- `/api/lead-magnet/ideate` calls Anthropic API synchronously
- Vercel functions timeout at 10-60s depending on plan
- Large prompts (10 lead magnet concepts) routinely exceed this
- Users see "Failed to generate ideas" with no recourse

### Solution Architecture

```
┌──────────────┐     ┌─────────────────┐     ┌────────────────┐
│   Frontend   │────▶│   API Route     │────▶│  Trigger.dev   │
│  (polling)   │◀────│  (returns job)  │     │    Task        │
└──────────────┘     └─────────────────┘     └───────┬────────┘
       │                                             │
       │              ┌─────────────────┐            │
       └─────────────▶│ background_jobs │◀───────────┘
                      │     table       │
                      └─────────────────┘
```

### Tasks to Create

| Task ID | Purpose | Timeout Risk |
|---------|---------|--------------|
| `ideate-lead-magnet` | Generate 10 concepts | HIGH (~45s) |
| `extract-content` | Process answers → structured content | MEDIUM (~20s) |
| `polish-content` | Transform to polished blocks (Opus) | HIGH (~60s) |
| `generate-posts` | Create 3 LinkedIn post variations | LOW (~15s) |
| `generate-emails` | Create email sequence | MEDIUM (~20s) |

---

## Task 1: Database Migration - background_jobs Table

**Files:**
- Create: `supabase/migrations/20260204_background_jobs.sql`

**Step 1: Write the migration**

```sql
-- Background jobs for async AI processing
CREATE TABLE background_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  input JSONB NOT NULL DEFAULT '{}',
  result JSONB,
  error TEXT,
  trigger_task_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- Indexes for common queries
CREATE INDEX idx_background_jobs_user_id ON background_jobs(user_id);
CREATE INDEX idx_background_jobs_user_status ON background_jobs(user_id, status);
CREATE INDEX idx_background_jobs_trigger_task ON background_jobs(trigger_task_id);

-- RLS policies
ALTER TABLE background_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own jobs"
  ON background_jobs FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own jobs"
  ON background_jobs FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Service role can update (for Trigger.dev callbacks)
CREATE POLICY "Service role can update jobs"
  ON background_jobs FOR UPDATE
  USING (true);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_background_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER background_jobs_updated_at
  BEFORE UPDATE ON background_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_background_jobs_updated_at();

-- Comment for documentation
COMMENT ON TABLE background_jobs IS 'Tracks async AI processing jobs (ideation, extraction, polish, etc.)';
COMMENT ON COLUMN background_jobs.job_type IS 'One of: ideation, extraction, polish, posts, emails';
COMMENT ON COLUMN background_jobs.status IS 'One of: pending, processing, completed, failed';
```

**Step 2: Apply the migration**

Run: `npm run db:push`
Expected: Migration applied successfully

**Step 3: Regenerate TypeScript types**

Run: `npm run db:generate`
Expected: Types updated in `src/lib/types/database.ts` (or similar)

**Step 4: Commit**

```bash
git add supabase/migrations/20260204_background_jobs.sql
git commit -m "feat: add background_jobs table for async AI processing"
```

---

## Task 2: TypeScript Types for Background Jobs

**Files:**
- Create: `src/lib/types/background-jobs.ts`

**Step 1: Create the types file**

```typescript
// Background Jobs Types

export type JobType = 'ideation' | 'extraction' | 'polish' | 'posts' | 'emails';

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface BackgroundJob<TInput = unknown, TResult = unknown> {
  id: string;
  userId: string;
  jobType: JobType;
  status: JobStatus;
  input: TInput;
  result: TResult | null;
  error: string | null;
  triggerTaskId: string | null;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

// Specific job input/result types
export interface IdeationJobInput {
  businessContext: {
    businessDescription: string;
    businessType: string;
    credibilityMarkers: string[];
    urgentPains: string[];
    templates: string[];
    processes: string[];
    tools: string[];
    frequentQuestions: string[];
    results: string[];
    successExample?: string;
  };
  sources?: {
    callTranscriptInsights?: unknown;
    competitorAnalysis?: unknown;
  };
}

export interface ExtractionJobInput {
  archetype: string;
  concept: unknown;
  answers: Record<string, string>;
}

export interface PolishJobInput {
  leadMagnetId: string;
}

export interface PostsJobInput {
  leadMagnetTitle: string;
  format: string;
  contents: string;
  problemSolved: string;
  credibility: string;
  audience: string;
  audienceStyle: string;
  proof: string;
  ctaWord: string;
  urgencyAngle?: string;
}

// API response types
export interface CreateJobResponse {
  jobId: string;
  status: JobStatus;
}

export interface JobStatusResponse<TResult = unknown> {
  id: string;
  status: JobStatus;
  result: TResult | null;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
}
```

**Step 2: Commit**

```bash
git add src/lib/types/background-jobs.ts
git commit -m "feat: add TypeScript types for background jobs"
```

---

## Task 3: Job Status API Endpoint

**Files:**
- Create: `src/app/api/jobs/[id]/route.ts`

**Step 1: Create the job status endpoint**

```typescript
// API Route: Get Background Job Status
// GET /api/jobs/[id]

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import type { JobStatusResponse } from '@/lib/types/background-jobs';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const { id } = await params;
    const supabase = createSupabaseAdminClient();

    const { data: job, error } = await supabase
      .from('background_jobs')
      .select('id, status, result, error, created_at, completed_at')
      .eq('id', id)
      .eq('user_id', session.user.id)
      .single();

    if (error || !job) {
      return ApiErrors.notFound('Job');
    }

    const response: JobStatusResponse = {
      id: job.id,
      status: job.status,
      result: job.result,
      error: job.error,
      createdAt: job.created_at,
      completedAt: job.completed_at,
    };

    return NextResponse.json(response);
  } catch (error) {
    logApiError('jobs/status', error);
    return ApiErrors.internalError('Failed to get job status');
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/jobs/[id]/route.ts
git commit -m "feat: add job status API endpoint"
```

---

## Task 4: Trigger.dev Ideation Task

**Files:**
- Create: `src/trigger/ideate-lead-magnet.ts`

**Step 1: Create the ideation task**

```typescript
import { task } from "@trigger.dev/sdk/v3";
import { createSupabaseAdminClient } from "@/lib/utils/supabase-server";
import { generateLeadMagnetIdeas } from "@/lib/ai/lead-magnet-generator";
import { logApiError } from "@/lib/api/errors";
import type { BusinessContext } from "@/lib/types/lead-magnet";
import type { IdeationJobInput } from "@/lib/types/background-jobs";

export interface IdeateLeadMagnetPayload {
  jobId: string;
  userId: string;
  input: IdeationJobInput;
}

export const ideateLeadMagnet = task({
  id: "ideate-lead-magnet",
  retry: {
    maxAttempts: 2,
  },
  run: async (payload: IdeateLeadMagnetPayload) => {
    const { jobId, userId, input } = payload;
    const supabase = createSupabaseAdminClient();

    // Mark job as processing
    await supabase
      .from("background_jobs")
      .update({
        status: "processing",
        started_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    try {
      // Build full business context
      const businessContext: BusinessContext = {
        businessDescription: input.businessContext.businessDescription,
        businessType: input.businessContext.businessType as BusinessContext["businessType"],
        credibilityMarkers: input.businessContext.credibilityMarkers || [],
        urgentPains: input.businessContext.urgentPains || [],
        templates: input.businessContext.templates || [],
        processes: input.businessContext.processes || [],
        tools: input.businessContext.tools || [],
        frequentQuestions: input.businessContext.frequentQuestions || [],
        results: input.businessContext.results || [],
        successExample: input.businessContext.successExample,
      };

      // Generate ideas (this is the slow part)
      const result = await generateLeadMagnetIdeas(businessContext, input.sources);

      // Save result to brand_kit for future use
      try {
        await supabase
          .from("brand_kits")
          .update({
            saved_ideation_result: result,
            ideation_generated_at: new Date().toISOString(),
          })
          .eq("user_id", userId);
      } catch (saveError) {
        logApiError("ideate-lead-magnet/save-brand-kit", saveError, { userId, jobId });
        // Non-critical, continue
      }

      // Mark job as completed
      await supabase
        .from("background_jobs")
        .update({
          status: "completed",
          result,
          completed_at: new Date().toISOString(),
        })
        .eq("id", jobId);

      return { success: true, jobId, conceptCount: result.concepts.length };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logApiError("ideate-lead-magnet", error, { userId, jobId });

      // Mark job as failed
      await supabase
        .from("background_jobs")
        .update({
          status: "failed",
          error: errorMessage,
          completed_at: new Date().toISOString(),
        })
        .eq("id", jobId);

      throw error;
    }
  },
});
```

**Step 2: Commit**

```bash
git add src/trigger/ideate-lead-magnet.ts
git commit -m "feat: add Trigger.dev task for lead magnet ideation"
```

---

## Task 5: Update Ideation API to Use Background Job

**Files:**
- Modify: `src/app/api/lead-magnet/ideate/route.ts`

**Step 1: Rewrite the ideation endpoint**

```typescript
// API Route: Generate Lead Magnet Ideas (Background Job)
// POST /api/lead-magnet/ideate - Creates job, returns jobId

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import { ideateLeadMagnet } from '@/trigger/ideate-lead-magnet';
import type { BusinessContext, CallTranscriptInsights, CompetitorAnalysis } from '@/lib/types/lead-magnet';
import type { IdeationJobInput, CreateJobResponse } from '@/lib/types/background-jobs';

interface IdeateRequestBody extends BusinessContext {
  sources?: {
    callTranscriptInsights?: CallTranscriptInsights;
    competitorAnalysis?: CompetitorAnalysis;
  };
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const body = await request.json() as IdeateRequestBody;
    const { sources, ...context } = body;

    // Validate required fields
    if (!context.businessDescription || !context.businessType) {
      return ApiErrors.validationError('Missing required fields: businessDescription and businessType');
    }

    // Check usage limits
    const supabase = createSupabaseAdminClient();
    try {
      const { data: canCreate, error: rpcError } = await supabase.rpc('check_usage_limit', {
        p_user_id: session.user.id,
        p_limit_type: 'lead_magnets',
      });

      if (rpcError) {
        logApiError('lead-magnet/ideate/usage-check', rpcError, { userId: session.user.id });
      } else if (canCreate === false) {
        return ApiErrors.usageLimitExceeded('Monthly lead magnet limit reached. Upgrade your plan for more.');
      }
    } catch (err) {
      logApiError('lead-magnet/ideate/usage-check', err, { userId: session.user.id, note: 'RPC unavailable' });
    }

    // Save business context to brand_kit
    try {
      await supabase
        .from('brand_kits')
        .upsert({
          user_id: session.user.id,
          business_description: context.businessDescription,
          business_type: context.businessType,
          credibility_markers: context.credibilityMarkers,
          urgent_pains: context.urgentPains,
          templates: context.templates,
          processes: context.processes,
          tools: context.tools,
          frequent_questions: context.frequentQuestions,
          results: context.results,
          success_example: context.successExample,
        }, { onConflict: 'user_id' });
    } catch (saveError) {
      logApiError('lead-magnet/ideate/save-brand-kit', saveError, { userId: session.user.id });
      // Non-critical, continue
    }

    // Create job record
    const jobInput: IdeationJobInput = {
      businessContext: {
        businessDescription: context.businessDescription,
        businessType: context.businessType,
        credibilityMarkers: context.credibilityMarkers || [],
        urgentPains: context.urgentPains || [],
        templates: context.templates || [],
        processes: context.processes || [],
        tools: context.tools || [],
        frequentQuestions: context.frequentQuestions || [],
        results: context.results || [],
        successExample: context.successExample,
      },
      sources: sources ? {
        callTranscriptInsights: sources.callTranscriptInsights,
        competitorAnalysis: sources.competitorAnalysis,
      } : undefined,
    };

    const { data: job, error: jobError } = await supabase
      .from('background_jobs')
      .insert({
        user_id: session.user.id,
        job_type: 'ideation',
        status: 'pending',
        input: jobInput,
      })
      .select('id')
      .single();

    if (jobError || !job) {
      logApiError('lead-magnet/ideate/create-job', jobError, { userId: session.user.id });
      return ApiErrors.databaseError('Failed to create job');
    }

    // Trigger background task
    const handle = await ideateLeadMagnet.trigger({
      jobId: job.id,
      userId: session.user.id,
      input: jobInput,
    });

    // Update job with trigger task ID
    await supabase
      .from('background_jobs')
      .update({ trigger_task_id: handle.id })
      .eq('id', job.id);

    const response: CreateJobResponse = {
      jobId: job.id,
      status: 'pending',
    };

    return NextResponse.json(response);
  } catch (error) {
    logApiError('lead-magnet/ideate', error);
    return ApiErrors.internalError('Failed to start ideation');
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/lead-magnet/ideate/route.ts
git commit -m "feat: convert ideation API to background job pattern"
```

---

## Task 6: Frontend Polling Hook

**Files:**
- Create: `src/lib/hooks/useBackgroundJob.ts`

**Step 1: Create the polling hook**

```typescript
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { JobStatus, JobStatusResponse } from '@/lib/types/background-jobs';

interface UseBackgroundJobOptions<TResult> {
  /** Polling interval in ms (default: 2000) */
  pollInterval?: number;
  /** Stop polling after this many ms (default: 300000 = 5 min) */
  timeout?: number;
  /** Callback when job completes successfully */
  onComplete?: (result: TResult) => void;
  /** Callback when job fails */
  onError?: (error: string) => void;
}

interface UseBackgroundJobReturn<TResult> {
  status: JobStatus | null;
  result: TResult | null;
  error: string | null;
  isLoading: boolean;
  isPolling: boolean;
  startPolling: (jobId: string) => void;
  stopPolling: () => void;
}

export function useBackgroundJob<TResult = unknown>(
  options: UseBackgroundJobOptions<TResult> = {}
): UseBackgroundJobReturn<TResult> {
  const {
    pollInterval = 2000,
    timeout = 300000,
    onComplete,
    onError,
  } = options;

  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<JobStatus | null>(null);
  const [result, setResult] = useState<TResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const onCompleteRef = useRef(onComplete);
  const onErrorRef = useRef(onError);

  // Keep callbacks fresh
  useEffect(() => {
    onCompleteRef.current = onComplete;
    onErrorRef.current = onError;
  }, [onComplete, onError]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsPolling(false);
  }, []);

  const pollStatus = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/jobs/${id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch job status');
      }

      const data: JobStatusResponse<TResult> = await response.json();
      setStatus(data.status);

      if (data.status === 'completed' && data.result) {
        setResult(data.result);
        stopPolling();
        onCompleteRef.current?.(data.result);
      } else if (data.status === 'failed') {
        setError(data.error || 'Job failed');
        stopPolling();
        onErrorRef.current?.(data.error || 'Job failed');
      }
    } catch (err) {
      console.error('Poll error:', err);
      // Don't stop polling on network errors, just log
    }
  }, [stopPolling]);

  const startPolling = useCallback((id: string) => {
    // Reset state
    setJobId(id);
    setStatus('pending');
    setResult(null);
    setError(null);
    setIsPolling(true);

    // Clear any existing intervals
    stopPolling();

    // Start polling
    intervalRef.current = setInterval(() => {
      pollStatus(id);
    }, pollInterval);

    // Set timeout
    timeoutRef.current = setTimeout(() => {
      stopPolling();
      setError('Job timed out');
      onErrorRef.current?.('Job timed out');
    }, timeout);

    // Initial poll
    pollStatus(id);
  }, [pollInterval, timeout, pollStatus, stopPolling]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  return {
    status,
    result,
    error,
    isLoading: status === 'pending' || status === 'processing',
    isPolling,
    startPolling,
    stopPolling,
  };
}
```

**Step 2: Commit**

```bash
git add src/lib/hooks/useBackgroundJob.ts
git commit -m "feat: add useBackgroundJob polling hook"
```

---

## Task 7: Update WizardContainer to Use Background Jobs

**Files:**
- Modify: `src/components/wizard/WizardContainer.tsx`

**Step 1: Update imports and add hook usage**

At the top of the file, add:

```typescript
import { useBackgroundJob } from '@/lib/hooks/useBackgroundJob';
import type { IdeationResult } from '@/lib/types/lead-magnet';
```

**Step 2: Replace handleContextSubmit with background job version**

Find the `handleContextSubmit` function and replace it:

```typescript
const { startPolling, status: jobStatus, isLoading: isJobLoading } = useBackgroundJob<IdeationResult>({
  pollInterval: 2000,
  timeout: 180000, // 3 minutes
  onComplete: (ideationResult) => {
    setState((prev) => ({
      ...prev,
      ideationResult,
      currentStep: 2,
    }));
    setGenerating('idle');
  },
  onError: (errorMessage) => {
    setError(errorMessage);
    setState((prev) => ({ ...prev, currentStep: 1 }));
    setGenerating('idle');
  },
});

const handleContextSubmit = useCallback(async (context: BusinessContext, sources?: IdeationSources) => {
  setGenerating('ideas');
  setError(null);

  // Update sources in state if provided
  if (sources) {
    setState((prev) => ({ ...prev, ideationSources: sources }));
  }

  try {
    // Build request body with optional sources
    const requestBody: Record<string, unknown> = { ...context };
    if (sources) {
      requestBody.sources = {
        callTranscriptInsights: sources.callTranscript?.insights,
        competitorAnalysis: sources.competitorInspiration?.analysis,
      };
    }

    // Trigger background job
    const response = await fetch('/api/lead-magnet/ideate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to start ideation');
      } else {
        const text = await response.text();
        throw new Error(`Server error (${response.status}): ${text.substring(0, 100)}`);
      }
    }

    const { jobId } = await response.json();

    // Update state with context (even though ideas aren't ready yet)
    setState((prev) => ({
      ...prev,
      brandKit: context,
    }));

    // Start polling for results
    startPolling(jobId);
  } catch (err) {
    console.error('Context submit error:', err);
    setError(err instanceof Error ? err.message : 'An error occurred');
    setState((prev) => ({ ...prev, currentStep: 1 }));
    setGenerating('idle');
  }
}, [startPolling]);
```

**Step 3: Update generating state check**

Find where `generating === 'ideas'` is checked and also include `isJobLoading`:

```typescript
// In the render, update the GeneratingScreen condition:
{(generating !== 'idle' || isJobLoading) && (
  <GeneratingScreen
    phase={generating === 'idle' && isJobLoading ? 'ideas' : generating}
  />
)}
```

**Step 4: Commit**

```bash
git add src/components/wizard/WizardContainer.tsx
git commit -m "feat: update wizard to use background job for ideation"
```

---

## Task 8: Trigger.dev Extraction Task (Optional - Lower Priority)

**Files:**
- Create: `src/trigger/extract-content.ts`

**Step 1: Create the extraction task**

```typescript
import { task } from "@trigger.dev/sdk/v3";
import { createSupabaseAdminClient } from "@/lib/utils/supabase-server";
import { processContentExtraction } from "@/lib/ai/lead-magnet-generator";
import { logApiError } from "@/lib/api/errors";
import type { LeadMagnetArchetype, LeadMagnetConcept } from "@/lib/types/lead-magnet";

export interface ExtractContentPayload {
  jobId: string;
  userId: string;
  archetype: LeadMagnetArchetype;
  concept: LeadMagnetConcept;
  answers: Record<string, string>;
}

export const extractContent = task({
  id: "extract-content",
  retry: {
    maxAttempts: 2,
  },
  run: async (payload: ExtractContentPayload) => {
    const { jobId, userId, archetype, concept, answers } = payload;
    const supabase = createSupabaseAdminClient();

    await supabase
      .from("background_jobs")
      .update({
        status: "processing",
        started_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    try {
      const extractedContent = await processContentExtraction(archetype, concept, answers);

      await supabase
        .from("background_jobs")
        .update({
          status: "completed",
          result: extractedContent,
          completed_at: new Date().toISOString(),
        })
        .eq("id", jobId);

      return { success: true, jobId };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logApiError("extract-content", error, { userId, jobId });

      await supabase
        .from("background_jobs")
        .update({
          status: "failed",
          error: errorMessage,
          completed_at: new Date().toISOString(),
        })
        .eq("id", jobId);

      throw error;
    }
  },
});
```

**Step 2: Commit**

```bash
git add src/trigger/extract-content.ts
git commit -m "feat: add Trigger.dev task for content extraction"
```

---

## Task 9: Trigger.dev Polish Task (Optional - Lower Priority)

**Files:**
- Create: `src/trigger/polish-content.ts`

**Step 1: Create the polish task**

```typescript
import { task } from "@trigger.dev/sdk/v3";
import { createSupabaseAdminClient } from "@/lib/utils/supabase-server";
import { polishLeadMagnetContent } from "@/lib/ai/lead-magnet-generator";
import { logApiError } from "@/lib/api/errors";
import type { ExtractedContent, LeadMagnetConcept } from "@/lib/types/lead-magnet";

export interface PolishContentPayload {
  jobId: string;
  userId: string;
  leadMagnetId: string;
}

export const polishContent = task({
  id: "polish-content",
  retry: {
    maxAttempts: 2,
  },
  run: async (payload: PolishContentPayload) => {
    const { jobId, userId, leadMagnetId } = payload;
    const supabase = createSupabaseAdminClient();

    await supabase
      .from("background_jobs")
      .update({
        status: "processing",
        started_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    try {
      // Fetch lead magnet data
      const { data: leadMagnet, error: fetchError } = await supabase
        .from("lead_magnets")
        .select("extracted_content, concept")
        .eq("id", leadMagnetId)
        .eq("user_id", userId)
        .single();

      if (fetchError || !leadMagnet) {
        throw new Error("Lead magnet not found");
      }

      if (!leadMagnet.extracted_content || !leadMagnet.concept) {
        throw new Error("Lead magnet missing required content");
      }

      const extractedContent = leadMagnet.extracted_content as ExtractedContent;
      const concept = leadMagnet.concept as LeadMagnetConcept;

      // Run polish (uses Opus, can be slow)
      const polishedContent = await polishLeadMagnetContent(extractedContent, concept);
      const polishedAt = new Date().toISOString();

      // Save to lead magnet
      await supabase
        .from("lead_magnets")
        .update({
          polished_content: polishedContent,
          polished_at: polishedAt,
        })
        .eq("id", leadMagnetId);

      // Mark job complete
      await supabase
        .from("background_jobs")
        .update({
          status: "completed",
          result: { polishedContent, polishedAt },
          completed_at: new Date().toISOString(),
        })
        .eq("id", jobId);

      return { success: true, jobId, leadMagnetId };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logApiError("polish-content", error, { userId, jobId, leadMagnetId });

      await supabase
        .from("background_jobs")
        .update({
          status: "failed",
          error: errorMessage,
          completed_at: new Date().toISOString(),
        })
        .eq("id", jobId);

      throw error;
    }
  },
});
```

**Step 2: Commit**

```bash
git add src/trigger/polish-content.ts
git commit -m "feat: add Trigger.dev task for content polishing"
```

---

## Task 10: Deploy and Test

**Step 1: Deploy Trigger.dev tasks**

Run: `npx trigger.dev@latest dev` (for local testing)

Or for production:
Run: `npx trigger.dev@latest deploy`

**Step 2: Deploy to Vercel**

```bash
git push origin main
```

**Step 3: Test the flow**

1. Go to the wizard at `/create`
2. Fill in business context
3. Click "Generate 10 Ideas"
4. Observe: Should see loading state, then ideas appear after background processing
5. Check Trigger.dev dashboard for task execution

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete background jobs architecture for AI processing"
```

---

## Summary

### Files Created
- `supabase/migrations/20260204_background_jobs.sql`
- `src/lib/types/background-jobs.ts`
- `src/app/api/jobs/[id]/route.ts`
- `src/trigger/ideate-lead-magnet.ts`
- `src/trigger/extract-content.ts` (optional)
- `src/trigger/polish-content.ts` (optional)
- `src/lib/hooks/useBackgroundJob.ts`

### Files Modified
- `src/app/api/lead-magnet/ideate/route.ts`
- `src/components/wizard/WizardContainer.tsx`

### Key Benefits
1. **No more timeouts** - Trigger.dev tasks have no time limit
2. **Non-blocking UX** - Users can navigate away, job continues
3. **Retry logic** - Failed jobs automatically retry
4. **Visibility** - Job status tracked in database
5. **Modular** - Each AI operation is independent
