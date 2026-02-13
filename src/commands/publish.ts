import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, basename } from 'path';

const API_BASE = 'https://clawsouls.ai/api/v1';

function getToken(): string | null {
  // 1. Environment variable
  if (process.env.CLAWSOULS_TOKEN) return process.env.CLAWSOULS_TOKEN;

  // 2. Config file
  try {
    const { getConfig } = require('../utils/config.js');
    const config = getConfig();
    if (config.auth?.token) return config.auth.token;
  } catch {}

  return null;
}

export async function publishCommand(dir: string): Promise<void> {
  const soulDir = dir.startsWith('/') ? dir : join(process.cwd(), dir);

  // Validate directory exists
  if (!existsSync(soulDir) || !statSync(soulDir).isDirectory()) {
    console.error(`Error: "${dir}" is not a directory`);
    process.exit(1);
  }

  // Read clawsoul.json
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

  // Get auth token
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

  // Read all files
  const files: Record<string, string> = {};
  const entries = readdirSync(soulDir);

  for (const entry of entries) {
    const fullPath = join(soulDir, entry);
    if (statSync(fullPath).isFile() && entry !== 'clawsoul.json') {
      try {
        files[entry] = readFileSync(fullPath, 'utf-8');
      } catch {
        // Skip binary files
      }
    }
  }

  // Also read files from subdirectories (e.g., examples/)
  for (const entry of entries) {
    const fullPath = join(soulDir, entry);
    if (statSync(fullPath).isDirectory()) {
      const subEntries = readdirSync(fullPath);
      for (const subEntry of subEntries) {
        const subPath = join(fullPath, subEntry);
        if (statSync(subPath).isFile()) {
          try {
            files[`${entry}/${subEntry}`] = readFileSync(subPath, 'utf-8');
          } catch {
            // Skip binary files
          }
        }
      }
    }
  }

  const fileCount = Object.keys(files).length;
  console.log(`Publishing ${manifest.name}@${manifest.version || '0.1.0'}...`);
  console.log(`  ${fileCount} files`);

  // Call publish API
  try {
    const res = await fetch(`${API_BASE}/souls/${manifest.name}/publish`, {
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
