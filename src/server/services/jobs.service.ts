/**
 * Background Jobs Service
 * Business logic for job status (read-only).
 */

import * as jobsRepo from "@/server/repositories/jobs.repo";
import type { JobStatusResponse } from "@/lib/types/background-jobs";

export async function getJobStatus(
  userId: string,
  jobId: string,
): Promise<JobStatusResponse | null> {
  const job = await jobsRepo.findJobById(userId, jobId);
  if (!job) return null;

  return {
    id: job.id,
    status: job.status,
    result: job.result,
    error: job.error,
    createdAt: job.created_at,
    completedAt: job.completed_at,
  };
}
