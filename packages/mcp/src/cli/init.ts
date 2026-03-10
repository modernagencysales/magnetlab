import * as fs from 'node:fs';
import * as path from 'node:path';
import * as readline from 'node:readline';
import { slashCommands } from './commands/index.js';
import { MagnetLabClient } from '../client.js';

export interface InitFile {
  path: string;
  content: string;
  type: 'slash-command' | 'claude-md-section';
}

/**
 * Generate the CLAUDE.md section content.
 */
export function generateClaudeMdSection(): string {
  const commandList = Object.values(slashCommands)
    .map((cmd) => `| /${cmd.filename.replace('.md', '')} | ${cmd.description} |`)
    .join('\n');

  return `## MagnetLab CLI

MagnetLab is your AI-powered lead magnet platform. The \`magnetlab\` CLI lets you create lead magnets, manage funnels, write content, and run your knowledge base from the terminal.

### Slash Commands

| Command | Description |
|---------|-------------|
${commandList}

### CLI Reference

| Command | Purpose |
|---------|---------|
| \`magnetlab exec <tool> [flags]\` | Execute any tool (118 available) |
| \`magnetlab tools [category]\` | List available tools by category |
| \`magnetlab help <tool>\` | Show tool parameters and usage |
| \`magnetlab guide <task>\` | Step-by-step workflow for common tasks |
| \`magnetlab status <id>\` | Check lead magnet completeness |

### Key Principle

Always run \`magnetlab guide <task>\` before starting any multi-step task. The guide returns the exact sequence of CLI commands to follow.

The AI Brain (\`magnetlab exec search_knowledge\`) contains the user's real expertise from call transcripts. Always search it before creating content — never generate from thin air.
`;
}

/**
 * Generate all files that init should create (without writing them).
 * Pure function for testability.
 */
export function generateInitFiles(): InitFile[] {
  const files: InitFile[] = [];

  for (const cmd of Object.values(slashCommands)) {
    files.push({
      path: `.claude/commands/${cmd.filename}`,
      content: cmd.content,
      type: 'slash-command',
    });
  }

  files.push({
    path: 'CLAUDE.md',
    content: generateClaudeMdSection(),
    type: 'claude-md-section',
  });

  return files;
}

/**
 * Prompt user for API key via stdin.
 */
async function promptApiKey(): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
  return new Promise((resolve) => {
    rl.question(
      'Enter your MagnetLab API key (from magnetlab.app/settings/developer): ',
      (answer) => {
        rl.close();
        resolve(answer.trim());
      }
    );
  });
}

/**
 * Run the init command.
 */
export async function runInit(options: { apiKey?: string; baseUrl?: string }): Promise<void> {
  const cwd = process.cwd();

  // Step 1: Resolve API key
  let apiKey = options.apiKey || process.env.MAGNETLAB_API_KEY;

  if (!apiKey) {
    apiKey = await promptApiKey();
    if (!apiKey) {
      console.error('No API key provided. Aborting.');
      process.exit(1);
    }

    // Save to .env
    const envPath = path.join(cwd, '.env');
    const envLine = `MAGNETLAB_API_KEY=${apiKey}\n`;
    if (fs.existsSync(envPath)) {
      const existing = fs.readFileSync(envPath, 'utf-8');
      if (!existing.includes('MAGNETLAB_API_KEY')) {
        fs.appendFileSync(envPath, envLine);
        console.log('  Added MAGNETLAB_API_KEY to .env');
      }
    } else {
      fs.writeFileSync(envPath, envLine);
      console.log('  Created .env with MAGNETLAB_API_KEY');
    }
  }

  // Step 2: Verify connection
  try {
    const client = new MagnetLabClient(apiKey, { baseUrl: options.baseUrl });
    await client.listLeadMagnets({ limit: 1 });
    console.log('✓ API key verified');
  } catch (err) {
    console.error(`✗ API key verification failed: ${err instanceof Error ? err.message : err}`);
    console.error('  Check your key at magnetlab.app/settings/developer');
    process.exit(1);
  }

  // Step 3: Generate slash commands
  const commandsDir = path.join(cwd, '.claude', 'commands');
  fs.mkdirSync(commandsDir, { recursive: true });

  const files = generateInitFiles();
  const commandFiles = files.filter((f) => f.type === 'slash-command');

  for (const file of commandFiles) {
    const filePath = path.join(cwd, file.path);
    fs.writeFileSync(filePath, file.content, 'utf-8');
    console.log(`✓ Created ${file.path}`);
  }

  // Step 4: Update CLAUDE.md
  const claudeMdPath = path.join(cwd, 'CLAUDE.md');
  const section = files.find((f) => f.type === 'claude-md-section')!;

  if (fs.existsSync(claudeMdPath)) {
    const existing = fs.readFileSync(claudeMdPath, 'utf-8');
    if (existing.includes('## MagnetLab CLI')) {
      console.log('  CLAUDE.md already has MagnetLab CLI section — skipped');
    } else {
      fs.appendFileSync(claudeMdPath, '\n' + section.content);
      console.log('✓ Updated CLAUDE.md with MagnetLab CLI reference');
    }
  } else {
    fs.writeFileSync(claudeMdPath, section.content);
    console.log('✓ Created CLAUDE.md with MagnetLab CLI reference');
  }

  console.log('\nReady! Try: /create-lead-magnet <topic>');
}
