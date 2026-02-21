#!/usr/bin/env node

import { Command } from 'commander';
import { createRequire } from 'node:module';
import { installCommand } from '../commands/install.js';
import { useCommand } from '../commands/use.js';
import { restoreCommand } from '../commands/restore.js';
import { listCommand } from '../commands/list.js';
import { publishCommand } from '../commands/publish.js';
import { loginCommand, logoutCommand, whoamiCommand } from '../commands/login.js';
import { initCommand } from '../commands/init.js';
import { validateCommand } from '../commands/validate.js';
import { soulscanCommand } from '../commands/soulscan.js';
import { platformCommand } from '../commands/platform.js';
import { exportCommand } from '../commands/export.js';

const require = createRequire(import.meta.url);
const { version } = require('../../package.json');

const program = new Command();

program
  .name('clawsouls')
  .description('AI agent persona manager — works with any SOUL.md-compatible agent')
  .version(version)
  .option('--platform <name>', 'Override agent platform (openclaw, zeroclaw, clawdbot, moltbot, moldbot, or a path)')
  .option('--workspace <path>', 'Override workspace directory')
  .hook('preAction', (thisCommand) => {
    const opts = thisCommand.opts();
    if (opts.platform) {
      process.env.CLAWSOULS_PLATFORM = opts.platform;
    }
  });

program
  .command('install <name>')
  .description('Install a soul from the registry')
  .option('-f, --force', 'Overwrite if already installed')
  .action(installCommand);

program
  .command('use <name>')
  .description('Activate an installed soul (backs up current workspace)')
  .action((name: string) => {
    const globalOpts = program.opts();
    useCommand(name, { workspace: globalOpts.workspace });
  });

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
  .option('--confirm', 'Skip interactive confirmation prompt')
  .action((dir: string, opts: { confirm?: boolean }) => publishCommand(dir, opts));

program
  .command('login <token>')
  .description('Save API token for registry authentication')
  .action(loginCommand);

program
  .command('logout')
  .description('Remove saved API token')
  .action(logoutCommand);

program
  .command('whoami')
  .description('Show the currently authenticated user')
  .action(whoamiCommand);

program
  .command('init [name]')
  .description('Scaffold a new soul directory')
  .action((name?: string) => initCommand(name));

program
  .command('validate [dir]')
  .alias('check')
  .description('Validate a soul package against the spec')
  .option('--soulscan', 'Include SoulScan security & quality analysis')
  .action((dir?: string, opts?: { soulscan?: boolean }) => validateCommand(dir, opts));

program
  .command('soulscan [dir]')
  .alias('scan')
  .description('Run SoulScan on active workspace or a soul directory')
  .option('-q, --quiet', 'Quiet mode for cron (outputs SOULSCAN_OK or SOULSCAN_ALERT)')
  .option('--init', 'Initialize baseline checksums without alerting on changes')
  .option('--restore', 'Auto-restore protected files when drift is detected')
  .option('--approve', 'Update baselines after intentional changes')
  .option('--report', 'Output a formatted audit report (for DM/cron)')
  .option('--verify-audit', 'Verify the audit log hash chain integrity')
  .option('--audit-log', 'Display recent audit log entries')
  .action((dir?: string, opts?: { quiet?: boolean; init?: boolean; restore?: boolean; approve?: boolean; report?: boolean; verifyAudit?: boolean; auditLog?: boolean }) => soulscanCommand(dir, opts));

program
  .command('export <format>')
  .description('Export soul to another format (claude-md, system-prompt)')
  .option('-o, --output <path>', 'Output file path')
  .option('-d, --dir <path>', 'Source soul directory (default: active workspace)')
  .action((format: string, opts: { output?: string; dir?: string }) => exportCommand(format, opts));

program
  .command('platform')
  .alias('detect')
  .description('Show detected agent platform(s) and workspace path')
  .action(platformCommand);

program.parse();
