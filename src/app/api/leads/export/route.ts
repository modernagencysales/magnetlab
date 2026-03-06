import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { ApiErrors, logApiError } from "@/lib/api/errors";
import { getDataScope } from "@/lib/utils/team-context";
import * as leadsService from "@/server/services/leads.service";

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const { searchParams } = new URL(request.url);
    const funnelId = searchParams.get("funnelId") ?? undefined;
    const leadMagnetId = searchParams.get("leadMagnetId") ?? undefined;
    const qualifiedParam = searchParams.get("qualified");
    const qualified =
      qualifiedParam === "true" ? true : qualifiedParam === "false" ? false : undefined;

    const scope = await getDataScope(session.user.id);
    const { csv, filename } = await leadsService.exportLeadsCsv(scope, {
      funnelPageId: funnelId,
      leadMagnetId,
      qualified,
    });

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    if (error && typeof error === "object" && "statusCode" in error) {
      const status = (error as { statusCode: number }).statusCode;
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Not found" },
        { status },
      );
    }
    logApiError("leads/export", error);
    return ApiErrors.internalError("Failed to export leads");
  }
}
