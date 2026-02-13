#!/usr/bin/env node

import { Command } from 'commander';
import { createRequire } from 'node:module';
import { installCommand } from '../commands/install.js';
import { useCommand } from '../commands/use.js';
import { restoreCommand } from '../commands/restore.js';
import { listCommand } from '../commands/list.js';

const require = createRequire(import.meta.url);
const { version } = require('../../package.json');

const program = new Command();

program
  .name('clawsouls')
  .description('AI agent persona manager for OpenClaw')
  .version(version);

program
  .command('install <name>')
  .description('Install a soul from the registry')
  .option('-f, --force', 'Overwrite if already installed')
  .action(installCommand);

program
  .command('use <name>')
  .description('Activate an installed soul (backs up current workspace)')
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

program.parse();
