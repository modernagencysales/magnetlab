import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { logError } from "@/lib/utils/logger";
import * as businessContextService from "@/server/services/business-context.service";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const context = await businessContextService.getBusinessContext(session.user.id);
    return NextResponse.json({ context: context ?? null });
  } catch (error) {
    logError("cp/business-context", error, { step: "business_context_get_error" });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const input = {
      company_name: body.company_name ?? null,
      industry: body.industry ?? null,
      company_description: body.company_description ?? null,
      icp_title: body.icp_title ?? null,
      icp_industry: body.icp_industry ?? null,
      icp_pain_points: body.icp_pain_points ?? [],
      target_audience: body.target_audience ?? null,
      content_preferences: body.content_preferences ?? {},
    };

    const context = await businessContextService.upsertBusinessContext(
      session.user.id,
      input,
    );
    return NextResponse.json({ context });
  } catch (error) {
    logError("cp/business-context", error, {
      step: "business_context_upsert_error",
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
