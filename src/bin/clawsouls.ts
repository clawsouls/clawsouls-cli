#!/usr/bin/env node

import { Command } from 'commander';
import { installCommand } from '../commands/install.js';
import { useCommand } from '../commands/use.js';
import { restoreCommand } from '../commands/restore.js';
import { listCommand } from '../commands/list.js';
import { initCommand } from '../commands/init.js';

const program = new Command();

program
  .name('clawsouls')
  .description('🧠 ClawSouls — AI agent persona sharing platform')
  .version('0.1.0');

program
  .command('install <name>')
  .description('Install a soul from the registry')
  .option('-f, --force', 'Overwrite existing installation')
  .action(installCommand);

program
  .command('use <name>')
  .description('Apply an installed soul to your workspace')
  .action(useCommand);

program
  .command('restore')
  .description('Restore workspace from the latest backup')
  .action(restoreCommand);

program
  .command('list')
  .alias('ls')
  .description('List installed souls')
  .action(listCommand);

program
  .command('init [name]')
  .description('Create a new soul package')
  .action(initCommand);

program.parse();
