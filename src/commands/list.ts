import chalk from 'chalk';
import { StorageManager } from '../storage/manager.js';

export async function listCommand(): Promise<void> {
  const storage = new StorageManager();
  const souls = storage.listInstalled();

  if (souls.length === 0) {
    console.log(chalk.dim('No souls installed.'));
    console.log(`  Run ${chalk.cyan('clawsouls install owner/name')} to get started.`);
    return;
  }

  console.log(chalk.bold(`\n  Installed Souls (${souls.length})\n`));

  for (const soul of souls) {
    console.log(
      `  ${chalk.green(soul.displayName)} ${chalk.dim(`(${soul.name})`)} ${chalk.dim(`v${soul.version}`)}` +
      `  ${chalk.yellow(soul.category)}`
    );
    if (soul.description) {
      console.log(`    ${chalk.dim(soul.description)}`);
    }
  }
  console.log();
}
