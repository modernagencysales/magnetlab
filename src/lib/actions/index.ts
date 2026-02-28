// Import all action modules to trigger registration
import './knowledge';
import './content';
import './templates';
import './analytics';
import './scheduling';

// Re-export the executor and registry
export { executeAction, actionRequiresConfirmation } from './executor';
export { getToolDefinitions, getAllActions } from './registry';
export type { ActionContext, ActionResult } from './types';
