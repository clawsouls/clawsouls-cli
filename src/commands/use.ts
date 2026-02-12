import chalk from 'chalk';
import { LocalStorage } from '../storage/local.js';

export async function useCommand(name: string): Promise<void> {
  const storage = new LocalStorage();

  // 설치 확인
  if (!storage.isInstalled(name)) {
    console.log(chalk.red(`Soul "${name}" is not installed.`));
    console.log(`  Run: ${chalk.cyan(`clawsouls install ${name}`)}`);
    return;
  }

  // 1. 백업
  console.log(chalk.gray('Backing up current workspace...'));
  const backupId = storage.backupWorkspace();
  console.log(chalk.gray(`  Backup saved: ${backupId}`));

  // 2. 적용
  storage.applySoul(name);

  console.log();
  console.log(chalk.green(`✅ Soul "${name}" applied to workspace.`));
  console.log();
  console.log(chalk.yellow('💡 Tip: Start a new session for full persona effect.'));
  console.log(`  ${chalk.cyan('To restore:')} clawsouls restore`);
  console.log();
}
