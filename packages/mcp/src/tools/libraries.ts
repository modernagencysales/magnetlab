import { Tool } from '@modelcontextprotocol/sdk/types.js'

export const libraryTools: Tool[] = [
  {
    name: 'magnetlab_list_libraries',
    description:
      'List all content libraries. Libraries are collections of resources (links, files, documents) that can be gated behind funnel pages.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'magnetlab_get_library',
    description: 'Get full details of a content library including its name, description, and metadata.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Library UUID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'magnetlab_create_library',
    description: 'Create a new content library. Add items to it afterward, then create a funnel page to gate access.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Library name' },
        description: { type: 'string', description: 'Library description' },
      },
      required: ['name'],
    },
  },
  {
    name: 'magnetlab_update_library',
    description: 'Update a library\'s name or description.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Library UUID' },
        name: { type: 'string', description: 'New name' },
        description: { type: 'string', description: 'New description' },
      },
      required: ['id'],
    },
  },
  {
    name: 'magnetlab_delete_library',
    description: 'Delete a content library and all its items.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Library UUID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'magnetlab_list_library_items',
    description: 'List all items in a content library.',
    inputSchema: {
      type: 'object',
      properties: {
        library_id: { type: 'string', description: 'Library UUID' },
      },
      required: ['library_id'],
    },
  },
  {
    name: 'magnetlab_create_library_item',
    description: 'Add a new item to a content library.',
    inputSchema: {
      type: 'object',
      properties: {
        library_id: { type: 'string', description: 'Library UUID' },
        title: { type: 'string', description: 'Item title' },
        url: { type: 'string', description: 'Resource URL' },
        description: { type: 'string', description: 'Item description' },
        type: { type: 'string', description: 'Item type (e.g. link, file, video)' },
      },
      required: ['library_id', 'title'],
    },
  },
]
