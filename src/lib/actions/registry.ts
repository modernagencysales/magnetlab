import type { ActionDefinition } from './types';

const actions = new Map<string, ActionDefinition>();

export function registerAction(def: ActionDefinition): void {
  actions.set(def.name, def);
}

export function getAction(name: string): ActionDefinition | undefined {
  return actions.get(name);
}

export function getAllActions(): ActionDefinition[] {
  return Array.from(actions.values());
}

export function getToolDefinitions(): Array<{
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}> {
  return getAllActions().map((action) => ({
    name: action.name,
    description: action.description,
    input_schema: {
      type: 'object',
      ...action.parameters,
    },
  }));
}
