import chalk from 'chalk';
import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { ClawSoulSchema } from '../utils/validate.js';

export async function validateCommand(dir?: string): Promise<void> {
  const soulDir = dir || '.';
  const manifestPath = join(soulDir, 'clawsoul.json');

  console.log(chalk.bold(`Validating soul in ${soulDir}/\n`));

  let hasError = false;
  const pass = (msg: string) => console.log(chalk.green('  ✓ ') + msg);
  const fail = (msg: string) => { console.log(chalk.red('  ✗ ') + msg); hasError = true; };
  const warn = (msg: string) => console.log(chalk.yellow('  ⚠ ') + msg);

  // 1. Check clawsoul.json exists
  if (!existsSync(manifestPath)) {
    fail('clawsoul.json not found');
    process.exit(1);
  }
  pass('clawsoul.json exists');

  // 2. Parse JSON
  let raw: any;
  try {
    raw = JSON.parse(readFileSync(manifestPath, 'utf-8'));
    pass('clawsoul.json is valid JSON');
  } catch (err: any) {
    fail(`clawsoul.json parse error: ${err.message}`);
    process.exit(1);
  }

  // 3. Validate against schema
  const result = ClawSoulSchema.safeParse(raw);
  if (result.success) {
    pass('Schema validation passed');
  } else {
    for (const issue of result.error.issues) {
      fail(`${issue.path.join('.')}: ${issue.message}`);
    }
  }

  // 4. Check required files exist
  const files = raw.files || {};
  const requiredFiles: [string, string][] = [
    ['soul', 'SOUL.md'],
  ];
  const optionalFiles: [string, string][] = [
    ['identity', 'IDENTITY.md'],
    ['agents', 'AGENTS.md'],
    ['heartbeat', 'HEARTBEAT.md'],
    ['style', 'STYLE.md'],
  ];

  for (const [key, defaultName] of requiredFiles) {
    const filename = files[key] || defaultName;
    if (existsSync(join(soulDir, filename))) {
      pass(`${filename} exists`);
    } else {
      fail(`${filename} missing (required)`);
    }
  }

  for (const [key, defaultName] of optionalFiles) {
    const filename = files[key] || defaultName;
    if (existsSync(join(soulDir, filename))) {
      pass(`${filename} exists`);
    } else {
      warn(`${filename} not found (optional)`);
    }
  }

  // 5. Check README.md
  if (existsSync(join(soulDir, 'README.md'))) {
    pass('README.md exists');
  } else {
    warn('README.md not found (recommended)');
  }

  // 6. Content checks
  if (files.soul) {
    const soulContent = readFileSync(join(soulDir, files.soul), 'utf-8');
    if (soulContent.length < 10) {
      warn('SOUL.md is very short (< 10 chars)');
    } else {
      pass(`SOUL.md has content (${soulContent.length} chars)`);
    }
  }

  // 7. Security scan
  const allFiles = readdirSync(soulDir, { recursive: true }) as string[];
  const dangerousExts = ['.exe', '.dll', '.so', '.dylib', '.sh', '.bat', '.cmd'];
  const dangerousPatterns = ['eval(', 'exec(', 'Function(', 'require(', 'import('];

  for (const file of allFiles) {
    const filePath = String(file);
    const ext = filePath.substring(filePath.lastIndexOf('.'));
    if (dangerousExts.includes(ext)) {
      fail(`Dangerous file extension: ${filePath}`);
    }
  }

  // Check text files for dangerous patterns
  for (const file of allFiles) {
    const filePath = join(soulDir, String(file));
    try {
      const content = readFileSync(filePath, 'utf-8');
      for (const pattern of dangerousPatterns) {
        if (content.includes(pattern)) {
          fail(`Dangerous pattern "${pattern}" in ${file}`);
        }
      }
    } catch {
      // Binary file, skip
    }
  }

  // 8. Field-specific warnings
  if (raw.name) {
    if (raw.name.length > 40) warn('Name is very long (> 40 chars)');
  }
  if (raw.description) {
    if (raw.description.length < 10) warn('Description is very short');
  }
  if (raw.tags && raw.tags.length === 0) warn('No tags defined');

  // Summary
  console.log('');
  if (hasError) {
    console.log(chalk.red.bold('✗ Validation failed — fix errors above before publishing.'));
    process.exit(1);
  } else {
    console.log(chalk.green.bold('✓ Soul is valid and ready to publish!'));
  }
}
