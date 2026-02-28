import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { logError } from "@/lib/utils/logger";
import * as quickWriteService from "@/server/services/quick-write.service";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      raw_thought,
      template_structure,
      style_instructions,
      target_audience,
      profileId,
    } = body;

    if (
      !raw_thought ||
      typeof raw_thought !== "string" ||
      raw_thought.trim().length === 0
    ) {
      return NextResponse.json(
        { error: "raw_thought is required" },
        { status: 400 },
      );
    }

    const result = await quickWriteService.executeQuickWrite(session.user.id, {
      raw_thought: raw_thought.trim(),
      template_structure: template_structure ?? null,
      style_instructions: style_instructions ?? null,
      target_audience: target_audience ?? null,
      profileId: profileId ?? null,
    });

    return NextResponse.json(
      {
        post: result.post,
        synthetic_idea: result.synthetic_idea,
      },
      { status: 201 },
    );
  } catch (error) {
    logError("cp/quick-write", error, { step: "quick_write_error" });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
