import { createLeadMagnet } from './create-lead-magnet.js';
import { writePost } from './write-post.js';
import { checkBrain } from './check-brain.js';
import { leadMagnetStatus } from './lead-magnet-status.js';
import { setupFunnel } from './setup-funnel.js';
import { contentWeek } from './content-week.js';

export interface SlashCommand {
  filename: string;
  description: string;
  content: string;
}

export const slashCommands: Record<string, SlashCommand> = {
  'create-lead-magnet': createLeadMagnet,
  'write-post': writePost,
  'check-brain': checkBrain,
  'lead-magnet-status': leadMagnetStatus,
  'setup-funnel': setupFunnel,
  'content-week': contentWeek,
};
