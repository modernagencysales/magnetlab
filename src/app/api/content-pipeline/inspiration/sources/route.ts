import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { ApiErrors, logApiError, isValidUUID } from "@/lib/api/errors";
import * as inspirationService from "@/server/services/inspiration.service";

function isValidUrl(str: string): boolean {
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
}

const VALID_SOURCE_TYPES = ["creator", "search_term", "hashtag", "competitor"];

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const activeOnly = request.nextUrl.searchParams.get("active_only") !== "false";
    const sources = await inspirationService.getSources(session.user.id, activeOnly);
    return NextResponse.json({ sources });
  } catch (error) {
    logApiError("content-pipeline/inspiration/sources", error);
    return ApiErrors.internalError();
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const body = await request.json();
    const { source_type, source_value, priority } = body;

    if (!source_type || !VALID_SOURCE_TYPES.includes(source_type)) {
      return ApiErrors.validationError(
        `source_type must be one of: ${VALID_SOURCE_TYPES.join(", ")}`,
      );
    }
    if (!source_value || typeof source_value !== "string" || source_value.trim().length === 0) {
      return ApiErrors.validationError("source_value is required");
    }
    const cleanValue = source_value.trim();
    if (source_type === "creator" && !isValidUrl(cleanValue)) {
      return ApiErrors.validationError(
        "Creator source_value must be a valid URL (e.g., LinkedIn profile URL)",
      );
    }
    if (source_type === "hashtag") {
      const normalized = cleanValue.startsWith("#") ? cleanValue : `#${cleanValue}`;
      if (normalized.length < 2) {
        return ApiErrors.validationError("Hashtag must be at least 2 characters");
      }
    }

    const result = await inspirationService.createSource(session.user.id, {
      source_type,
      source_value: cleanValue,
      priority,
    });

    if (result.reactivated) {
      return NextResponse.json({ source: result.source, reactivated: true });
    }
    return NextResponse.json({ source: result.source }, { status: 201 });
  } catch (error) {
    if (error && typeof error === "object" && "statusCode" in error) {
      const status = (error as { statusCode: number }).statusCode;
      const message = error instanceof Error ? error.message : "Conflict";
      return NextResponse.json({ error: message }, { status });
    }
    logApiError("content-pipeline/inspiration/sources", error);
    return ApiErrors.internalError();
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const body = await request.json();
    const { source_id, hard_delete } = body;

    if (!source_id || !isValidUUID(source_id)) {
      return ApiErrors.validationError("Valid source_id is required");
    }

    await inspirationService.deleteSource(
      session.user.id,
      source_id,
      Boolean(hard_delete),
    );
    return NextResponse.json({
      message: hard_delete ? "Source deleted" : "Source deactivated",
    });
  } catch (error) {
    logApiError("content-pipeline/inspiration/sources/delete", error);
    return ApiErrors.internalError();
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const body = await request.json();
    const { source_id, priority, is_active } = body;

    if (!source_id || !isValidUUID(source_id)) {
      return ApiErrors.validationError("Valid source_id is required");
    }

    const updates: { priority?: number; is_active?: boolean } = {};
    if (priority !== undefined) {
      updates.priority = Math.max(1, Math.min(5, parseInt(priority, 10) || 3));
    }
    if (is_active !== undefined) updates.is_active = Boolean(is_active);
    if (Object.keys(updates).length === 0) {
      return ApiErrors.validationError("At least one field to update is required");
    }

    const source = await inspirationService.updateSource(
      session.user.id,
      source_id,
      updates,
    );
    if (!source) return ApiErrors.notFound("Inspiration source");
    return NextResponse.json({ source });
  } catch (error) {
    logApiError("content-pipeline/inspiration/sources", error);
    return ApiErrors.internalError();
  }
}
