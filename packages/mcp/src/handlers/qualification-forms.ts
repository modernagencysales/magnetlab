import { MagnetLabClient } from '../client.js'

/**
 * Handle qualification form tool calls.
 */
export async function handleQualificationFormTools(
  name: string,
  args: Record<string, unknown>,
  client: MagnetLabClient
): Promise<unknown> {
  switch (name) {
    case 'magnetlab_list_qualification_forms':
      return client.listQualificationForms()

    case 'magnetlab_get_qualification_form':
      return client.getQualificationForm(args.id as string)

    case 'magnetlab_create_qualification_form':
      return client.createQualificationForm({ name: args.name as string })

    case 'magnetlab_list_questions':
      return client.listQuestions(args.form_id as string)

    case 'magnetlab_create_question': {
      const { form_id, ...rest } = args
      return client.createQuestion(form_id as string, rest)
    }

    default:
      throw new Error(`Unknown qualification form tool: ${name}`)
  }
}
