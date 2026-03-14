/** Account tools (1). Team listing for multi-team scoping. */

import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const accountTools: Tool[] = [
  {
    name: 'magnetlab_list_teams',
    description:
      'List all teams the authenticated user belongs to. Returns team ID, name, and role for each team. Use the team_id from this response to scope other operations to a specific team.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];
