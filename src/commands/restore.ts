import chalk from 'chalk';
import ora from 'ora';
import { StorageManager } from '../storage/manager.js';

export async function restoreCommand(): Promise<void> {
  const spinner = ora('Restoring previous soul...').start();

  try {
    const storage = new StorageManager();
    const restored = storage.restore();

    if (!restored) {
      spinner.fail('No backups found. Nothing to restore.');
      process.exit(1);
    }

    spinner.succeed(
      `Restored from backup ${chalk.dim(restored)}\n` +
      `  ${chalk.yellow('⚠')}  Run ${chalk.cyan('openclaw gateway restart')} to apply the new persona.`
    );
  } catch (err: any) {
    spinner.fail(err.message);
    process.exit(1);
  }
}
