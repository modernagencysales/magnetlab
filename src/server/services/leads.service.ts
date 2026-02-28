/**
 * Leads Service
 */

import * as leadsRepo from "@/server/repositories/leads.repo";
import type { DataScope } from "@/lib/utils/team-context";

interface LeadWithFunnel {
  id: string;
  email: string;
  name: string | null;
  is_qualified: boolean | null;
  qualification_answers: Record<string, string> | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  created_at: string;
  funnel_pages: {
    slug: string;
    optin_headline: string;
    lead_magnets: { title: string } | null;
  };
}

export interface LeadListItem {
  id: string;
  email: string;
  name: string | null;
  isQualified: boolean | null;
  qualificationAnswers: Record<string, string> | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  createdAt: string;
  funnelSlug: string | null;
  funnelHeadline: string | null;
  leadMagnetTitle: string | null;
}

export async function getLeads(
  scope: DataScope,
  filters: leadsRepo.LeadFilters,
): Promise<{ leads: LeadListItem[]; total: number; limit: number; offset: number }> {
  const { data, count } = await leadsRepo.findLeads(scope, filters);
  const leads = (data as LeadWithFunnel[]).map((lead) => ({
    id: lead.id,
    email: lead.email,
    name: lead.name,
    isQualified: lead.is_qualified,
    qualificationAnswers: lead.qualification_answers,
    utmSource: lead.utm_source,
    utmMedium: lead.utm_medium,
    utmCampaign: lead.utm_campaign,
    createdAt: lead.created_at,
    funnelSlug: lead.funnel_pages?.slug ?? null,
    funnelHeadline: lead.funnel_pages?.optin_headline ?? null,
    leadMagnetTitle: lead.funnel_pages?.lead_magnets?.title ?? null,
  }));
  return {
    leads,
    total: count,
    limit: filters.limit ?? 50,
    offset: filters.offset ?? 0,
  };
}

function escapeCSV(value: string): string {
  if (!value) return "";
  const escaped = value.replace(/"/g, '""');
  if (escaped.includes(",") || escaped.includes("\n") || escaped.includes('"')) {
    return `"${escaped}"`;
  }
  return escaped;
}

export async function exportLeadsCsv(
  scope: DataScope,
  filters: Omit<leadsRepo.LeadFilters, "limit" | "offset">,
): Promise<{ csv: string; filename: string }> {
  const data = await leadsRepo.findLeadsForExport(scope, filters);
  if (!data || data.length === 0) {
    const err = Object.assign(new Error("No leads to export"), { statusCode: 404 });
    throw err;
  }
  const headers = [
    "email",
    "name",
    "qualified",
    "lead_magnet",
    "funnel_slug",
    "answers",
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "created_at",
  ];
  const rows = (data as Array<{
    email: string;
    name: string | null;
    is_qualified: boolean | null;
    qualification_answers: Record<string, string> | null;
    utm_source: string | null;
    utm_medium: string | null;
    utm_campaign: string | null;
    created_at: string;
    lead_magnets: { title: string } | null;
    funnel_pages: { slug: string } | null;
  }>).map((lead) => {
    const leadMagnet = lead.lead_magnets;
    const funnelPage = lead.funnel_pages;
    return [
      escapeCSV(lead.email),
      escapeCSV(lead.name || ""),
      lead.is_qualified === null ? "" : lead.is_qualified ? "yes" : "no",
      escapeCSV(leadMagnet?.title || ""),
      escapeCSV(funnelPage?.slug || ""),
      escapeCSV(lead.qualification_answers ? JSON.stringify(lead.qualification_answers) : ""),
      escapeCSV(lead.utm_source || ""),
      escapeCSV(lead.utm_medium || ""),
      escapeCSV(lead.utm_campaign || ""),
      lead.created_at,
    ].join(",");
  });
  const csv = [headers.join(","), ...rows].join("\n");
  const date = new Date().toISOString().split("T")[0];
  return { csv, filename: `leads-export-${date}.csv` };
}
