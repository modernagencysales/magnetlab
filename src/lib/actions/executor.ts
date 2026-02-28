import type { ActionContext, ActionResult } from './types';
import { getAction } from './registry';

export async function executeAction(
  ctx: ActionContext,
  name: string,
  args: Record<string, unknown>,
): Promise<ActionResult> {
  const action = getAction(name);
  if (!action) {
    return { success: false, error: `Unknown action: ${name}` };
  }

  try {
    return await action.handler(ctx, args);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Action execution failed';
    return { success: false, error: message };
  }
}

export function actionRequiresConfirmation(name: string): boolean {
  const action = getAction(name);
  return action?.requiresConfirmation ?? false;
}
