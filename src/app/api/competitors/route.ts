import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { logError } from "@/lib/utils/logger";
import * as competitorsService from "@/server/services/competitors.service";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const competitors = await competitorsService.getCompetitors(session.user.id);
    return NextResponse.json({ competitors });
  } catch (error) {
    logError("api/competitors", error);
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
    const { linkedinProfileUrl, heyreachCampaignId } = body as {
      linkedinProfileUrl: string;
      heyreachCampaignId?: string;
    };
    if (!linkedinProfileUrl?.trim()) {
      return NextResponse.json(
        { error: "LinkedIn profile URL is required" },
        { status: 400 },
      );
    }
    const competitor = await competitorsService.addCompetitor(session.user.id, {
      linkedinProfileUrl,
      heyreachCampaignId,
    });
    return NextResponse.json({ competitor }, { status: 201 });
  } catch (error) {
    if (error && typeof error === "object" && "statusCode" in error) {
      const status = (error as { statusCode: number }).statusCode;
      const message = error instanceof Error ? error.message : "Error";
      return NextResponse.json({ error: message }, { status });
    }
    logError("api/competitors", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
