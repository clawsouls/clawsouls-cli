import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { getConfig } from '../utils/config.js';

export interface SoulMeta {
  name: string;
  owner?: string;
  fullName?: string;
  displayName: string;
  version: string;
  description: string;
  category: string;
  tags: string[];
}

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

  private soulApiPath(name: string, owner?: string): string {
    return owner ? `${this.api}/souls/${owner}/${name}` : `${this.api}/souls/${name}`;
  }

  async getSoulMeta(name: string, owner?: string, version?: string): Promise<SoulMeta> {
    try {
      const vq = version ? `&version=${version}` : '';
      const res = await fetch(`${this.soulApiPath(name, owner)}?files=true${vq}`);
      if (res.ok) {
        const data = await res.json();
        if (data.fileContents?.['clawsoul.json']) {
          return JSON.parse(data.fileContents['clawsoul.json']);
        }
        return {
          name: data.name,
          owner: data.owner,
          fullName: data.fullName,
          displayName: data.displayName || data.name,
          version: data.version || '1.0.0',
          description: data.description || '',
          category: data.category || '',
          tags: data.tags || [],
        };
      }
      if (version && res.status === 404) {
        throw new Error(`Version "${version}" not found for soul "${owner ? `${owner}/` : ''}${name}"`);
      }
    } catch (err: any) {
      if (err.message?.includes('not found')) throw err;
    }

    const content = await this.readFile(name, 'clawsoul.json');
    return JSON.parse(content);
  }

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

  async downloadFile(name: string, filename: string, owner?: string, version?: string): Promise<string> {
    const cacheKey = owner ? `${owner}/${name}` : name;
    const cached = this._apiCache.get(cacheKey);
    if (cached) {
      const key = this.filenameToKey(filename);
      if (cached[key]) return cached[key];
      if (cached[filename]) return cached[filename];
    }

    try {
      const vq = version ? `&version=${version}` : '';
      const res = await fetch(`${this.soulApiPath(name, owner)}?files=true${vq}`);
      if (res.ok) {
        const data = await res.json();
        if (data.fileContents) {
          const key = this.filenameToKey(filename);
          if (data.fileContents[key]) return data.fileContents[key];
          if (data.fileContents[filename]) return data.fileContents[filename];
        }
      }
    } catch {}

    return this.readFile(name, filename);
  }

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

  async getSoulFiles(name: string, owner?: string, version?: string): Promise<string[]> {
    try {
      const vq = version ? `&version=${version}` : '';
      const res = await fetch(`${this.soulApiPath(name, owner)}?files=true${vq}`);
      if (version && res.status === 404) {
        throw new Error(`Version "${version}" not found for soul "${owner ? `${owner}/` : ''}${name}"`);
      }
      if (res.ok) {
        const data = await res.json();
        if (data.fileContents) {
          const cacheKey = owner ? `${owner}/${name}` : name;
          this._apiCache.set(cacheKey, data.fileContents);
          return Object.keys(data.fileContents).map(k => this.keyToFilename(k));
        }
      }
    } catch {}

    const meta = await this.getSoulMeta(name, owner);
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
