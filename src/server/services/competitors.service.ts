/**
 * Competitors Service
 */

import * as competitorsRepo from "@/server/repositories/competitors.repo";

const MAX_COMPETITORS = 10;

export interface CompetitorWithEngagers extends competitorsRepo.CompetitorRow {
  total_engagers: number;
}

export async function getCompetitors(
  userId: string,
): Promise<CompetitorWithEngagers[]> {
  const competitors = await competitorsRepo.findCompetitorsByUserId(userId);
  const withCounts = await Promise.all(
    competitors.map(async (comp) => {
      const total_engagers = await competitorsRepo.countEngagementsForCompetitor(
        comp.id,
      );
      return { ...comp, total_engagers };
    }),
  );
  return withCounts;
}

export async function addCompetitor(
  userId: string,
  input: { linkedinProfileUrl: string; heyreachCampaignId?: string },
): Promise<competitorsRepo.CompetitorRow> {
  let normalizedUrl = input.linkedinProfileUrl.trim();
  if (!normalizedUrl.startsWith("http")) {
    normalizedUrl = `https://www.linkedin.com/in/${normalizedUrl}`;
  }
  normalizedUrl = normalizedUrl.split("?")[0].replace(/\/$/, "");
  if (!normalizedUrl.match(/linkedin\.com\/in\//)) {
    const err = Object.assign(new Error("Must be a LinkedIn profile URL"), {
      statusCode: 400,
    });
    throw err;
  }

  const count = await competitorsRepo.countCompetitorsByUserId(userId);
  if (count >= MAX_COMPETITORS) {
    const err = Object.assign(
      new Error(`Maximum ${MAX_COMPETITORS} competitors allowed`),
      { statusCode: 400 },
    );
    throw err;
  }

  try {
    return await competitorsRepo.createCompetitor(userId, {
      linkedin_profile_url: normalizedUrl,
      heyreach_campaign_id: input.heyreachCampaignId ?? null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("23505")) {
      const conflict = Object.assign(new Error("Competitor already added"), {
        statusCode: 409,
      });
      throw conflict;
    }
    throw err;
  }
}

export async function updateCompetitor(
  userId: string,
  id: string,
  updates: { is_active?: boolean; heyreach_campaign_id?: string | null },
): Promise<competitorsRepo.CompetitorRow | null> {
  const out: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.is_active !== undefined) out.is_active = updates.is_active;
  if ("heyreach_campaign_id" in updates) {
    out.heyreach_campaign_id = updates.heyreach_campaign_id ?? null;
  }
  return competitorsRepo.updateCompetitor(userId, id, out);
}

export async function deleteCompetitor(
  userId: string,
  id: string,
): Promise<void> {
  return competitorsRepo.deleteCompetitor(userId, id);
}
