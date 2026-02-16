import { existsSync, readdirSync, readFileSync, writeFileSync, cpSync, mkdirSync } from 'fs';
import { join } from 'path';
import { getConfig, ensureDir } from '../utils/config.js';

export class LocalStorage {
  private soulsDir: string;
  private workspace: string;
  private backupDir: string;

  constructor() {
    const config = getConfig();
    this.soulsDir = config.soulsDir;
    this.workspace = config.workspace;
    this.backupDir = join(this.soulsDir, '_backup');
  }

  /** Soul이 로컬에 설치되어 있는지 확인 */
  isInstalled(name: string): boolean {
    return existsSync(join(this.soulsDir, name, 'soul.json'))
      || existsSync(join(this.soulsDir, name, 'clawsoul.json'));
  }

  /** 설치된 Soul 목록 */
  listInstalled(): any[] {
    ensureDir(this.soulsDir);
    const entries = readdirSync(this.soulsDir, { withFileTypes: true });
    const souls: any[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('_')) continue;
      const metaPath = existsSync(join(this.soulsDir, entry.name, 'soul.json'))
        ? join(this.soulsDir, entry.name, 'soul.json')
        : join(this.soulsDir, entry.name, 'clawsoul.json');
      if (existsSync(metaPath)) {
        try {
          const raw = readFileSync(metaPath, 'utf-8');
          souls.push(JSON.parse(raw));
        } catch {
          // skip invalid
        }
      }
    }
    return souls;
  }

  /** Soul 파일을 로컬에 저장 */
  saveSoulFile(name: string, filename: string, content: string): void {
    const dir = join(this.soulsDir, name);
    ensureDir(dir);
    writeFileSync(join(dir, filename), content, 'utf-8');
  }

  /** 현재 workspace 파일 백업 */
  backupWorkspace(): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = join(this.backupDir, timestamp);
    ensureDir(backupPath);

    const filesToBackup = ['SOUL.md', 'IDENTITY.md', 'AGENTS.md', 'HEARTBEAT.md'];
    for (const file of filesToBackup) {
      const src = join(this.workspace, file);
      if (existsSync(src)) {
        cpSync(src, join(backupPath, file));
      }
    }
    return backupPath;
  }

  /** Soul을 workspace에 적용 */
  applySoul(name: string): void {
    const soulDir = join(this.soulsDir, name);
    const filesToApply = [
      { src: 'SOUL.md', dst: 'SOUL.md' },
      { src: 'IDENTITY.md', dst: 'IDENTITY.md' },
      { src: 'AGENTS.md', dst: 'AGENTS.md' },
      { src: 'HEARTBEAT.md', dst: 'HEARTBEAT.md' },
    ];

    for (const { src, dst } of filesToApply) {
      const srcPath = join(soulDir, src);
      if (existsSync(srcPath)) {
        cpSync(srcPath, join(this.workspace, dst));
      }
    }
  }

  /** 최신 백업에서 복원 */
  restoreFromBackup(): string | null {
    if (!existsSync(this.backupDir)) return null;

    const backups = readdirSync(this.backupDir, { withFileTypes: true })
      .filter(e => e.isDirectory())
      .map(e => e.name)
      .sort()
      .reverse();

    if (backups.length === 0) return null;

    const latest = join(this.backupDir, backups[0]);
    const files = readdirSync(latest);
    for (const file of files) {
      cpSync(join(latest, file), join(this.workspace, file));
    }
    return backups[0];
  }

  /** Soul 디렉토리 경로 */
  getSoulPath(name: string): string {
    return join(this.soulsDir, name);
  }
}
