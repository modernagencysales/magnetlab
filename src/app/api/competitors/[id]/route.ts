import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { logError } from "@/lib/utils/logger";
import * as competitorsService from "@/server/services/competitors.service";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;
    const body = await request.json();
    const updates: { is_active?: boolean; heyreach_campaign_id?: string | null } = {};
    if ("is_active" in body && typeof body.is_active === "boolean") {
      updates.is_active = body.is_active;
    }
    if ("heyreach_campaign_id" in body) {
      updates.heyreach_campaign_id = body.heyreach_campaign_id ?? null;
    }
    const competitor = await competitorsService.updateCompetitor(
      session.user.id,
      id,
      updates,
    );
    if (!competitor) {
      return NextResponse.json({ error: "Competitor not found" }, { status: 404 });
    }
    return NextResponse.json({ competitor });
  } catch (error) {
    logError("api/competitors", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

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
    await competitorsService.deleteCompetitor(session.user.id, id);
    return NextResponse.json({ deleted: true });
  } catch (error) {
    logError("api/competitors", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
