import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { logError } from "@/lib/utils/logger";
import * as scraperService from "@/server/services/scraper.service";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { runs, posts } = await scraperService.getRunsAndPosts(session.user.id);
    return NextResponse.json({ runs, posts });
  } catch (error) {
    logError("cp/scraper", error, { step: "scraper_list_error" });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await request.json();
    const { posts, target_url } = body;
    if (!Array.isArray(posts) || posts.length === 0) {
      return NextResponse.json({ error: "posts array is required" }, { status: 400 });
    }
    const { run, posts: inserted } = await scraperService.importPosts(session.user.id, {
      posts,
      target_url: target_url ?? null,
    });
    return NextResponse.json({ run, posts: inserted }, { status: 201 });
  } catch (error) {
    logError("cp/scraper", error, { step: "scraper_import_error" });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
