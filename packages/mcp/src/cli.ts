#!/usr/bin/env node

import { Command } from 'commander';
import { formatToolList, formatCategoryTools } from './cli/tools-command.js';
import { formatToolHelp } from './cli/help-command.js';
import { execTool } from './cli/exec.js';
import { workflowRecipes } from './tools/category-tools.js';
import { runInit } from './cli/init.js';

const VERSION = '0.5.0';

const program = new Command();

program
  .name('magnetlab')
  .description(
    'MagnetLab CLI — create lead magnets, manage funnels, and run your content pipeline from the terminal'
  )
  .version(VERSION);

program
  .command('tools [category]')
  .description('List available tools, optionally filtered by category')
  .action((category?: string) => {
    if (category) {
      console.log(formatCategoryTools(category));
    } else {
      console.log(formatToolList());
    }
  });

program
  .command('help <tool>')
  .description('Show parameters and usage for a specific tool')
  .action((tool: string) => {
    console.log(formatToolHelp(tool));
  });

program
  .command('guide [task]')
  .description('Show step-by-step workflow for common tasks')
  .action((task?: string) => {
    if (!task) {
      console.log(workflowRecipes['list_tasks']);
      return;
    }
    const recipe = workflowRecipes[task];
    if (!recipe) {
      console.log(`Unknown task: "${task}"\n`);
      console.log(workflowRecipes['list_tasks']);
      return;
    }
    console.log(recipe);
  });

program
  .command('exec <tool> [flags...]')
  .description('Execute any MagnetLab tool (magnetlab_ prefix optional)')
  .option('--api-key <key>', 'MagnetLab API key')
  .option('--base-url <url>', 'MagnetLab API base URL')
  .option('--pretty', 'Pretty-print JSON output')
  .allowUnknownOption()
  .action(
    async (
      tool: string,
      flags: string[],
      options: { apiKey?: string; baseUrl?: string; pretty?: boolean }
    ) => {
      const apiKey = options.apiKey || process.env.MAGNETLAB_API_KEY;
      if (!apiKey) {
        console.error(
          JSON.stringify({ error: 'API key required. Set MAGNETLAB_API_KEY or use --api-key' })
        );
        process.exit(1);
      }

      const allFlags = flags;
      const { output, exitCode } = await execTool(tool, allFlags, apiKey, options.baseUrl);

      if (options.pretty) {
        try {
          console.log(JSON.stringify(JSON.parse(output), null, 2));
        } catch {
          console.log(output);
        }
      } else {
        console.log(output);
      }

      process.exit(exitCode);
    }
  );

program
  .command('status <id>')
  .description('Check lead magnet completeness — shortcut for exec lead_magnet_status')
  .option('--api-key <key>', 'MagnetLab API key')
  .option('--base-url <url>', 'MagnetLab API base URL')
  .option('--pretty', 'Pretty-print JSON output')
  .action(async (id: string, options: { apiKey?: string; baseUrl?: string; pretty?: boolean }) => {
    const apiKey = options.apiKey || process.env.MAGNETLAB_API_KEY;
    if (!apiKey) {
      console.error(
        JSON.stringify({ error: 'API key required. Set MAGNETLAB_API_KEY or use --api-key' })
      );
      process.exit(1);
    }

    const { output, exitCode } = await execTool(
      'lead_magnet_status',
      ['--lead-magnet-id', id],
      apiKey,
      options.baseUrl
    );

    if (options.pretty) {
      try {
        console.log(JSON.stringify(JSON.parse(output), null, 2));
      } catch {
        console.log(output);
      }
    } else {
      console.log(output);
    }

    process.exit(exitCode);
  });

program
  .command('init')
  .description('Set up Claude Code project with slash commands and CLAUDE.md')
  .option('--api-key <key>', 'MagnetLab API key')
  .option('--base-url <url>', 'MagnetLab API base URL')
  .action(async (options: { apiKey?: string; baseUrl?: string }) => {
    await runInit(options);
  });

program.parse();
