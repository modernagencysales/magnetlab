/** Style Rules Validation Schemas. Zod schemas for style rules API requests. */

import { z } from 'zod';

export const StyleRuleCreateSchema = z
  .object({
    rule_text: z.string().min(10, 'Rule text must be at least 10 characters'),
    pattern_name: z.string().min(1).optional().default('manual'),
    scope: z.enum(['global', 'team']).default('global'),
    team_id: z.string().uuid().nullable().optional(),
    status: z.enum(['proposed', 'approved']).optional().default('proposed'),
  })
  .refine(
    (data) => data.scope !== 'team' || (data.team_id !== null && data.team_id !== undefined),
    {
      message: 'team_id is required when scope is team',
    }
  );

export type StyleRuleCreateInput = z.infer<typeof StyleRuleCreateSchema>;

export const StyleRulePatchSchema = z
  .object({
    status: z.enum(['proposed', 'approved', 'rejected']).optional(),
    rule_text: z.string().min(10, 'Rule text must be at least 10 characters').optional(),
  })
  .refine((data) => data.status !== undefined || data.rule_text !== undefined, {
    message: 'At least one field must be provided',
  });

export type StyleRulePatchInput = z.infer<typeof StyleRulePatchSchema>;
