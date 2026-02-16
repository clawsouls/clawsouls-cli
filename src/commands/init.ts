import chalk from 'chalk';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const API_BASE = 'https://clawsouls.ai/api/v1';

// Minimal fallback template if server is unreachable
const FALLBACK_FILES: Record<string, string> = {
  'soul.json': JSON.stringify({
    specVersion: '0.3',
    name: 'my-soul',
    displayName: 'My Soul',
    version: '1.0.0',
    description: 'A custom AI persona',
    author: { name: 'Your Name', github: 'your-github' },
    license: 'Apache-2.0',
    tags: ['custom'],
    category: 'general',
    files: { soul: 'SOUL.md', identity: 'IDENTITY.md', agents: 'AGENTS.md', heartbeat: 'HEARTBEAT.md' },
  }, null, 2),
  'SOUL.md': '# My Soul\n\nDescribe your AI persona here.\n',
  'IDENTITY.md': '# My Soul\n\n- **Name:** My Soul\n- **Emoji:** 🤖\n',
  'AGENTS.md': '# Workflow\n\n## Rules\n- Be helpful\n',
  'HEARTBEAT.md': '# Heartbeat\n',
  'README.md': '# My Soul\n\nA custom AI persona for OpenClaw.\n',
};

export async function initCommand(name?: string): Promise<void> {
  const soulName = name || 'my-soul';
  const dir = join(process.cwd(), soulName);

  if (existsSync(dir)) {
    console.error(chalk.red(`Directory already exists: ${soulName}/`));
    process.exit(1);
  }

  // Fetch template from server
  let files: Record<string, string>;
  try {
    const res = await fetch(`${API_BASE}/template?spec=0.3`);
    if (res.ok) {
      const data = await res.json();
      files = data.files;
    } else {
      files = FALLBACK_FILES;
    }
  } catch {
    files = FALLBACK_FILES;
  }

  mkdirSync(dir, { recursive: true });

  // Replace placeholder name
  for (const [filename, content] of Object.entries(files)) {
    let processed = content;
    if (filename === 'soul.json') {
      try {
        const manifest = JSON.parse(content);
        manifest.name = soulName;
        manifest.displayName = soulName.split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        processed = JSON.stringify(manifest, null, 2);
      } catch {
        processed = content.replace(/"name":\s*"my-soul"/, `"name": "${soulName}"`);
      }
    }
    writeFileSync(join(dir, filename), processed, 'utf-8');
  }

  console.log(chalk.green(`\n✓ Created soul scaffold: ${soulName}/\n`));
  console.log(`  Files:`);
  for (const filename of Object.keys(files)) {
    console.log(chalk.dim(`    ${filename}`));
  }
  console.log(`\n  Next steps:`);
  console.log(chalk.cyan(`    cd ${soulName}`));
  console.log(chalk.cyan(`    # Edit SOUL.md and other files`));
  console.log(chalk.cyan(`    clawsouls validate .`));
  console.log(chalk.cyan(`    clawsouls publish .`));
}
