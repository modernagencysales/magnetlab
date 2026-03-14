import { MagnetLabClient } from '../client.js'

/**
 * Handle library tool calls.
 */
export async function handleLibraryTools(
  name: string,
  args: Record<string, unknown>,
  client: MagnetLabClient
): Promise<unknown> {
  switch (name) {
    case 'magnetlab_list_libraries':
      return client.listLibraries()

    case 'magnetlab_get_library':
      return client.getLibrary(args.id as string)

    case 'magnetlab_create_library':
      return client.createLibrary({
        name: args.name as string,
        description: args.description as string | undefined,
      })

    case 'magnetlab_update_library':
      return client.updateLibrary(args.id as string, {
        name: args.name as string | undefined,
        description: args.description as string | undefined,
      })

    case 'magnetlab_delete_library':
      return client.deleteLibrary(args.id as string)

    case 'magnetlab_list_library_items':
      return client.listLibraryItems(args.library_id as string)

    case 'magnetlab_create_library_item': {
      const { library_id, ...rest } = args
      return client.createLibraryItem(library_id as string, rest)
    }

    default:
      throw new Error(`Unknown library tool: ${name}`)
  }
}
