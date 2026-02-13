import chalk from 'chalk';
import ora from 'ora';
import { StorageManager } from '../storage/manager.js';

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

    spinner.succeed(
      `Switched to ${chalk.green(name)}\n` +
      `  ${chalk.dim('Backup saved. Use')} ${chalk.cyan('clawsouls restore')} ${chalk.dim('to revert.')}\n` +
      `  ${chalk.yellow('⚠')}  Run ${chalk.cyan('openclaw gateway restart')} to apply the new persona.`
    );
  } catch (err: any) {
    spinner.fail(err.message);
    process.exit(1);
  }
}
