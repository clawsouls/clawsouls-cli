import chalk from 'chalk';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';
import { createHash } from 'crypto';
import { homedir } from 'os';

const API_BASE = 'https://clawsouls.ai/api/v1';
const SOULSCAN_DIR = join(homedir(), '.clawsouls', 'soulscan');
const CHECKSUMS_FILE = join(SOULSCAN_DIR, 'checksums.json');

interface ScanIssue {
  code: string;
  message: string;
  file?: string;
  severity: 'error' | 'warning' | 'info';
}

interface ScanResult {
  ok: boolean;
  status: string;
  score: number;
  grade: string;
  scannerVersion: string;
  errors: ScanIssue[];
  warnings: ScanIssue[];
  info: ScanIssue[];
}

function findWorkspaceDir(): string | null {
  // OpenClaw workspace locations
  const candidates = [
    join(homedir(), '.openclaw', 'workspace'),
    join(homedir(), '.zeroclaw', 'workspace'),
  ];
  for (const dir of candidates) {
    if (existsSync(dir)) return dir;
  }
  return null;
}

function collectSoulFiles(dir: string): Record<string, string> {
  const files: Record<string, string> = {};
  const soulFiles = ['SOUL.md', 'IDENTITY.md', 'AGENTS.md', 'HEARTBEAT.md', 'STYLE.md', 'USER.md', 'TOOLS.md', 'soul.json'];

  for (const name of soulFiles) {
    const path = join(dir, name);
    if (existsSync(path)) {
      try { files[name] = readFileSync(path, 'utf-8'); } catch {}
    }
  }

  return files;
}

function computeChecksums(files: Record<string, string>): Record<string, string> {
  const checksums: Record<string, string> = {};
  for (const [name, content] of Object.entries(files)) {
    checksums[name] = createHash('sha256').update(content).digest('hex');
  }
  return checksums;
}

function loadSavedChecksums(): Record<string, string> | null {
  if (!existsSync(CHECKSUMS_FILE)) return null;
  try {
    return JSON.parse(readFileSync(CHECKSUMS_FILE, 'utf-8'));
  } catch {
    return null;
  }
}

function saveChecksums(checksums: Record<string, string>): void {
  mkdirSync(SOULSCAN_DIR, { recursive: true });
  writeFileSync(CHECKSUMS_FILE, JSON.stringify(checksums, null, 2));
}

export async function soulscanCommand(dir?: string, opts?: { quiet?: boolean; init?: boolean }): Promise<void> {
  const quiet = opts?.quiet ?? false;
  const initMode = opts?.init ?? false;

  // Resolve scan directory
  const scanDir = dir ? resolve(dir) : findWorkspaceDir();
  if (!scanDir || !existsSync(scanDir)) {
    console.log(chalk.red('❌ No workspace found. Specify a directory or ensure OpenClaw is installed.'));
    process.exit(1);
  }

  if (!quiet) {
    console.log(chalk.bold(`\n🔍 SoulScan — Scanning ${scanDir}\n`));
  }

  // Collect soul files
  const files = collectSoulFiles(scanDir);
  const fileCount = Object.keys(files).length;

  if (fileCount === 0) {
    console.log(chalk.yellow('⚠️  No soul files found in workspace.'));
    process.exit(0);
  }

  if (!quiet) {
    console.log(chalk.gray(`   Found ${fileCount} soul files\n`));
  }

  // Phase 1: Integrity check (checksum comparison)
  const currentChecksums = computeChecksums(files);
  const savedChecksums = loadSavedChecksums();
  let tampered = false;
  const tamperDetails: string[] = [];

  if (savedChecksums && !initMode) {
    for (const [name, hash] of Object.entries(currentChecksums)) {
      if (savedChecksums[name] && savedChecksums[name] !== hash) {
        tampered = true;
        tamperDetails.push(`${name}: content changed since last scan`);
      }
    }
    for (const name of Object.keys(savedChecksums)) {
      if (!currentChecksums[name]) {
        tampered = true;
        tamperDetails.push(`${name}: file removed since last scan`);
      }
    }
    for (const name of Object.keys(currentChecksums)) {
      if (!savedChecksums[name]) {
        tamperDetails.push(`${name}: new file added since last scan`);
      }
    }

    if (tampered) {
      console.log(chalk.red.bold('⚠️  INTEGRITY ALERT — Files changed since last scan:'));
      for (const detail of tamperDetails) {
        console.log(chalk.red(`   - ${detail}`));
      }
      console.log('');
    } else if (tamperDetails.length > 0) {
      // New files added (not tampered)
      for (const detail of tamperDetails) {
        console.log(chalk.yellow(`   ℹ ${detail}`));
      }
      console.log('');
    } else if (!quiet) {
      console.log(chalk.green('✅ Integrity check passed — no changes detected\n'));
    }
  } else if (initMode || !savedChecksums) {
    if (!quiet) {
      console.log(chalk.gray('   Initializing baseline checksums...\n'));
    }
  }

  // Always update checksums
  saveChecksums(currentChecksums);

  // Phase 2: Security scan via server API
  const fileMap: Record<string, string> = {};
  for (const [name, content] of Object.entries(files)) {
    fileMap[name] = content;
  }

  // Build a minimal manifest from soul.json if available
  let manifest: any = { name: 'workspace-scan', version: '0.0.0', specVersion: '0.3' };
  if (files['soul.json']) {
    try { manifest = JSON.parse(files['soul.json']); } catch {}
  }

  try {
    const res = await fetch(`${API_BASE}/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ manifest, files: fileMap, soulscan: true }),
    });

    const data = await res.json();
    const checks = data.checks || [];

    if (!quiet) {
      printScanResults(checks);
    }

    // Summary for cron/quiet mode
    const errors = checks.filter((c: any) => c.type === 'fail').length;
    const warnings = checks.filter((c: any) => c.type === 'warn').length;

    if (quiet) {
      if (tampered || errors > 0) {
        console.log(`SOULSCAN_ALERT: ${tampered ? 'TAMPERED' : ''} ${errors} errors, ${warnings} warnings`);
        process.exit(1);
      } else {
        console.log('SOULSCAN_OK');
        process.exit(0);
      }
    }

    if (tampered || errors > 0) {
      process.exit(1);
    }
  } catch (err: any) {
    // Offline fallback: basic local checks
    if (!quiet) {
      console.log(chalk.yellow('⚠️  Server unreachable, running local integrity check only'));
      if (!tampered) {
        console.log(chalk.green('\n✅ Local integrity check passed'));
      }
    } else if (tampered) {
      console.log('SOULSCAN_ALERT: TAMPERED (offline mode)');
      process.exit(1);
    } else {
      console.log('SOULSCAN_OK (offline)');
    }
  }
}

function printScanResults(checks: any[]): void {
  const icons: Record<string, string> = {
    pass: chalk.green('✅'),
    fail: chalk.red('❌'),
    warn: chalk.yellow('⚠️'),
  };

  for (const c of checks) {
    const icon = icons[c.type] || '  ';
    const text = c.type === 'fail' ? chalk.red(c.message)
      : c.type === 'warn' ? chalk.yellow(c.message)
      : c.message;
    console.log(`${icon} ${text}`);
    if (c.details?.length) {
      for (const d of c.details) {
        console.log(c.type === 'fail' ? chalk.red(`   - ${d}`) : chalk.yellow(`   - ${d}`));
      }
    }
  }

  const passed = checks.filter(c => c.type === 'pass').length;
  const failed = checks.filter(c => c.type === 'fail').length;
  const warnings = checks.filter(c => c.type === 'warn').length;

  console.log('');
  if (failed > 0) {
    console.log(chalk.red.bold(`🔍 SoulScan Result: ${failed} error${failed !== 1 ? 's' : ''}, ${warnings} warning${warnings !== 1 ? 's' : ''}`));
  } else if (warnings > 0) {
    console.log(chalk.green.bold('🔍 SoulScan: PASS') + chalk.dim(` — ${passed} passed, ${warnings} warning${warnings !== 1 ? 's' : ''}`));
  } else {
    console.log(chalk.green.bold('🔍 SoulScan: PASS') + chalk.dim(` — All ${passed} checks passed`));
  }
  console.log('');
}
