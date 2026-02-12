import chalk from 'chalk';
import ora from 'ora';
import { RegistryClient } from '../registry/client.js';
import { StorageManager } from '../storage/manager.js';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { ensureDir } from '../utils/config.js';

export async function installCommand(nameWithVersion: string, options: { force?: boolean }): Promise<void> {
  const [name, version] = nameWithVersion.split('@');
  const spinner = ora(`Installing soul "${name}"...`).start();

  try {
    const storage = new StorageManager();
    const registry = new RegistryClient();

    // Check if already installed
    if (storage.isInstalled(name) && !options.force) {
      spinner.fail(`Soul "${name}" is already installed. Use ${chalk.yellow('--force')} to overwrite.`);
      process.exit(1);
    }

    // Fetch metadata
    spinner.text = `Fetching "${name}" metadata...`;
    const meta = await registry.getSoulMeta(name);

    // Get file list and download each
    spinner.text = `Downloading "${name}" files...`;
    const fileList = await registry.getSoulFiles(name);
    const files = new Map<string, string>();

    for (const filename of fileList) {
      try {
        const content = await registry.downloadFile(name, filename);
        files.set(filename, content);
      } catch {
        // Skip missing optional files
      }
    }

    // Save to souls directory
    spinner.text = `Saving to local storage...`;
    const soulDir = storage.getSoulDir(name);
    ensureDir(soulDir);

    for (const [filename, content] of files) {
      const filePath = join(soulDir, filename);
      ensureDir(join(filePath, '..'));
      writeFileSync(filePath, content, 'utf-8');
    }

    spinner.succeed(
      `Installed ${chalk.green(meta.displayName || name)} v${meta.version || '?'}\n` +
      `  ${chalk.dim(meta.description || '')}\n` +
      `  Run ${chalk.cyan(`clawsouls use ${name}`)} to activate.`
    );
  } catch (err: any) {
    spinner.fail(err.message);
    process.exit(1);
  }
}
