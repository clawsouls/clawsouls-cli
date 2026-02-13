import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, basename } from 'path';

const API_BASE = 'https://clawsouls.ai/api/v1';

function getToken(): string | null {
  if (process.env.CLAWSOULS_TOKEN) return process.env.CLAWSOULS_TOKEN;
  try {
    const { getConfig } = require('../utils/config.js');
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
  return data.username || data.name;
}

export async function publishCommand(dir: string): Promise<void> {
  const soulDir = dir.startsWith('/') ? dir : join(process.cwd(), dir);

  if (!existsSync(soulDir) || !statSync(soulDir).isDirectory()) {
    console.error(`Error: "${dir}" is not a directory`);
    process.exit(1);
  }

  const manifestPath = join(soulDir, 'clawsoul.json');
  if (!existsSync(manifestPath)) {
    console.error(`Error: clawsoul.json not found in "${dir}"`);
    console.error('Run "clawsouls init" to create one, or add it manually.');
    process.exit(1);
  }

  let manifest: any;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
  } catch (err) {
    console.error('Error: Invalid clawsoul.json');
    process.exit(1);
  }

  if (!manifest.name) {
    console.error('Error: clawsoul.json must have a "name" field');
    process.exit(1);
  }

  const token = getToken();
  if (!token) {
    console.error('Error: Authentication required.');
    console.error('');
    console.error('Set your token via:');
    console.error('  export CLAWSOULS_TOKEN=<your-token>');
    console.error('');
    console.error('Get a token at: https://clawsouls.ai/api/v1/auth/token (requires login)');
    process.exit(1);
  }

  // Get the authenticated user's username for namespacing
  let owner: string;
  try {
    owner = await getUsername(token);
  } catch (err: any) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }

  // The soul name in manifest should be just the name (no owner prefix)
  const soulName = manifest.name.includes('/') ? manifest.name.split('/')[1] : manifest.name;
  manifest.name = soulName;

  // Read all files
  const files: Record<string, string> = {};
  const entries = readdirSync(soulDir);

  for (const entry of entries) {
    const fullPath = join(soulDir, entry);
    if (statSync(fullPath).isFile() && entry !== 'clawsoul.json') {
      try {
        files[entry] = readFileSync(fullPath, 'utf-8');
      } catch {}
    }
  }

  for (const entry of entries) {
    const fullPath = join(soulDir, entry);
    if (statSync(fullPath).isDirectory()) {
      const subEntries = readdirSync(fullPath);
      for (const subEntry of subEntries) {
        const subPath = join(fullPath, subEntry);
        if (statSync(subPath).isFile()) {
          try {
            files[`${entry}/${subEntry}`] = readFileSync(subPath, 'utf-8');
          } catch {}
        }
      }
    }
  }

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
      console.log(`  Warnings:`);
      for (const w of data.warnings) {
        console.log(`    ⚠️  ${w}`);
      }
    }
  } catch (err: any) {
    console.error(`Error: ${err.message || 'Network error'}`);
    process.exit(1);
  }
}

export async function loginCommand(): Promise<void> {
  console.log('To get your API token:');
  console.log('');
  console.log('  1. Log in at https://clawsouls.ai/auth/login');
  console.log('  2. Visit https://clawsouls.ai/api/v1/auth/token');
  console.log('  3. Copy the token and run:');
  console.log('');
  console.log('     export CLAWSOULS_TOKEN=<your-token>');
  console.log('');
  console.log('  Or save it permanently:');
  console.log('');
  console.log('     clawsouls config set auth.token <your-token>');
}
