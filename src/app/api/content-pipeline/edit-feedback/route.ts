import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireTeamScope } from "@/lib/utils/team-context";
import { logError } from "@/lib/utils/logger";
import * as editFeedbackService from "@/server/services/edit-feedback.service";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { editId, tags, note } = body;

    if (!editId || typeof editId !== "string") {
      return NextResponse.json({ error: "editId is required" }, { status: 400 });
    }

    if (tags && !Array.isArray(tags)) {
      return NextResponse.json({ error: "tags must be an array" }, { status: 400 });
    }

    if (note && typeof note !== "string") {
      return NextResponse.json({ error: "note must be a string" }, { status: 400 });
    }

    if (note && note.length > 500) {
      return NextResponse.json(
        { error: "Note must be 500 characters or less" },
        { status: 400 },
      );
    }

    const scope = await requireTeamScope(session.user.id);
    if (!scope?.teamId) {
      return NextResponse.json({ error: "Team context required" }, { status: 403 });
    }

    await editFeedbackService.submitEditFeedback(scope, editId, { tags, note });

    return NextResponse.json({ success: true });
  } catch (error) {
    logError("edit-feedback", error);
    const status = editFeedbackService.getStatusCode(error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status });
  }
}
