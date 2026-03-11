// Import all action modules to trigger registration
import './knowledge';
import './content';
import './templates';
import './analytics';
import './scheduling';
import './lead-magnets';
import './funnels';
import './email';
import './program';
import './providers';
import './metrics';
import './schedules';
import './enrollment';

// Re-export the executor and registry
export { executeAction, actionRequiresConfirmation } from './executor';
export { getToolDefinitions, getAllActions } from './registry';
export type { ActionContext, ActionResult } from './types';
