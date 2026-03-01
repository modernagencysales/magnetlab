import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { logError } from "@/lib/utils/logger";
import * as creatorsService from "@/server/services/creators.service";

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
    await creatorsService.deleteCreator(session.user.id, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    logError("cp/creators", error, { step: "creator_delete_error" });
    const status = creatorsService.getStatusCode(error);
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status });
  }
}
