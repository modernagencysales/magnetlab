import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { logError } from "@/lib/utils/logger";
import * as scraperService from "@/server/services/scraper.service";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await request.json();
    const { content, viral_post_id } = body;
    if (!content) {
      return NextResponse.json({ error: "content is required" }, { status: 400 });
    }
    const template = await scraperService.extractTemplateAndSave(
      session.user.id,
      content,
      viral_post_id,
    );
    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    logError("cp/scraper", error, { step: "template_extraction_error" });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
