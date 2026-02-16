import chalk from 'chalk';
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const API_BASE = 'https://clawsouls.ai/api/v1';

interface CheckResult {
  type: 'pass' | 'fail' | 'warn';
  message: string;
  details?: string[];
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

export async function validateCommand(dir?: string): Promise<void> {
  const soulDir = dir || '.';

  const soulJsonPath = join(soulDir, 'soul.json');
  const legacyPath = join(soulDir, 'clawsoul.json');
  const manifestPath = existsSync(soulJsonPath) ? soulJsonPath : legacyPath;

  console.log(chalk.bold(`\nValidating ${soulDir}/...\n`));

  if (!existsSync(manifestPath)) {
    console.log(chalk.red('❌ soul.json missing'));
    process.exit(1);
  }

  if (manifestPath === legacyPath) {
    console.log(chalk.yellow('⚠️  Using legacy clawsoul.json — rename to soul.json'));
  }

  let manifest: any;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
  } catch (err: any) {
    console.log(chalk.red(`❌ soul.json is not valid JSON: ${err.message}`));
    process.exit(1);
  }

  const files = collectFiles(soulDir);

  try {
    const res = await fetch(`${API_BASE}/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ manifest, files }),
    });

    const data = await res.json();
    printResults(data.checks || []);

    if (!data.valid) process.exit(1);
  } catch (err: any) {
    // Fallback: basic local check if server unreachable
    console.log(chalk.yellow('⚠️  Server unreachable, running basic local checks only'));
    console.log(chalk.green('✅ soul.json parsed successfully'));
    if (manifest.name) console.log(chalk.green(`✅ name: ${manifest.name}`));
    if (!manifest.specVersion) console.log(chalk.yellow('⚠️  specVersion missing'));
  }
}

function printResults(results: CheckResult[]): void {
  const icons = { pass: chalk.green('✅'), fail: chalk.red('❌'), warn: chalk.yellow('⚠️') };

  for (const r of results) {
    const icon = icons[r.type];
    const text = r.type === 'fail' ? chalk.red(r.message)
      : r.type === 'warn' ? chalk.yellow(r.message)
      : r.message;
    console.log(`${icon} ${text}`);
    if (r.details?.length) {
      for (const d of r.details) {
        console.log(r.type === 'fail' ? chalk.red(`   - ${d}`) : chalk.yellow(`   - ${d}`));
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
    console.log(chalk.green.bold('✓ Valid!') + chalk.dim(` ${passed} passed, ${warnings} warning${warnings !== 1 ? 's' : ''}`));
  } else {
    console.log(chalk.green.bold('✓ Soul is valid and ready to publish!') + chalk.dim(` (${passed} checks passed)`));
  }
}
