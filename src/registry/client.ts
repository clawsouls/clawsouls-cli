import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { getConfig } from '../utils/config.js';

export interface SoulMeta {
  name: string;
  displayName: string;
  version: string;
  description: string;
  category: string;
  tags: string[];
}

/**
 * Registry client with API + CDN fallback.
 * 1. Try API (clawsouls.ai/api/v1/souls/:name)
 * 2. Fall back to GitHub raw CDN
 * 3. Fall back to local path (CLAWSOULS_CDN env)
 */
export class RegistryClient {
  private cdn: string;
  private api: string;
  private isLocal: boolean;
  private _apiCache: Map<string, Record<string, string>> = new Map();

  constructor() {
    const config = getConfig();
    this.cdn = config.cdn;
    this.api = 'https://clawsouls.ai/api/v1';
    this.isLocal = !this.cdn.startsWith('http');
  }

  /** Soul의 clawsoul.json 가져오기 */
  async getSoulMeta(name: string): Promise<SoulMeta> {
    // Try API first
    try {
      const res = await fetch(`${this.api}/souls/${name}?files=true`);
      if (res.ok) {
        const data = await res.json();
        if (data.fileContents?.['clawsoul.json']) {
          return JSON.parse(data.fileContents['clawsoul.json']);
        }
        // Build meta from API response
        return {
          name: data.name,
          displayName: data.displayName || data.name,
          version: data.version || '1.0.0',
          description: data.description || '',
          category: data.category || '',
          tags: data.tags || [],
        };
      }
    } catch {
      // Fall through to CDN
    }

    const content = await this.readFile(name, 'clawsoul.json');
    return JSON.parse(content);
  }

  /** Reverse map filename to API key */
  private filenameToKey(filename: string): string {
    const map: Record<string, string> = {
      'SOUL.md': 'soul',
      'IDENTITY.md': 'identity',
      'AGENTS.md': 'agents',
      'HEARTBEAT.md': 'heartbeat',
      'STYLE.md': 'style',
      'README.md': 'readme',
    };
    return map[filename] || filename;
  }

  /** Soul 파일 다운로드 — tries API cache/fetch first */
  async downloadFile(name: string, filename: string): Promise<string> {
    // Check cache first (populated by getSoulFiles)
    const cached = this._apiCache.get(name);
    if (cached) {
      const key = this.filenameToKey(filename);
      if (cached[key]) return cached[key];
      if (cached[filename]) return cached[filename];
    }

    // Try API
    try {
      const res = await fetch(`${this.api}/souls/${name}?files=true`);
      if (res.ok) {
        const data = await res.json();
        if (data.fileContents) {
          const key = this.filenameToKey(filename);
          if (data.fileContents[key]) return data.fileContents[key];
          if (data.fileContents[filename]) return data.fileContents[filename];
        }
      }
    } catch {
      // Fall through to CDN
    }

    return this.readFile(name, filename);
  }

  /** Map API file keys to actual filenames */
  private keyToFilename(key: string): string {
    const map: Record<string, string> = {
      soul: 'SOUL.md',
      identity: 'IDENTITY.md',
      agents: 'AGENTS.md',
      heartbeat: 'HEARTBEAT.md',
      style: 'STYLE.md',
      readme: 'README.md',
    };
    return map[key] || key;
  }

  /** Soul 파일 목록 (clawsoul.json의 files 필드 기반) */
  async getSoulFiles(name: string): Promise<string[]> {
    // Try API first for file list
    try {
      const res = await fetch(`${this.api}/souls/${name}?files=true`);
      if (res.ok) {
        const data = await res.json();
        if (data.fileContents) {
          // Store mapped fileContents for downloadFile to use
          this._apiCache.set(name, data.fileContents);
          return Object.keys(data.fileContents).map(k => this.keyToFilename(k));
        }
      }
    } catch {
      // Fall through
    }

    const meta = await this.getSoulMeta(name);
    const files = ['clawsoul.json', 'README.md'];
    const fileMap = (meta as any).files || {};
    for (const path of Object.values(fileMap)) {
      if (typeof path === 'string') files.push(path);
    }
    return [...new Set(files)];
  }

  private async readFile(name: string, filename: string): Promise<string> {
    if (this.isLocal) {
      const filePath = join(this.cdn, name, filename);
      if (!existsSync(filePath)) {
        throw new Error(`Soul "${name}" not found in registry`);
      }
      return readFileSync(filePath, 'utf-8');
    }

    const url = `${this.cdn}/${name}/${filename}`;
    const res = await fetch(url);
    if (!res.ok) {
      if (res.status === 404) {
        throw new Error(`Soul "${name}" not found in registry`);
      }
      throw new Error(`Registry error: ${res.status} ${res.statusText}`);
    }
    return res.text();
  }
}
