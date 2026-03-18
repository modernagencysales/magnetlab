<<<<<<< Updated upstream
<<<<<<< Updated upstream
/** Tool definition aggregator. Exports flat array of all 50 MCP tools + name lookup map. */
=======
/** Tool definition aggregator. Exports flat array of all 43 MCP tools + name lookup map. */
>>>>>>> Stashed changes
=======
/** Tool definition aggregator. Exports flat array of all 43 MCP tools + name lookup map. */
>>>>>>> Stashed changes

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
import { postCampaignTools } from './post-campaigns.js';
import { accountSafetyTools } from './account-safety.js';

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
  ...postCampaignTools,
  ...accountSafetyTools,
];

export const toolsByName = new Map<string, Tool>(tools.map((t) => [t.name, t]));
