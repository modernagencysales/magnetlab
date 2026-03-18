/** Tool definition aggregator. Exports flat array of all 40 MCP tools + name lookup map. */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { leadMagnetTools } from './lead-magnets.js';
import { funnelTools } from './funnels.js';
import { knowledgeTools } from './knowledge.js';
import { postTools } from './posts.js';
import { emailTools } from './email.js';
import { leadTools } from './leads.js';
import { schemaTools } from './schema.js';
import { compoundTools } from './compound.js';
import { feedbackTools } from './feedback.js';
import { accountTools } from './account.js';
import { contentQueueTools } from './content-queue.js';

export const tools: Tool[] = [
  ...leadMagnetTools,
  ...funnelTools,
  ...knowledgeTools,
  ...postTools,
  ...emailTools,
  ...leadTools,
  ...schemaTools,
  ...compoundTools,
  ...feedbackTools,
  ...accountTools,
  ...contentQueueTools,
];

export const toolsByName = new Map<string, Tool>(tools.map((t) => [t.name, t]));
