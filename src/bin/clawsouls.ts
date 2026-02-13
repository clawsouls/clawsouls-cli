#!/usr/bin/env node

import { Command } from 'commander';
import { createRequire } from 'node:module';
import { installCommand } from '../commands/install.js';
import { useCommand } from '../commands/use.js';
import { restoreCommand } from '../commands/restore.js';
import { listCommand } from '../commands/list.js';
import { publishCommand, loginCommand } from '../commands/publish.js';
import { initCommand } from '../commands/init.js';
import { validateCommand } from '../commands/validate.js';

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

program
  .command('publish <dir>')
  .description('Publish a soul package to the registry')
  .action(publishCommand);

program
  .command('login')
  .description('Get instructions for authenticating with the registry')
  .action(loginCommand);

program
  .command('init [name]')
  .description('Scaffold a new soul directory')
  .action((name?: string) => initCommand(name));

program
  .command('validate [dir]')
  .alias('check')
  .description('Validate a soul package against the spec')
  .option('-s, --spec <version>', 'Spec version to validate against (e.g., 0.1, 0.2). Default: latest')
  .action((dir?: string, options?: { spec?: string }) => validateCommand(dir, options));

program.parse();
