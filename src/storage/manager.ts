import { existsSync, readdirSync, readFileSync, writeFileSync, copyFileSync, mkdirSync } from 'fs';
import { join, basename } from 'path';
import { getConfig, ensureDir } from '../utils/config.js';
import { validateClawSoul, type ClawSoul } from '../utils/validate.js';

/** Files that get copied to workspace on `use` */
const SOUL_FILES = ['SOUL.md', 'IDENTITY.md', 'AGENTS.md', 'HEARTBEAT.md'];

/** Files that are NEVER overwritten (personal data) */
const PROTECTED_FILES = ['USER.md', 'MEMORY.md', 'TOOLS.md'];

export interface InstalledSoul {
  name: string;
  displayName: string;
  version: string;
  description: string;
  category: string;
  path: string;
}

export class StorageManager {
  private soulsDir: string;
  private workspace: string;
  private backupDir: string;

  constructor() {
    const config = getConfig();
    this.soulsDir = config.soulsDir;
    this.workspace = config.workspace;
    this.backupDir = join(this.soulsDir, '_backup');
  }

  /** List all installed souls */
  listInstalled(): InstalledSoul[] {
    ensureDir(this.soulsDir);
    const entries = readdirSync(this.soulsDir, { withFileTypes: true });
    const souls: InstalledSoul[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('_')) continue;
      const manifestPath = join(this.soulsDir, entry.name, 'clawsoul.json');
      if (!existsSync(manifestPath)) continue;

      try {
        const data = JSON.parse(readFileSync(manifestPath, 'utf-8'));
        souls.push({
          name: data.name || entry.name,
          displayName: data.displayName || data.name || entry.name,
          version: data.version || '0.0.0',
          description: data.description || '',
          category: data.category || 'general',
          path: join(this.soulsDir, entry.name),
        });
      } catch {
        // Skip invalid manifests
      }
    }

    return souls;
  }

  /** Check if a soul is installed */
  isInstalled(name: string): boolean {
    return existsSync(join(this.soulsDir, name, 'clawsoul.json'));
  }

  /** Get soul install directory */
  getSoulDir(name: string): string {
    return join(this.soulsDir, name);
  }

  /** Save downloaded soul files to souls dir */
  saveSoul(name: string, files: Map<string, string>): void {
    const dir = join(this.soulsDir, name);
    ensureDir(dir);

    for (const [filename, content] of files) {
      const filePath = join(dir, filename);
      const parentDir = join(filePath, '..');
      ensureDir(parentDir);
      writeFileSync(filePath, content, 'utf-8');
    }
  }

  /** Backup current workspace files before applying a new soul */
  backupWorkspace(): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const backupPath = join(this.backupDir, timestamp);
    ensureDir(backupPath);

    for (const file of SOUL_FILES) {
      const src = join(this.workspace, file);
      if (existsSync(src)) {
        copyFileSync(src, join(backupPath, file));
      }
    }

    return backupPath;
  }

  /** Apply a soul to the workspace (copy soul files) */
  applySoul(name: string): void {
    const soulDir = join(this.soulsDir, name);
    if (!existsSync(soulDir)) {
      throw new Error(`Soul "${name}" is not installed`);
    }

    const manifestPath = join(soulDir, 'clawsoul.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
    const fileMap: Record<string, string> = manifest.files || {};

    // Copy each mapped file to workspace
    for (const [key, filename] of Object.entries(fileMap)) {
      if (typeof filename !== 'string') continue;
      const src = join(soulDir, filename);
      if (!existsSync(src)) continue;

      // Map soul file keys to workspace filenames
      const targetName = this.mapFileKey(key, filename);
      if (!targetName) continue;
      if (PROTECTED_FILES.includes(targetName)) continue;

      copyFileSync(src, join(this.workspace, targetName));
    }
  }

  /** Restore workspace from latest backup */
  restore(): string | null {
    if (!existsSync(this.backupDir)) return null;

    const backups = readdirSync(this.backupDir, { withFileTypes: true })
      .filter(e => e.isDirectory() && !e.name.startsWith('.'))
      .map(e => e.name)
      .sort()
      .reverse();

    if (backups.length === 0) return null;

    const latest = join(this.backupDir, backups[0]);
    const files = readdirSync(latest);

    for (const file of files) {
      copyFileSync(join(latest, file), join(this.workspace, file));
    }

    return backups[0];
  }

  /** List available backups */
  listBackups(): string[] {
    if (!existsSync(this.backupDir)) return [];
    return readdirSync(this.backupDir, { withFileTypes: true })
      .filter(e => e.isDirectory())
      .map(e => e.name)
      .sort()
      .reverse();
  }

  private mapFileKey(key: string, filename: string): string | null {
    const map: Record<string, string> = {
      soul: 'SOUL.md',
      identity: 'IDENTITY.md',
      agents: 'AGENTS.md',
      heartbeat: 'HEARTBEAT.md',
    };
    return map[key] || null;
  }
}
