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
    const { posts, author_name, author_headline, source_linkedin_url } = body;

    if (!Array.isArray(posts) || posts.length === 0) {
      return NextResponse.json(
        { error: "posts array is required (at least 1 post)" },
        { status: 400 },
      );
    }

    const result = await stylesService.extractFromPostsAndCreate(
      session.user.id,
      {
        posts,
        author_name: author_name ?? null,
        author_headline: author_headline ?? null,
        source_linkedin_url: source_linkedin_url ?? null,
      },
    );

    return NextResponse.json(
      {
        style: result.style,
        key_patterns: result.key_patterns,
        recommendations: result.recommendations,
      },
      { status: 201 },
    );
  } catch (error) {
    logError("cp/styles", error, { step: "style_extract_error" });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
