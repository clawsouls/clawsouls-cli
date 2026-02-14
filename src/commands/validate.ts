import chalk from 'chalk';
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { getSchema, LATEST_SPEC, SPEC_VERSIONS } from '../utils/validate.js';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

interface CheckResult {
  type: 'pass' | 'fail' | 'warn';
  message: string;
  details?: string[];
}

export async function validateCommand(dir?: string, options?: { spec?: string }): Promise<void> {
  const soulDir = dir || '.';
  const manifestPath = join(soulDir, 'clawsoul.json');
  const specVersion = options?.spec || LATEST_SPEC;

  const results: CheckResult[] = [];
  const add = (type: CheckResult['type'], message: string, details?: string[]) => {
    results.push({ type, message, details });
  };

  console.log(chalk.bold(`\nValidating ${soulDir}/...`) + chalk.dim(` (spec v${specVersion})\n`));

  // 1. Check clawsoul.json exists
  if (!existsSync(manifestPath)) {
    add('fail', 'clawsoul.json missing');
    printResults(results);
    process.exit(1);
  }
  add('pass', 'clawsoul.json found');

  // 2. Parse JSON
  let raw: any;
  try {
    raw = JSON.parse(readFileSync(manifestPath, 'utf-8'));
  } catch (err: any) {
    const msg = err.message || 'unknown parse error';
    // Try to extract line/position info
    const posMatch = msg.match(/position (\d+)/);
    const detail = posMatch
      ? `Parse error at byte ${posMatch[1]}: ${msg}`
      : `Parse error: ${msg}`;
    add('fail', 'clawsoul.json is not valid JSON', [detail]);
    printResults(results);
    process.exit(1);
  }

  // 3. Validate against schema
  let schema;
  try {
    schema = getSchema(specVersion);
  } catch (err: any) {
    const available = Object.keys(SPEC_VERSIONS).join(', ');
    add('fail', err.message, [`Available versions: ${available}`]);
    printResults(results);
    process.exit(1);
  }

  const parsed = schema.safeParse(raw);
  if (parsed.success) {
    add('pass', `clawsoul.json schema valid (spec v${specVersion})`);
  } else {
    const details: string[] = [];
    for (const issue of (parsed as any).error.issues) {
      const path = issue.path.length > 0 ? `"${issue.path.join('.')}"` : '(root)';
      let expected = '';
      if (issue.code === 'invalid_type') {
        expected = ` (expected: ${issue.expected}, got: ${issue.received})`;
      } else if (issue.code === 'invalid_string' && issue.validation) {
        expected = ` (expected: ${issue.validation})`;
      } else if (issue.code === 'invalid_enum_value' && issue.options) {
        expected = ` (expected one of: ${issue.options.join(', ')})`;
      } else if (issue.code === 'too_big') {
        expected = ` (max: ${issue.maximum})`;
      } else if (issue.code === 'too_small') {
        expected = ` (min: ${issue.minimum})`;
      }

      // Friendly hints for common required fields
      let hint = '';
      const fieldPath = issue.path.join('.');
      const hints: Record<string, string> = {
        'author': 'object with "name" field',
        'license': 'string, e.g. "Apache-2.0"',
        'name': 'kebab-case string, e.g. "my-soul"',
        'displayName': 'human-readable name string',
        'version': 'semver string, e.g. "1.0.0"',
        'description': 'string, max 160 chars',
        'tags': 'array of strings, max 10',
        'category': 'string',
        'files': 'object with "soul" field',
        'files.soul': 'path to SOUL.md',
      };

      if (issue.code === 'invalid_type' && issue.received === 'undefined') {
        const friendlyExpected = hints[fieldPath] || issue.expected;
        details.push(`${path} is required (expected: ${friendlyExpected})`);
      } else if (issue.code === 'invalid_string') {
        const actual = raw;
        const val = issue.path.reduce((o: any, k: string | number) => o?.[k], raw);
        const valStr = val !== undefined ? ` (got: ${JSON.stringify(val)})` : '';
        details.push(`${path}: ${issue.message}${valStr}`);
      } else {
        const friendlyHint = hints[fieldPath] ? ` (expected: ${hints[fieldPath]})` : expected;
        details.push(`${path}: ${issue.message}${friendlyHint}`);
      }
    }
    add('fail', 'clawsoul.json schema', details);
  }

  // 4. Check required files
  const files = raw.files || {};
  const requiredFiles: [string, string][] = [
    ['soul', 'SOUL.md'],
  ];
  const optionalFiles: [string, string, string][] = [
    ['identity', 'IDENTITY.md', 'recommended for personality definition'],
    ['agents', 'AGENTS.md', 'recommended for agent workflows'],
    ['heartbeat', 'HEARTBEAT.md', 'optional'],
    ['style', 'STYLE.md', 'optional but recommended'],
  ];

  for (const [key, defaultName] of requiredFiles) {
    const filename = files[key] || defaultName;
    const filePath = join(soulDir, filename);
    if (existsSync(filePath)) {
      const size = statSync(filePath).size;
      add('pass', `${filename} found (${formatBytes(size)})`);
    } else {
      add('fail', `${filename} missing`);
    }
  }

  for (const [key, defaultName, hint] of optionalFiles) {
    const filename = files[key] || defaultName;
    const filePath = join(soulDir, filename);
    if (existsSync(filePath)) {
      const size = statSync(filePath).size;
      add('pass', `${filename} found (${formatBytes(size)})`);
    } else {
      add('warn', `${filename} missing (${hint})`);
    }
  }

  // 5. README.md
  const readmePath = join(soulDir, 'README.md');
  if (existsSync(readmePath)) {
    const size = statSync(readmePath).size;
    add('pass', `README.md found (${formatBytes(size)})`);
  } else {
    add('warn', 'README.md missing (recommended)');
  }

  // 6. Content quality checks
  const soulFile = files.soul || 'SOUL.md';
  const soulPath = join(soulDir, soulFile);
  if (existsSync(soulPath)) {
    const content = readFileSync(soulPath, 'utf-8');
    if (content.length < 10) {
      add('warn', `${soulFile} is very short (${content.length} chars — consider expanding)`);
    }
  }

  // 7. Security scan
  let allFiles: string[];
  try {
    allFiles = readdirSync(soulDir, { recursive: true }) as string[];
  } catch {
    allFiles = [];
  }

  const dangerousExts = ['.exe', '.dll', '.so', '.dylib', '.sh', '.bat', '.cmd'];
  const dangerousPatterns = ['eval(', 'exec(', 'Function(', 'require(', 'import('];
  const securityIssues: string[] = [];

  for (const file of allFiles) {
    const filePath = String(file);
    // skip node_modules, .git
    if (filePath.startsWith('node_modules') || filePath.startsWith('.git')) continue;
    const ext = filePath.substring(filePath.lastIndexOf('.'));
    if (dangerousExts.includes(ext)) {
      securityIssues.push(`Dangerous file extension: ${filePath}`);
    }
  }

  for (const file of allFiles) {
    const filePath = String(file);
    if (filePath.startsWith('node_modules') || filePath.startsWith('.git')) continue;
    const fullPath = join(soulDir, filePath);
    try {
      const stat = statSync(fullPath);
      if (stat.isDirectory() || stat.size > 1024 * 1024) continue; // skip dirs and large files
      const content = readFileSync(fullPath, 'utf-8');
      for (const pattern of dangerousPatterns) {
        if (content.includes(pattern)) {
          // Find line number
          const lines = content.split('\n');
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes(pattern)) {
              securityIssues.push(`"${pattern}" found in ${filePath}:${i + 1}`);
            }
          }
        }
      }
    } catch {
      // Binary file or unreadable, skip
    }
  }

  if (securityIssues.length > 0) {
    add('fail', 'Security scan', securityIssues);
  } else {
    add('pass', 'Security scan passed');
  }

  // 8. Field-specific warnings
  if (raw.name && raw.name.length > 40) add('warn', 'Name is very long (> 40 chars)');
  if (raw.description && raw.description.length < 10) add('warn', 'Description is very short (< 10 chars)');
  if (raw.tags && raw.tags.length === 0) add('warn', 'No tags defined');

  printResults(results);

  const errors = results.filter(r => r.type === 'fail').length;
  if (errors > 0) process.exit(1);
}

function printResults(results: CheckResult[]): void {
  const icons = {
    pass: chalk.green('✅'),
    fail: chalk.red('❌'),
    warn: chalk.yellow('⚠️'),
  };

  for (const r of results) {
    const icon = icons[r.type];
    const text = r.type === 'fail' ? chalk.red(r.message)
      : r.type === 'warn' ? chalk.yellow(r.message)
      : r.message;
    console.log(`${icon} ${text}`);
    if (r.details && r.details.length > 0) {
      for (const d of r.details) {
        const detailColor = r.type === 'fail' ? chalk.red : chalk.yellow;
        console.log(detailColor(`   - ${d}`));
      }
    }
  }

  const passed = results.filter(r => r.type === 'pass').length;
  const failed = results.filter(r => r.type === 'fail').length;
  const warnings = results.filter(r => r.type === 'warn').length;

  console.log('');
  if (failed > 0) {
    console.log(chalk.red.bold(`Result: ${failed} error${failed !== 1 ? 's' : ''}, ${warnings} warning${warnings !== 1 ? 's' : ''} — fix errors before publishing`));
  } else if (warnings > 0) {
    console.log(chalk.green.bold(`✓ Valid!`) + chalk.dim(` ${passed} passed, ${warnings} warning${warnings !== 1 ? 's' : ''}`));
  } else {
    console.log(chalk.green.bold(`✓ Soul is valid and ready to publish!`) + chalk.dim(` (${passed} checks passed)`));
  }
}
