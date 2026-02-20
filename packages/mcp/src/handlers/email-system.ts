import { MagnetLabClient } from '../client.js'

/**
 * Handle email system tool calls (flows, broadcasts, subscribers).
 */
export async function handleEmailSystemTools(
  name: string,
  args: Record<string, unknown>,
  client: MagnetLabClient
): Promise<unknown> {
  switch (name) {
    // ── Flows ──────────────────────────────────────────────
    case 'magnetlab_list_email_flows':
      return client.listEmailFlows()

    case 'magnetlab_get_email_flow':
      return client.getEmailFlow(args.id as string)

    case 'magnetlab_create_email_flow':
      return client.createEmailFlow({
        name: args.name as string,
        trigger_type: args.trigger_type as 'lead_magnet' | 'manual',
        description: args.description as string | undefined,
        trigger_lead_magnet_id: args.trigger_lead_magnet_id as string | undefined,
      })

    case 'magnetlab_update_email_flow': {
      const updateParams: Record<string, unknown> = {}
      if (args.name !== undefined) updateParams.name = args.name
      if (args.description !== undefined) updateParams.description = args.description
      if (args.status !== undefined) updateParams.status = args.status
      if (args.trigger_type !== undefined) updateParams.trigger_type = args.trigger_type
      if (args.trigger_lead_magnet_id !== undefined)
        updateParams.trigger_lead_magnet_id = args.trigger_lead_magnet_id
      return client.updateEmailFlow(args.id as string, updateParams)
    }

    case 'magnetlab_delete_email_flow':
      return client.deleteEmailFlow(args.id as string)

    case 'magnetlab_add_flow_step':
      return client.addFlowStep(args.flow_id as string, {
        step_number: args.step_number as number,
        subject: args.subject as string,
        body: args.body as string,
        delay_days: args.delay_days as number,
      })

    case 'magnetlab_generate_flow_emails':
      return client.generateFlowEmails(
        args.flow_id as string,
        args.step_count as number | undefined
      )

    // ── Broadcasts ─────────────────────────────────────────
    case 'magnetlab_list_broadcasts':
      return client.listBroadcasts()

    case 'magnetlab_get_broadcast':
      return client.getBroadcast(args.id as string)

    case 'magnetlab_create_broadcast':
      return client.createBroadcast({
        subject: args.subject as string | undefined,
        body: args.body as string | undefined,
      })

    case 'magnetlab_update_broadcast': {
      const broadcastParams: Record<string, unknown> = {}
      if (args.subject !== undefined) broadcastParams.subject = args.subject
      if (args.body !== undefined) broadcastParams.body = args.body
      if (args.audience_filter !== undefined) broadcastParams.audience_filter = args.audience_filter
      return client.updateBroadcast(args.id as string, broadcastParams)
    }

    case 'magnetlab_send_broadcast':
      return client.sendBroadcast(args.id as string)

    // ── Subscribers ────────────────────────────────────────
    case 'magnetlab_list_subscribers':
      return client.listSubscribers({
        search: args.search as string | undefined,
        status: args.status as string | undefined,
        source: args.source as string | undefined,
        page: args.page as number | undefined,
        limit: args.limit as number | undefined,
      })

    case 'magnetlab_add_subscriber':
      return client.addSubscriber({
        email: args.email as string,
        first_name: args.first_name as string | undefined,
        last_name: args.last_name as string | undefined,
      })

    case 'magnetlab_unsubscribe':
      return client.unsubscribeSubscriber(args.id as string)

    default:
      throw new Error(`Unknown email system tool: ${name}`)
  }
}
