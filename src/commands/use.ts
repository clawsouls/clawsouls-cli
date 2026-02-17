import chalk from 'chalk';
import ora from 'ora';
import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { StorageManager } from '../storage/manager.js';

function getRestartCommand(): string {
  const platform = process.env.CLAWSOULS_PLATFORM;
  if (platform === 'zeroclaw') return 'zeroclaw gateway restart';
  if (platform === 'openclaw') return 'openclaw gateway restart';

  // Auto-detect
  const hasZeroClaw = existsSync(join(homedir(), '.zeroclaw'));
  const hasOpenClaw = existsSync(join(homedir(), '.openclaw'));
  if (hasZeroClaw && !hasOpenClaw) return 'zeroclaw gateway restart';
  return 'openclaw gateway restart';
}

export async function useCommand(name: string): Promise<void> {
  const spinner = ora(`Switching to soul "${name}"...`).start();

  try {
    const storage = new StorageManager();

    if (!storage.isInstalled(name)) {
      spinner.fail(
        `Soul "${name}" is not installed.\n` +
        `  Run ${chalk.cyan(`clawsouls install ${name}`)} first.`
      );
      process.exit(1);
    }

    // Backup current workspace
    spinner.text = 'Backing up current workspace...';
    const backupPath = storage.backupWorkspace();

    // Apply soul
    spinner.text = `Applying "${name}"...`;
    storage.applySoul(name);

    const restartCmd = getRestartCommand();
    spinner.succeed(
      `Switched to ${chalk.green(name)}\n` +
      `  ${chalk.dim('Backup saved. Use')} ${chalk.cyan('clawsouls restore')} ${chalk.dim('to revert.')}\n` +
      `  ${chalk.yellow('⚠')}  Run ${chalk.cyan(restartCmd)} to apply the new persona.`
    );
  } catch (err: any) {
    spinner.fail(err.message);
    process.exit(1);
  }
}
