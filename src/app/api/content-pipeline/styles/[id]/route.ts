import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { logError } from "@/lib/utils/logger";
import * as stylesService from "@/server/services/styles.service";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const style = await stylesService.getStyleById(session.user.id, id);

    if (!style) {
      return NextResponse.json({ error: "Style not found" }, { status: 404 });
    }

    return NextResponse.json({ style });
  } catch (error) {
    logError("cp/styles", error, { step: "style_get_error" });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

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

    const style = await stylesService.updateStyle(session.user.id, id, body);
    return NextResponse.json({ style });
  } catch (error) {
    logError("cp/styles", error, { step: "style_update_error" });
    const status = stylesService.getStatusCode(error);
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status });
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
    await stylesService.deleteStyle(session.user.id, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    logError("cp/styles", error, { step: "style_delete_error" });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
