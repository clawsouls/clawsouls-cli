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
 * MVP: GitHub raw URL 기반 레지스트리 + 로컬 경로 지원
 * Phase 4 이후: API 서버로 전환
 */
export class RegistryClient {
  private cdn: string;
  private isLocal: boolean;

  constructor() {
    const config = getConfig();
    this.cdn = config.cdn;
    this.isLocal = !this.cdn.startsWith('http');
  }

  /** Soul의 clawsoul.json 가져오기 */
  async getSoulMeta(name: string): Promise<SoulMeta> {
    const content = await this.readFile(name, 'clawsoul.json');
    return JSON.parse(content);
  }

  /** Soul 파일 다운로드 */
  async downloadFile(name: string, filename: string): Promise<string> {
    return this.readFile(name, filename);
  }

  /** Soul 파일 목록 (clawsoul.json의 files 필드 기반) */
  async getSoulFiles(name: string): Promise<string[]> {
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
