import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { ApiErrors, logApiError } from "@/lib/api/errors";
import * as inspirationService from "@/server/services/inspiration.service";

const VALID_CONTENT_TYPES = ["post", "lead_magnet", "funnel", "article"];

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const { searchParams } = request.nextUrl;
    const sourceId = searchParams.get("source_id") ?? undefined;
    const contentType = searchParams.get("content_type") ?? undefined;
    if (contentType && !inspirationService.validateContentType(contentType)) {
      return ApiErrors.validationError(
        `Invalid content_type. Must be one of: ${VALID_CONTENT_TYPES.join(", ")}`,
      );
    }
    const from = searchParams.get("from") ?? undefined;
    const to = searchParams.get("to") ?? undefined;
    const savedOnly = searchParams.get("saved_only") === "true";
    const dismissedParam = searchParams.get("dismissed");
    const dismissed =
      dismissedParam === "false"
        ? false
        : dismissedParam === "true"
          ? true
          : undefined;
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 200);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    const { data, count } = await inspirationService.getPulls(session.user.id, {
      source_id: sourceId,
      content_type: contentType,
      from,
      to,
      saved_only: savedOnly,
      dismissed,
      limit,
      offset,
    });

    return NextResponse.json({
      pulls: data,
      total: count,
      limit,
      offset,
    });
  } catch (error) {
    logApiError("content-pipeline/inspiration", error);
    return ApiErrors.internalError();
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const body = await request.json();
    const { pull_id, saved_to_swipe_file, dismissed } = body;

    if (!pull_id || typeof pull_id !== "string") {
      return ApiErrors.validationError("pull_id is required");
    }
    const updates: Record<string, unknown> = {};
    if (saved_to_swipe_file !== undefined) updates.saved_to_swipe_file = saved_to_swipe_file;
    if (dismissed !== undefined) updates.dismissed = dismissed;
    if (Object.keys(updates).length === 0) {
      return ApiErrors.validationError("At least one field to update is required");
    }

    const pull = await inspirationService.updatePull(session.user.id, pull_id, updates);
    if (!pull) return ApiErrors.notFound("Inspiration pull");
    return NextResponse.json({ pull });
  } catch (error) {
    logApiError("content-pipeline/inspiration", error);
    return ApiErrors.internalError();
  }
}
