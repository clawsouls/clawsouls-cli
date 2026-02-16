import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { createInterface } from 'readline';

const API_BASE = 'https://clawsouls.ai/api/v1';

import { getConfig } from '../utils/config.js';

function getToken(): string | null {
  if (process.env.CLAWSOULS_TOKEN) return process.env.CLAWSOULS_TOKEN;
  try {
    const config = getConfig();
    if (config.auth?.token) return config.auth.token;
  } catch {}
  return null;
}

async function getUsername(token: string): Promise<string> {
  const res = await fetch(`${API_BASE}/auth/me`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to get user info. Is your token valid?');
  const data = await res.json();
  return data.user?.username || data.username || data.user?.name || data.name;
}

function askConfirmation(question: string): Promise<boolean> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

function collectFiles(soulDir: string): Record<string, string> {
  const files: Record<string, string> = {};
  const entries = readdirSync(soulDir);
  for (const entry of entries) {
    const fullPath = join(soulDir, entry);
    if (statSync(fullPath).isFile() && entry !== 'soul.json' && entry !== 'clawsoul.json') {
      try { files[entry] = readFileSync(fullPath, 'utf-8'); } catch {}
    }
  }
  for (const entry of entries) {
    const fullPath = join(soulDir, entry);
    if (statSync(fullPath).isDirectory()) {
      for (const sub of readdirSync(fullPath)) {
        const subPath = join(fullPath, sub);
        if (statSync(subPath).isFile()) {
          try { files[`${entry}/${sub}`] = readFileSync(subPath, 'utf-8'); } catch {}
        }
      }
    }
  }
  return files;
}

export async function publishCommand(dir: string, options?: { confirm?: boolean }): Promise<void> {
  const soulDir = dir.startsWith('/') ? dir : join(process.cwd(), dir);

  if (!existsSync(soulDir) || !statSync(soulDir).isDirectory()) {
    console.error(`Error: "${dir}" is not a directory`);
    process.exit(1);
  }

  const soulJsonPath = join(soulDir, 'soul.json');
  const legacyPath = join(soulDir, 'clawsoul.json');
  const manifestPath = existsSync(soulJsonPath) ? soulJsonPath : legacyPath;
  if (!existsSync(manifestPath)) {
    console.error('Error: soul.json not found. Run "clawsouls init" to create one.');
    process.exit(1);
  }
  if (manifestPath === legacyPath) {
    console.warn('⚠️  Using legacy clawsoul.json — please rename to soul.json');
  }

  let manifest: any;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
  } catch {
    console.error('Error: Invalid soul.json');
    process.exit(1);
  }

  const token = getToken();
  if (!token) {
    console.error('Error: Authentication required.\n');
    console.error('Log in with your API token:');
    console.error('  clawsouls login <token>\n');
    console.error('Get a token at: https://clawsouls.ai/dashboard');
    process.exit(1);
  }

  let owner: string;
  try {
    owner = await getUsername(token);
  } catch (err: any) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }

  if (!options?.confirm) {
    const confirmed = await askConfirmation(
      'Do you confirm this is your original work or you have the rights to distribute it? (y/N) '
    );
    if (!confirmed) {
      console.error('Publish cancelled.');
      process.exit(1);
    }
  }

  const soulName = manifest.name.includes('/') ? manifest.name.split('/')[1] : manifest.name;
  manifest.name = soulName;

  const files = collectFiles(soulDir);
  const fileCount = Object.keys(files).length;
  console.log(`Publishing ${owner}/${soulName}@${manifest.version || '0.1.0'}...`);
  console.log(`  ${fileCount} files`);

  try {
    const res = await fetch(`${API_BASE}/souls/${owner}/${soulName}/publish`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ manifest, files }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error(`Error: ${data.error || 'Publish failed'}`);
      if (data.details) {
        for (const detail of Array.isArray(data.details) ? data.details : [data.details]) {
          console.error(`  - ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`);
        }
      }
      process.exit(1);
    }

    console.log(`\n✅ Published successfully!`);
    console.log(`  URL: ${data.url}`);
    if (data.warnings?.length) {
      for (const w of data.warnings) console.log(`    ⚠️  ${w}`);
    }
  } catch (err: any) {
    console.error(`Error: ${err.message || 'Network error'}`);
    process.exit(1);
  }
}
