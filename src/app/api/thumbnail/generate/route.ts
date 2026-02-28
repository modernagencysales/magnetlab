import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDataScope } from "@/lib/utils/team-context";
import { ApiErrors, logApiError } from "@/lib/api/errors";
import * as thumbnailService from "@/server/services/thumbnail.service";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const body = await request.json();
    const { leadMagnetId, title, subtitle } = body as {
      leadMagnetId: string;
      title?: string;
      subtitle?: string;
    };

    if (!leadMagnetId) {
      return ApiErrors.validationError("leadMagnetId is required");
    }
    if (!title) {
      return ApiErrors.validationError("title must be provided");
    }

    const scope = await getDataScope(session.user.id);
    const thumbnailUrl = await thumbnailService.generateAndSaveThumbnail(
      scope,
      session.user.id,
      leadMagnetId,
      title,
      subtitle,
    );

    return NextResponse.json({ thumbnailUrl });
  } catch (error) {
    logApiError("thumbnail/generate", error);
    return ApiErrors.internalError("Failed to generate thumbnail");
  }
}
