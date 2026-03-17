/**
 * Brand Kit Service
 * Get/upsert brand kit by scope; upload returns URL.
 */

import { normalizeImageUrl } from '@/lib/utils/normalize-image-url';
import * as brandKitRepo from '@/server/repositories/brand-kit.repo';
import * as storageRepo from '@/server/repositories/storage.repo';
import type { DataScope } from '@/lib/utils/team-context';

export async function getBrandKit(scope: DataScope) {
  const data = await brandKitRepo.getBrandKit(scope);
  return {
    brandKit: data ?? null,
    savedIdeation: data?.saved_ideation_result ?? null,
    ideationGeneratedAt: data?.ideation_generated_at ?? null,
  };
}

export function buildBrandKitPayload(
  userId: string,
  scope: DataScope,
  body: Record<string, unknown>
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    user_id: userId,
    team_id: scope.teamId ?? null,
    business_description: body.businessDescription,
    business_type: body.businessType,
    credibility_markers: body.credibilityMarkers ?? [],
    urgent_pains: body.urgentPains ?? [],
    templates: body.templates ?? [],
    processes: body.processes ?? [],
    tools: body.tools ?? [],
    frequent_questions: body.frequentQuestions ?? [],
    results: body.results ?? [],
    success_example: body.successExample,
    audience_tools: body.audienceTools ?? [],
    preferred_tone: body.preferredTone ?? 'conversational',
    style_profile: body.styleProfile,
  };
  if (body.logos !== undefined) payload.logos = body.logos;
  if (body.defaultTestimonial !== undefined) payload.default_testimonial = body.defaultTestimonial;
  if (body.defaultSteps !== undefined) payload.default_steps = body.defaultSteps;
  if (body.defaultTheme !== undefined) payload.default_theme = body.defaultTheme;
  if (body.defaultPrimaryColor !== undefined)
    payload.default_primary_color = body.defaultPrimaryColor;
  if (body.defaultBackgroundStyle !== undefined)
    payload.default_background_style = body.defaultBackgroundStyle;
  if (body.logoUrl !== undefined)
    payload.logo_url = body.logoUrl ? normalizeImageUrl(body.logoUrl as string) : body.logoUrl;
  if (body.fontFamily !== undefined) payload.font_family = body.fontFamily;
  if (body.fontUrl !== undefined) payload.font_url = body.fontUrl;
  if (body.websiteUrl !== undefined) {
    try {
      const u = new URL(body.websiteUrl as string);
      payload.website_url = ['http:', 'https:'].includes(u.protocol) ? body.websiteUrl : null;
    } catch {
      payload.website_url = null;
    }
  }
  return payload;
}

export async function upsertBrandKit(
  scope: DataScope,
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  return brandKitRepo.upsertBrandKit(scope, payload);
}

/** Partial update — only updates fields present in the payload. Safe for BrandingSettings. */
export async function partialUpdateBrandKit(
  scope: DataScope,
  body: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const updates: Record<string, unknown> = {};
  if (body.fontFamily !== undefined) updates.font_family = body.fontFamily;
  if (body.fontUrl !== undefined) updates.font_url = body.fontUrl;
  if (body.logoUrl !== undefined)
    updates.logo_url = body.logoUrl ? normalizeImageUrl(body.logoUrl as string) : body.logoUrl;
  if (body.defaultTheme !== undefined) updates.default_theme = body.defaultTheme;
  if (body.defaultPrimaryColor !== undefined)
    updates.default_primary_color = body.defaultPrimaryColor;
  if (body.defaultBackgroundStyle !== undefined)
    updates.default_background_style = body.defaultBackgroundStyle;
  if (body.defaultTestimonial !== undefined) updates.default_testimonial = body.defaultTestimonial;
  if (body.defaultSteps !== undefined) updates.default_steps = body.defaultSteps;
  if (body.logos !== undefined) updates.logos = body.logos;
  if (body.websiteUrl !== undefined) {
    try {
      const u = new URL(body.websiteUrl as string);
      updates.website_url = ['http:', 'https:'].includes(u.protocol) ? body.websiteUrl : null;
    } catch {
      updates.website_url = null;
    }
  }
  if (Object.keys(updates).length === 0) throw new Error('No fields to update');
  updates.updated_at = new Date().toISOString();
  return brandKitRepo.updateBrandKit(scope, updates);
}

export async function uploadFile(
  userId: string,
  type: 'logo' | 'font',
  path: string,
  buffer: Buffer,
  contentType: string
): Promise<string> {
  return storageRepo.uploadToPublicAssets(path, buffer, contentType);
}
