import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/auth/super-admin";
import * as adminLearningService from "@/server/services/admin-learning.service";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await isSuperAdmin(session.user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const thirtyDaysAgo = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { editActivity, profiles } = await adminLearningService.getLearningData(
    thirtyDaysAgo,
  );

  return NextResponse.json({
    editActivity: editActivity ?? [],
    profiles: profiles ?? [],
  });
}
