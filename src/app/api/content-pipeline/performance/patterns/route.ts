import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { ApiErrors, logApiError } from "@/lib/api/errors";
import * as performanceService from "@/server/services/performance.service";

const VALID_TYPES = [
  "archetype",
  "hook",
  "format",
  "topic",
  "time_of_day",
  "content_pillar",
  "content_type",
  "length",
];

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const { searchParams } = request.nextUrl;
    const patternType = searchParams.get("type");
    const includeInsights = searchParams.get("include_insights") === "true";

    if (patternType && !VALID_TYPES.includes(patternType)) {
      return ApiErrors.validationError(
        `Invalid pattern type. Must be one of: ${VALID_TYPES.join(", ")}`,
      );
    }

    const result = await performanceService.getPatterns(session.user.id, {
      patternType: patternType ?? undefined,
      includeInsights,
    });

    return NextResponse.json({
      patterns: result.patterns,
      topAttributes: result.topAttributes,
      insights: result.insights,
    });
  } catch (error) {
    logApiError("content-pipeline/performance/patterns", error);
    return ApiErrors.internalError();
  }
}

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const result = await performanceService.runPatternAnalysis(session.user.id);
    return NextResponse.json({
      message: "Pattern analysis complete",
      ...result,
    });
  } catch (error) {
    logApiError("content-pipeline/performance/patterns", error);
    return ApiErrors.internalError();
  }
}
