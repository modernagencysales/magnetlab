export interface ActionContext {
  userId: string;
  teamId?: string;
}

export interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  displayHint?: 'post_preview' | 'knowledge_list' | 'plan' | 'idea_list' | 'calendar' | 'text';
}

export type ActionHandler<TParams = unknown, TResult = unknown> = (
  ctx: ActionContext,
  params: TParams,
) => Promise<ActionResult<TResult>>;

export interface ActionDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema object
  handler: ActionHandler;
  requiresConfirmation?: boolean; // For destructive actions
}
