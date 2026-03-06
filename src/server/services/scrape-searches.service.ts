/**
 * Scrape Searches Service
 * Business logic for cp_scrape_searches.
 */

import * as scrapeSearchesRepo from "@/server/repositories/scrape-searches.repo";
import type { ScrapeSearch, CreateScrapeSearchInput } from "@/server/repositories/scrape-searches.repo";

export async function getScrapeSearches(): Promise<ScrapeSearch[]> {
  return scrapeSearchesRepo.findScrapeSearches();
}

export async function createScrapeSearch(
  input: CreateScrapeSearchInput,
): Promise<ScrapeSearch> {
  return scrapeSearchesRepo.createScrapeSearch(input);
}

export async function deleteScrapeSearch(id: string): Promise<void> {
  const existing = await scrapeSearchesRepo.findScrapeSearchById(id);
  if (!existing) {
    const err = Object.assign(new Error("Search not found"), { statusCode: 404 });
    throw err;
  }
  await scrapeSearchesRepo.deleteScrapeSearch(id);
}

export function getStatusCode(err: unknown): number {
  if (err && typeof err === "object" && "statusCode" in err) {
    return (err as { statusCode: number }).statusCode;
  }
  return 500;
}
