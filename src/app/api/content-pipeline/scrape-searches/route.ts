import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { logError } from "@/lib/utils/logger";
import * as scrapeSearchesService from "@/server/services/scrape-searches.service";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searches = await scrapeSearchesService.getScrapeSearches();
    return NextResponse.json({ searches: searches ?? [] });
  } catch (error) {
    logError("cp/scrape-searches", error, { step: "searches_list_error" });
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
    const { query, description, post_format_filter } = body;

    if (!query || typeof query !== "string") {
      return NextResponse.json({ error: "query is required" }, { status: 400 });
    }

    const search = await scrapeSearchesService.createScrapeSearch({
      query,
      description: description ?? null,
      post_format_filter: post_format_filter ?? null,
    });
    return NextResponse.json({ search }, { status: 201 });
  } catch (error) {
    logError("cp/scrape-searches", error, { step: "search_create_error" });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
