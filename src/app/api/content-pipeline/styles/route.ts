import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { logError } from "@/lib/utils/logger";
import * as stylesService from "@/server/services/styles.service";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const styles = await stylesService.getStyles(session.user.id);
    return NextResponse.json({ styles: styles ?? [] });
  } catch (error) {
    logError("cp/styles", error, { step: "styles_list_error" });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
