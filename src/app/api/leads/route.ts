import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { ApiErrors, logApiError } from "@/lib/api/errors";
import { getDataScope } from "@/lib/utils/team-context";
import * as leadsService from "@/server/services/leads.service";

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 50;

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
    const search = searchParams.get("search") ?? undefined;

    const rawLimit = parseInt(searchParams.get("limit") || String(DEFAULT_LIMIT), 10);
    const rawOffset = parseInt(searchParams.get("offset") || "0", 10);
    if (Number.isNaN(rawLimit) || Number.isNaN(rawOffset)) {
      return ApiErrors.validationError("Invalid pagination parameters");
    }
    const limit = Math.min(Math.max(1, rawLimit), MAX_LIMIT);
    const offset = Math.max(0, rawOffset);

    const scope = await getDataScope(session.user.id);
    const result = await leadsService.getLeads(scope, {
      funnelPageId: funnelId,
      leadMagnetId,
      qualified,
      search,
      limit,
      offset,
    });

    return NextResponse.json(result);
  } catch (error) {
    logApiError("leads/list", error);
    return ApiErrors.internalError("Failed to fetch leads");
  }
}
