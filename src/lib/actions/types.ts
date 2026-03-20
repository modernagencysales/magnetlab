import { DataScope } from '@/lib/utils/team-context';

export interface ActionContext {
  scope: DataScope;
}

export interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  displayHint?:
    | 'post_preview'
    | 'knowledge_list'
    | 'plan'
    | 'idea_list'
    | 'calendar'
    | 'text'
    | 'content_review'
    | 'dm_coach_suggestion';
}

export type ActionHandler = (
  ctx: ActionContext,
  params: Record<string, unknown>
) => Promise<ActionResult>;

export interface ActionDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema object
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: (ctx: ActionContext, params: any) => Promise<ActionResult>;
  requiresConfirmation?: boolean; // For destructive actions
}
