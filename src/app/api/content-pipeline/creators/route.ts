import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { logError } from "@/lib/utils/logger";
import * as creatorsService from "@/server/services/creators.service";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const creators = await creatorsService.getCreators(session.user.id);
    return NextResponse.json({ creators: creators ?? [] });
  } catch (error) {
    logError("cp/creators", error, { step: "creators_list_error" });
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
    const { linkedin_url, name, headline } = body;

    if (!linkedin_url || typeof linkedin_url !== "string") {
      return NextResponse.json(
        { error: "linkedin_url is required" },
        { status: 400 },
      );
    }

    const result = await creatorsService.addCreator(session.user.id, {
      linkedin_url,
      name: name ?? null,
      headline: headline ?? null,
    });

    if (result.message) {
      return NextResponse.json({
        creator: result.creator,
        message: result.message,
      });
    }
    return NextResponse.json({ creator: result.creator }, { status: 201 });
  } catch (error) {
    logError("cp/creators", error, { step: "creator_create_error" });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
