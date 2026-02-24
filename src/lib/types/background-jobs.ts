// Background Jobs Types

import type { CallTranscriptInsights, CompetitorAnalysis } from './lead-magnet';

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
    callTranscriptInsights?: CallTranscriptInsights;
    competitorAnalysis?: CompetitorAnalysis;
  };
}

export interface ExtractionJobInput {
  archetype: string;
  concept: unknown;
  answers: Record<string, string>;
  transcriptInsights?: CallTranscriptInsights;
  action?: 'generate-interactive';
  businessContext?: unknown;
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
