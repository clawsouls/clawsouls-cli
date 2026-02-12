import chalk from 'chalk';
import { LocalStorage } from '../storage/local.js';

export async function restoreCommand(): Promise<void> {
  const storage = new LocalStorage();

  const backupId = storage.restoreFromBackup();

  if (!backupId) {
    console.log(chalk.yellow('No backup found. Nothing to restore.'));
    return;
  }

  console.log();
  console.log(chalk.green(`✅ Workspace restored from backup: ${backupId}`));
  console.log();
  console.log(chalk.yellow('💡 Tip: Start a new session for full effect.'));
  console.log();
}
