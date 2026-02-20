import chalk from 'chalk';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync, mkdirSync, appendFileSync, copyFileSync } from 'fs';
import { join, resolve } from 'path';
import { createHash } from 'crypto';
import { homedir } from 'os';

const API_BASE = 'https://clawsouls.ai/api/v1';
const SOULSCAN_DIR = join(homedir(), '.clawsouls', 'soulscan');
const CHECKSUMS_FILE = join(SOULSCAN_DIR, 'checksums.json');
const BASELINES_DIR = join(SOULSCAN_DIR, 'baselines');
const AUDIT_LOG_FILE = join(SOULSCAN_DIR, 'audit.jsonl');

// Protection policies
const PROTECTION_POLICY: Record<string, 'restore' | 'alert' | 'ignore'> = {
  'SOUL.md': 'restore',
  'IDENTITY.md': 'restore',
  'AGENTS.md': 'restore',
  'USER.md': 'alert',
  'TOOLS.md': 'alert',
  'HEARTBEAT.md': 'alert',
  'STYLE.md': 'alert',
  'soul.json': 'ignore',
};

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

interface AuditEntry {
  timestamp: string;
  action: string;
  files_scanned: number;
  drift_detected: string[];
  restored: string[];
  scan_score: number | null;
  scan_errors: number;
  scan_warnings: number;
  prev_hash: string;
  entry_hash?: string;
}

interface SoulscanOpts {
  quiet?: boolean;
  init?: boolean;
  restore?: boolean;
  approve?: boolean;
  report?: boolean;
  verifyAudit?: boolean;
  auditLog?: boolean;
}

function findWorkspaceDir(): string | null {
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

// --- Feature A: Baselines ---

function saveBaselines(files: Record<string, string>): void {
  mkdirSync(BASELINES_DIR, { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(BASELINES_DIR, name), content);
  }
}

function loadBaseline(filename: string): string | null {
  const path = join(BASELINES_DIR, filename);
  if (!existsSync(path)) return null;
  try {
    return readFileSync(path, 'utf-8');
  } catch {
    return null;
  }
}

function restoreFile(scanDir: string, filename: string): boolean {
  const baseline = loadBaseline(filename);
  if (baseline === null) return false;
  writeFileSync(join(scanDir, filename), baseline);
  return true;
}

// --- Feature C: Audit Log ---

function getLastAuditHash(): string {
  if (!existsSync(AUDIT_LOG_FILE)) return 'genesis';
  try {
    const lines = readFileSync(AUDIT_LOG_FILE, 'utf-8').trim().split('\n').filter(Boolean);
    if (lines.length === 0) return 'genesis';
    const last = JSON.parse(lines[lines.length - 1]);
    return last.entry_hash || 'genesis';
  } catch {
    return 'genesis';
  }
}

function computeEntryHash(entry: Omit<AuditEntry, 'entry_hash'>, prevHash: string): string {
  const data = JSON.stringify(entry) + prevHash;
  return createHash('sha256').update(data).digest('hex');
}

function appendAuditEntry(entry: AuditEntry): void {
  mkdirSync(SOULSCAN_DIR, { recursive: true });
  const prevHash = getLastAuditHash();
  entry.prev_hash = prevHash;
  // Compute hash without entry_hash field
  const { entry_hash, ...rest } = entry;
  entry.entry_hash = computeEntryHash(rest as Omit<AuditEntry, 'entry_hash'>, prevHash);
  appendFileSync(AUDIT_LOG_FILE, JSON.stringify(entry) + '\n');
}

function verifyAuditChain(): { valid: boolean; entries: number; error?: string } {
  if (!existsSync(AUDIT_LOG_FILE)) {
    return { valid: true, entries: 0 };
  }
  const lines = readFileSync(AUDIT_LOG_FILE, 'utf-8').trim().split('\n').filter(Boolean);
  let expectedPrev = 'genesis';

  for (let i = 0; i < lines.length; i++) {
    const entry = JSON.parse(lines[i]);
    if (entry.prev_hash !== expectedPrev) {
      return { valid: false, entries: lines.length, error: `Entry ${i + 1}: prev_hash mismatch (expected ${expectedPrev.slice(0, 8)}..., got ${entry.prev_hash.slice(0, 8)}...)` };
    }
    const { entry_hash, ...rest } = entry;
    const computed = computeEntryHash(rest, expectedPrev);
    if (computed !== entry_hash) {
      return { valid: false, entries: lines.length, error: `Entry ${i + 1}: entry_hash mismatch (computed ${computed.slice(0, 8)}..., stored ${entry_hash.slice(0, 8)}...)` };
    }
    expectedPrev = entry_hash;
  }
  return { valid: true, entries: lines.length };
}

function getRecentAuditEntries(count: number = 10): AuditEntry[] {
  if (!existsSync(AUDIT_LOG_FILE)) return [];
  const lines = readFileSync(AUDIT_LOG_FILE, 'utf-8').trim().split('\n').filter(Boolean);
  return lines.slice(-count).map(l => JSON.parse(l));
}

// --- Main Command ---

export async function soulscanCommand(dir?: string, opts?: SoulscanOpts): Promise<void> {
  const quiet = opts?.quiet ?? false;
  const initMode = opts?.init ?? false;
  const restoreMode = opts?.restore ?? false;
  const approveMode = opts?.approve ?? false;
  const reportMode = opts?.report ?? false;
  const verifyAuditMode = opts?.verifyAudit ?? false;
  const auditLogMode = opts?.auditLog ?? false;

  // --- Standalone audit commands ---
  if (verifyAuditMode) {
    const result = verifyAuditChain();
    if (result.entries === 0) {
      console.log(chalk.yellow('ℹ No audit log entries found.'));
      return;
    }
    if (result.valid) {
      console.log(chalk.green(`✅ Audit chain verified — ${result.entries} entries, all hashes valid`));
    } else {
      console.log(chalk.red(`❌ Audit chain BROKEN — ${result.error}`));
      process.exit(1);
    }
    return;
  }

  if (auditLogMode) {
    const entries = getRecentAuditEntries(10);
    if (entries.length === 0) {
      console.log(chalk.yellow('ℹ No audit log entries found.'));
      return;
    }
    console.log(chalk.bold(`\n📋 Recent Audit Log (${entries.length} entries)\n`));
    for (const e of entries) {
      const time = new Date(e.timestamp).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
      const drift = e.drift_detected.length > 0 ? chalk.yellow(e.drift_detected.join(', ')) : chalk.green('none');
      const restored = e.restored.length > 0 ? chalk.cyan(e.restored.join(', ')) : 'none';
      console.log(chalk.gray('─'.repeat(50)));
      console.log(`  ${chalk.bold(e.action.toUpperCase())}  ${chalk.dim(time)}`);
      console.log(`  Files: ${e.files_scanned} | Drift: ${drift} | Restored: ${restored}`);
      if (e.scan_score !== null) {
        console.log(`  Score: ${e.scan_score} | Errors: ${e.scan_errors} | Warnings: ${e.scan_warnings}`);
      }
      console.log(`  Hash: ${chalk.dim(e.entry_hash?.slice(0, 16) + '...')}`);
    }
    console.log(chalk.gray('─'.repeat(50)));
    console.log('');
    return;
  }

  // --- Resolve scan directory ---
  const scanDir = dir ? resolve(dir) : findWorkspaceDir();
  if (!scanDir || !existsSync(scanDir)) {
    console.log(chalk.red('❌ No workspace found. Specify a directory or ensure OpenClaw is installed.'));
    process.exit(1);
  }

  if (!quiet && !reportMode) {
    console.log(chalk.bold(`\n🔍 SoulScan — Scanning ${scanDir}\n`));
  }

  // Collect soul files
  const files = collectSoulFiles(scanDir);
  const fileCount = Object.keys(files).length;

  if (fileCount === 0) {
    console.log(chalk.yellow('⚠️  No soul files found in workspace.'));
    process.exit(0);
  }

  if (!quiet && !reportMode) {
    console.log(chalk.gray(`   Found ${fileCount} soul files\n`));
  }

  // --- Approve mode ---
  if (approveMode) {
    const currentChecksums = computeChecksums(files);
    saveChecksums(currentChecksums);
    saveBaselines(files);
    appendAuditEntry({
      timestamp: new Date().toISOString(),
      action: 'approve',
      files_scanned: fileCount,
      drift_detected: [],
      restored: [],
      scan_score: null,
      scan_errors: 0,
      scan_warnings: 0,
      prev_hash: '',
    });
    console.log(chalk.green(`✅ Baselines and checksums updated for ${fileCount} files`));
    for (const name of Object.keys(files)) {
      console.log(chalk.gray(`   ✓ ${name}`));
    }
    return;
  }

  // Phase 1: Integrity check
  const currentChecksums = computeChecksums(files);
  const savedChecksums = loadSavedChecksums();
  let tampered = false;
  const tamperDetails: string[] = [];
  const driftFiles: string[] = [];
  const restoredFiles: string[] = [];
  const alertFiles: string[] = [];

  if (savedChecksums && !initMode) {
    for (const [name, hash] of Object.entries(currentChecksums)) {
      if (savedChecksums[name] && savedChecksums[name] !== hash) {
        tampered = true;
        driftFiles.push(name);
        const policy = PROTECTION_POLICY[name] || 'alert';

        if (restoreMode && policy === 'restore') {
          if (restoreFile(scanDir, name)) {
            restoredFiles.push(name);
            tamperDetails.push(`${name}: changed → RESTORED from baseline`);
          } else {
            tamperDetails.push(`${name}: changed (no baseline available to restore)`);
            alertFiles.push(name);
          }
        } else if (policy === 'restore' && !restoreMode) {
          tamperDetails.push(`${name}: changed (use --restore to auto-restore)`);
          alertFiles.push(name);
        } else if (policy === 'alert') {
          tamperDetails.push(`${name}: changed (alert-only, not restoring)`);
          alertFiles.push(name);
        } else if (policy === 'ignore') {
          tamperDetails.push(`${name}: changed (ignored per policy)`);
        }
      }
    }
    for (const name of Object.keys(savedChecksums)) {
      if (!currentChecksums[name]) {
        tampered = true;
        driftFiles.push(name);
        tamperDetails.push(`${name}: file removed since last scan`);
        alertFiles.push(name);
      }
    }
    for (const name of Object.keys(currentChecksums)) {
      if (!savedChecksums[name]) {
        tamperDetails.push(`${name}: new file added since last scan`);
      }
    }

    if (!quiet && !reportMode) {
      if (tampered) {
        console.log(chalk.red.bold('⚠️  INTEGRITY ALERT — Files changed since last scan:'));
        for (const detail of tamperDetails) {
          if (detail.includes('RESTORED')) {
            console.log(chalk.cyan(`   ⚠️ ${detail}`));
          } else if (detail.includes('alert-only')) {
            console.log(chalk.yellow(`   ℹ ${detail}`));
          } else if (detail.includes('ignored')) {
            console.log(chalk.gray(`   · ${detail}`));
          } else {
            console.log(chalk.red(`   - ${detail}`));
          }
        }
        console.log('');
      } else if (tamperDetails.length > 0) {
        for (const detail of tamperDetails) {
          console.log(chalk.yellow(`   ℹ ${detail}`));
        }
        console.log('');
      } else {
        console.log(chalk.green('✅ Integrity check passed — no changes detected\n'));
      }
    }
  } else if (initMode || !savedChecksums) {
    if (!quiet && !reportMode) {
      console.log(chalk.gray('   Initializing baseline checksums...\n'));
    }
  }

  // Update checksums (re-read files if restored)
  if (restoredFiles.length > 0) {
    const updatedFiles = collectSoulFiles(scanDir);
    const updatedChecksums = computeChecksums(updatedFiles);
    saveChecksums(updatedChecksums);
  } else {
    saveChecksums(currentChecksums);
  }

  // Save baselines on init
  if (initMode || !savedChecksums) {
    saveBaselines(files);
  }

  // Phase 2: Security scan via server API
  const fileMap: Record<string, string> = {};
  const currentFiles = restoredFiles.length > 0 ? collectSoulFiles(scanDir) : files;
  for (const [name, content] of Object.entries(currentFiles)) {
    fileMap[name] = content;
  }

  let manifest: any = { name: 'workspace-scan', version: '0.0.0', specVersion: '0.3' };
  if (currentFiles['soul.json']) {
    try { manifest = JSON.parse(currentFiles['soul.json']); } catch {}
  }

  let scanScore: number | null = null;
  let scanErrors = 0;
  let scanWarnings = 0;
  let scanInfoCount = 0;
  let checks: any[] = [];

  try {
    const res = await fetch(`${API_BASE}/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ manifest, files: fileMap, soulscan: true }),
    });

    const data = await res.json();
    checks = data.checks || [];
    scanErrors = checks.filter((c: any) => c.type === 'fail').length;
    scanWarnings = checks.filter((c: any) => c.type === 'warn').length;
    scanInfoCount = checks.filter((c: any) => c.type === 'pass').length;

    // Derive score: 100 - (errors * 15) - (warnings * 5)
    scanScore = Math.max(0, 100 - (scanErrors * 15) - (scanWarnings * 5));

    if (!quiet && !reportMode) {
      printScanResults(checks);
    }

    // Report mode output
    if (reportMode) {
      printReport(scanDir, driftFiles, restoredFiles, alertFiles, scanScore, scanErrors, scanWarnings, scanInfoCount, checks, tampered);
    }

    // Quiet mode
    if (quiet && !reportMode) {
      if (tampered || scanErrors > 0) {
        console.log(`SOULSCAN_ALERT: ${tampered ? 'TAMPERED' : ''} ${scanErrors} errors, ${scanWarnings} warnings`);
        process.exit(1);
      } else {
        console.log('SOULSCAN_OK');
        process.exit(0);
      }
    }
  } catch (err: any) {
    if (!quiet && !reportMode) {
      console.log(chalk.yellow('⚠️  Server unreachable, running local integrity check only'));
      if (!tampered) {
        console.log(chalk.green('\n✅ Local integrity check passed'));
      }
    } else if (reportMode) {
      printReport(scanDir, driftFiles, restoredFiles, alertFiles, null, 0, 0, 0, [], tampered);
    } else if (quiet) {
      if (tampered) {
        console.log('SOULSCAN_ALERT: TAMPERED (offline mode)');
        process.exit(1);
      } else {
        console.log('SOULSCAN_OK (offline)');
      }
    }
  }

  // Append audit log
  appendAuditEntry({
    timestamp: new Date().toISOString(),
    action: initMode ? 'init' : restoreMode ? 'restore' : 'scan',
    files_scanned: fileCount,
    drift_detected: driftFiles,
    restored: restoredFiles,
    scan_score: scanScore,
    scan_errors: scanErrors,
    scan_warnings: scanWarnings,
    prev_hash: '',
  });

  if ((tampered && alertFiles.length > 0) || scanErrors > 0) {
    process.exit(1);
  }
}

// --- Feature B: Report ---

function printReport(
  scanDir: string,
  driftFiles: string[],
  restoredFiles: string[],
  alertFiles: string[],
  score: number | null,
  errors: number,
  warnings: number,
  infoCount: number,
  checks: any[],
  tampered: boolean,
): void {
  const now = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  const lines: string[] = [];

  lines.push('🔍 SoulScan Audit Report');
  lines.push(`Time: ${now} KST`);
  lines.push(`Workspace: ${scanDir}`);
  lines.push('');
  lines.push('━━━ INTEGRITY ━━━');
  if (!tampered) {
    lines.push('✅ No drift detected');
  } else {
    lines.push(`⚠️ ${driftFiles.length} file${driftFiles.length !== 1 ? 's' : ''} changed, ${restoredFiles.length} restored`);
  }
  lines.push('');
  lines.push('━━━ SECURITY SCAN ━━━');
  if (score !== null) {
    const grade = score >= 90 ? 'Verified' : score >= 70 ? 'Acceptable' : 'At Risk';
    lines.push(`Score: ${score}/100 (${grade})`);
    lines.push(`Errors: ${errors} | Warnings: ${warnings} | Info: ${infoCount}`);
  } else {
    lines.push('⚠️ Server unreachable — scan skipped');
  }

  const details = checks.filter((c: any) => c.type === 'fail' || c.type === 'warn');
  if (details.length > 0) {
    lines.push('');
    lines.push('━━━ DETAILS ━━━');
    for (const c of details) {
      const icon = c.type === 'fail' ? '❌' : '⚠️';
      const code = c.code ? `[${c.code}] ` : '';
      lines.push(`${icon} ${code}${c.message}`);
    }
  }

  lines.push('');
  lines.push('━━━ ACTION REQUIRED ━━━');
  if (alertFiles.length > 0) {
    for (const f of alertFiles) {
      lines.push(`• ${f} — needs review`);
    }
  } else if (errors > 0) {
    lines.push('Review security scan errors above');
  } else {
    lines.push('None');
  }

  console.log(lines.join('\n'));
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
