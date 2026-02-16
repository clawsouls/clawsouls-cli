import chalk from 'chalk';
import ora from 'ora';
import { StorageManager } from '../storage/manager.js';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { ensureDir } from '../utils/config.js';

const API_BASE = 'https://clawsouls.ai/api/v1';

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
    const storageKey = owner ? `${owner}/${name}` : name;

    if (storage.isInstalled(storageKey) && !options.force) {
      spinner.fail(`Soul "${fullName}" is already installed. Use ${chalk.yellow('--force')} to overwrite.`);
      process.exit(1);
    }

    spinner.text = `Downloading "${fullName}"${version ? `@${version}` : ''}...`;

    // Use bundle API — single request for all files
    const bundleOwner = owner || 'clawsouls';
    const vq = version ? `?version=${version}` : '';
    const res = await fetch(`${API_BASE}/bundle/${bundleOwner}/${name}${vq}`);

    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: 'Unknown error' }));
      if (res.status === 404) {
        throw new Error(`Soul "${fullName}" not found`);
      }
      throw new Error(data.error || `Server error: ${res.status}`);
    }

    const bundle = await res.json();

    spinner.text = `Saving to local storage...`;
    const soulDir = storage.getSoulDir(storageKey);
    ensureDir(soulDir);

    for (const [filename, content] of Object.entries(bundle.files)) {
      if (typeof content !== 'string') continue;
      const filePath = join(soulDir, filename);
      ensureDir(join(filePath, '..'));
      writeFileSync(filePath, content, 'utf-8');
    }

    const displayName = bundle.manifest?.displayName || name;
    const ver = bundle.version || bundle.manifest?.version || '?';

    spinner.succeed(
      `Installed ${chalk.green(displayName)} v${ver}\n` +
      `  ${chalk.dim(bundle.manifest?.description || '')}\n` +
      `  Run ${chalk.cyan(`clawsouls use ${storageKey}`)} to activate.`
    );
  } catch (err: any) {
    spinner.fail(err.message);
    process.exit(1);
  }
}
