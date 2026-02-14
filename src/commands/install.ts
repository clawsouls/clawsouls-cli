import chalk from 'chalk';
import ora from 'ora';
import { RegistryClient } from '../registry/client.js';
import { StorageManager } from '../storage/manager.js';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { ensureDir } from '../utils/config.js';

/**
 * Parse a soul identifier. Supports:
 *   owner/name
 *   owner/name@version
 *   name (legacy, no owner)
 *   name@version (legacy)
 */
function parseSoulId(input: string): { owner?: string; name: string; version?: string } {
  const [nameWithOwner, version] = input.split('@');
  if (nameWithOwner.includes('/')) {
    const [owner, name] = nameWithOwner.split('/', 2);
    return { owner, name, version };
  }
  return { name: nameWithOwner, version };
}

export async function installCommand(nameWithVersion: string, options: { force?: boolean }): Promise<void> {
  const { owner, name, version } = parseSoulId(nameWithVersion);
  const fullName = owner ? `${owner}/${name}` : name;
  const spinner = ora(`Installing soul "${fullName}"...`).start();

  try {
    const storage = new StorageManager();
    const registry = new RegistryClient();

    // Use owner/name as storage key
    const storageKey = owner ? `${owner}/${name}` : name;

    if (storage.isInstalled(storageKey) && !options.force) {
      spinner.fail(`Soul "${fullName}" is already installed. Use ${chalk.yellow('--force')} to overwrite.`);
      process.exit(1);
    }

    spinner.text = `Fetching "${fullName}"${version ? `@${version}` : ''} metadata...`;
    const meta = await registry.getSoulMeta(name, owner, version);

    spinner.text = `Downloading "${fullName}" files...`;
    const fileList = await registry.getSoulFiles(name, owner, version);
    const files = new Map<string, string>();

    for (const filename of fileList) {
      try {
        const content = await registry.downloadFile(name, filename, owner, version);
        files.set(filename, content);
      } catch {
        // Skip missing optional files
      }
    }

    spinner.text = `Saving to local storage...`;
    const soulDir = storage.getSoulDir(storageKey);
    ensureDir(soulDir);

    for (const [filename, content] of files) {
      const filePath = join(soulDir, filename);
      ensureDir(join(filePath, '..'));
      writeFileSync(filePath, content, 'utf-8');
    }

    if (!files.has('clawsoul.json')) {
      const manifest = {
        name: meta.name || name,
        displayName: meta.displayName || name,
        version: meta.version || '1.0.0',
        description: meta.description || '',
        category: meta.category || '',
        tags: meta.tags || [],
        files: Object.fromEntries(
          [...files.keys()]
            .filter(f => f.endsWith('.md'))
            .map(f => {
              const key = f.replace('.md', '').toLowerCase();
              return [key, f];
            })
        ),
      };
      writeFileSync(join(soulDir, 'clawsoul.json'), JSON.stringify(manifest, null, 2), 'utf-8');
    }

    spinner.succeed(
      `Installed ${chalk.green(meta.displayName || name)} v${meta.version || '?'}\n` +
      `  ${chalk.dim(meta.description || '')}\n` +
      `  Run ${chalk.cyan(`clawsouls use ${storageKey}`)} to activate.`
    );
  } catch (err: any) {
    spinner.fail(err.message);
    process.exit(1);
  }
}
