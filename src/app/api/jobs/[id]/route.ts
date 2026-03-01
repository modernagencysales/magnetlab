import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { ApiErrors, logApiError } from "@/lib/api/errors";
import * as jobsService from "@/server/services/jobs.service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const { id } = await params;
    const job = await jobsService.getJobStatus(session.user.id, id);

    if (!job) {
      return ApiErrors.notFound("Job");
    }

    return NextResponse.json(job);
  } catch (error) {
    logApiError("jobs/status", error);
    return ApiErrors.internalError("Failed to get job status");
  }
}
