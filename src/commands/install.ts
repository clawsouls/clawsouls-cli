import chalk from 'chalk';
import ora from 'ora';
import { RegistryClient } from '../registry/client.js';
import { LocalStorage } from '../storage/local.js';

export async function installCommand(name: string, options: { force?: boolean }): Promise<void> {
  const registry = new RegistryClient();
  const storage = new LocalStorage();

  // 이미 설치 확인
  if (storage.isInstalled(name) && !options.force) {
    console.log(chalk.yellow(`Soul "${name}" is already installed. Use --force to overwrite.`));
    return;
  }

  const spinner = ora(`Installing soul "${name}"...`).start();

  try {
    // 1. 메타데이터 가져오기
    spinner.text = `Fetching metadata for "${name}"...`;
    const meta = await registry.getSoulMeta(name);

    // 2. 파일 목록 가져오기
    spinner.text = `Downloading files...`;
    const files = await registry.getSoulFiles(name);

    // 3. 각 파일 다운로드 & 저장
    let downloaded = 0;
    for (const file of files) {
      try {
        const content = await registry.downloadFile(name, file);
        storage.saveSoulFile(name, file, content);
        downloaded++;
      } catch {
        // README.md 등 선택 파일은 스킵
        if (file === 'clawsoul.json' || file === 'SOUL.md') {
          throw new Error(`Required file "${file}" not found`);
        }
      }
    }

    spinner.succeed(
      chalk.green(`Installed ${meta.displayName || name} v${meta.version}`) +
      chalk.gray(` (${downloaded} files)`)
    );

    console.log();
    console.log(`  ${chalk.cyan('To apply:')}  clawsouls use ${name}`);
    console.log(`  ${chalk.cyan('To list:')}   clawsouls list`);
    console.log();
  } catch (err: any) {
    spinner.fail(chalk.red(`Failed to install "${name}"`));
    console.error(chalk.red(`  ${err.message}`));
    process.exit(1);
  }
}
