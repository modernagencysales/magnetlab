import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { ApiErrors, logApiError, isValidUUID } from "@/lib/api/errors";
import * as performanceService from "@/server/services/performance.service";

const VALID_PLATFORMS = ["linkedin", "twitter", "instagram", "other"];

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const body = await request.json();
    const {
      post_id,
      platform = "linkedin",
      views,
      likes,
      comments,
      shares,
      saves,
      clicks,
      impressions,
      engagement_rate,
      captured_at,
    } = body;

    if (!post_id || !isValidUUID(post_id)) {
      return ApiErrors.validationError("Valid post_id is required");
    }
    if (!VALID_PLATFORMS.includes(platform)) {
      return ApiErrors.validationError(
        `Invalid platform. Must be one of: ${VALID_PLATFORMS.join(", ")}`,
      );
    }
    const hasMetric = [
      views,
      likes,
      comments,
      shares,
      saves,
      clicks,
      impressions,
      engagement_rate,
    ].some((v) => v !== undefined && v !== null);
    if (!hasMetric) {
      return ApiErrors.validationError("At least one metric must be provided");
    }

    const performance = await performanceService.submitPerformance(
      session.user.id,
      {
        post_id,
        platform,
        views,
        likes,
        comments,
        shares,
        saves,
        clicks,
        impressions,
        engagement_rate,
        captured_at,
      },
    );
    return NextResponse.json({ performance }, { status: 201 });
  } catch (error) {
    if (error && typeof error === "object" && "statusCode" in error) {
      const status = (error as { statusCode: number }).statusCode;
      const message = error instanceof Error ? error.message : "Conflict";
      return NextResponse.json({ error: message }, { status });
    }
    logApiError("content-pipeline/performance", error);
    return ApiErrors.internalError();
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const { searchParams } = request.nextUrl;
    const postId = searchParams.get("post_id");
    const platform = searchParams.get("platform");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const limit = Math.min(parseInt(searchParams.get("limit") || "100", 10), 500);

    if (postId && !isValidUUID(postId)) {
      return ApiErrors.validationError("Invalid post_id");
    }

    const { performance, aggregates } = await performanceService.getPerformance(
      session.user.id,
      { post_id: postId ?? undefined, platform: platform ?? undefined, from: from ?? undefined, to: to ?? undefined, limit },
    );

    return NextResponse.json({ performance, aggregates });
  } catch (error) {
    logApiError("content-pipeline/performance", error);
    return ApiErrors.internalError();
  }
}
