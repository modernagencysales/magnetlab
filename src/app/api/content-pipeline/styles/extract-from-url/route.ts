import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { logError } from "@/lib/utils/logger";
import * as stylesService from "@/server/services/styles.service";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { linkedin_url, author_name } = body;

    if (!linkedin_url || typeof linkedin_url !== "string") {
      return NextResponse.json(
        { error: "linkedin_url is required" },
        { status: 400 },
      );
    }

    const normalizedUrl = stylesService.normalizeLinkedInUrl(linkedin_url);

    try {
      const parsed = new URL(normalizedUrl);
      if (!["www.linkedin.com", "linkedin.com"].includes(parsed.hostname)) {
        return NextResponse.json(
          { error: "URL must be a LinkedIn profile" },
          { status: 400 },
        );
      }
    } catch {
      return NextResponse.json(
        { error: "Invalid URL format" },
        { status: 400 },
      );
    }

    const result = await stylesService.extractFromUrlAndCreate(session.user.id, {
      linkedin_url: normalizedUrl,
      author_name: author_name ?? null,
    });

    return NextResponse.json(
      {
        style: result.style,
        key_patterns: result.key_patterns,
        recommendations: result.recommendations,
        posts_analyzed: result.posts_analyzed,
      },
      { status: 201 },
    );
  } catch (error) {
    logError("cp/styles", error, { step: "extract_from_url_error" });
    const status = stylesService.getStatusCode(error);
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status });
  }
}
