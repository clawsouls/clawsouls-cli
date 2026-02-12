import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export interface ClawSoulsConfig {
  registry: string;
  cdn: string;
  workspace: string;
  soulsDir: string;
  auth?: {
    token?: string;
  };
}

const CONFIG_DIR = join(homedir(), '.clawsouls');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

const DEFAULT_CONFIG: ClawSoulsConfig = {
  registry: 'https://api.clawsouls.ai',
  cdn: process.env.CLAWSOULS_CDN || 'https://raw.githubusercontent.com/clawsouls/souls/main',
  workspace: join(homedir(), '.openclaw', 'workspace'),
  soulsDir: join(homedir(), '.openclaw', 'souls'),
};

export function getConfig(): ClawSoulsConfig {
  if (existsSync(CONFIG_FILE)) {
    try {
      const raw = readFileSync(CONFIG_FILE, 'utf-8');
      return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
    } catch {
      return DEFAULT_CONFIG;
    }
  }
  return DEFAULT_CONFIG;
}

export function saveConfig(config: Partial<ClawSoulsConfig>): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
  const current = getConfig();
  const merged = { ...current, ...config };
  writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2));
}

export function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}
