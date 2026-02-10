import { MagnetLabClient } from '../client.js'

/**
 * Handle email sequence tool calls.
 */
export async function handleEmailSequenceTools(
  name: string,
  args: Record<string, unknown>,
  client: MagnetLabClient
): Promise<unknown> {
  switch (name) {
    case 'magnetlab_get_email_sequence':
      return client.getEmailSequence(args.lead_magnet_id as string)

    case 'magnetlab_generate_email_sequence':
      return client.generateEmailSequence({
        leadMagnetId: args.lead_magnet_id as string,
        useAI: args.use_ai as boolean | undefined,
      })

    case 'magnetlab_update_email_sequence': {
      const emails = args.emails as Array<{
        day: number
        subject: string
        body: string
        reply_trigger: string
      }> | undefined

      return client.updateEmailSequence(args.lead_magnet_id as string, {
        emails: emails?.map((e) => ({
          day: e.day,
          subject: e.subject,
          body: e.body,
          replyTrigger: e.reply_trigger,
        })),
        status: args.status as 'draft' | 'synced' | 'active' | undefined,
      })
    }

    case 'magnetlab_activate_email_sequence':
      return client.activateEmailSequence(args.lead_magnet_id as string)

    default:
      throw new Error(`Unknown email sequence tool: ${name}`)
  }
}
