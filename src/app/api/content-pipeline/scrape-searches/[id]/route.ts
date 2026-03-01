import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { logError } from "@/lib/utils/logger";
import * as scrapeSearchesService from "@/server/services/scrape-searches.service";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    await scrapeSearchesService.deleteScrapeSearch(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    logError("cp/scrape-searches", error, { step: "search_delete_error" });
    const status = scrapeSearchesService.getStatusCode(error);
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status });
  }
}
