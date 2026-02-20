import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export type PlatformName = 'openclaw' | 'zeroclaw' | 'clawdbot' | 'moltbot' | 'moldbot' | 'custom';

export interface PlatformInfo {
  name: PlatformName;
  workspace: string;
  restartCommand: string;
  configDir: string;
}

/**
 * Known SOUL.md-compatible agent frameworks and their directory conventions.
 * Priority order: OpenClaw (current) > ZeroClaw > legacy (clawdbot > moltbot > moldbot)
 */
const KNOWN_PLATFORMS: Array<{
  name: PlatformName;
  dir: string;
  restartCmd: string;
  label: string;
}> = [
  { name: 'openclaw',  dir: '.openclaw',  restartCmd: 'openclaw gateway restart',  label: 'OpenClaw 🦞' },
  { name: 'zeroclaw',  dir: '.zeroclaw',  restartCmd: 'zeroclaw gateway restart',  label: 'ZeroClaw 🦀' },
  { name: 'clawdbot',  dir: '.clawdbot',  restartCmd: 'clawdbot gateway restart',  label: 'Clawdbot 🤖' },
  { name: 'moltbot',   dir: '.moltbot',   restartCmd: 'moltbot gateway restart',   label: 'Moltbot 🐚' },
  { name: 'moldbot',   dir: '.moldbot',   restartCmd: 'moldbot gateway restart',   label: 'Moldbot 🍄' },
];

function getPlatformByName(name: string): typeof KNOWN_PLATFORMS[0] | undefined {
  return KNOWN_PLATFORMS.find(p => p.name === name);
}

export function detectPlatform(override?: string): PlatformInfo {
  const home = homedir();

  // 1. Explicit override via --platform flag or CLAWSOULS_PLATFORM env
  if (override) {
    const known = getPlatformByName(override);
    if (known) {
      const dir = join(home, known.dir);
      return {
        name: known.name,
        workspace: join(dir, 'workspace'),
        restartCommand: known.restartCmd,
        configDir: dir,
      };
    }
    // Custom path override (e.g., --platform /path/to/agent)
    if (override.startsWith('/') || override.startsWith('~')) {
      const resolved = override.startsWith('~') ? join(home, override.slice(1)) : override;
      return {
        name: 'custom',
        workspace: join(resolved, 'workspace'),
        restartCommand: '# restart your agent manually',
        configDir: resolved,
      };
    }
  }

  // 2. Auto-detect: find installed platforms in priority order
  const installed = KNOWN_PLATFORMS.filter(p => existsSync(join(home, p.dir)));

  if (installed.length === 1) {
    const p = installed[0];
    const dir = join(home, p.dir);
    return {
      name: p.name,
      workspace: join(dir, 'workspace'),
      restartCommand: p.restartCmd,
      configDir: dir,
    };
  }

  if (installed.length > 1) {
    // Multiple found — prefer by priority order (OpenClaw first)
    const p = installed[0];
    const dir = join(home, p.dir);
    return {
      name: p.name,
      workspace: join(dir, 'workspace'),
      restartCommand: p.restartCmd,
      configDir: dir,
    };
  }

  // 3. None found — default to OpenClaw
  const defaultDir = join(home, '.openclaw');
  return {
    name: 'openclaw',
    workspace: join(defaultDir, 'workspace'),
    restartCommand: 'openclaw gateway restart',
    configDir: defaultDir,
  };
}

export function detectAllPlatforms(): PlatformInfo[] {
  const home = homedir();
  return KNOWN_PLATFORMS
    .filter(p => existsSync(join(home, p.dir)))
    .map(p => {
      const dir = join(home, p.dir);
      return {
        name: p.name,
        workspace: join(dir, 'workspace'),
        restartCommand: p.restartCmd,
        configDir: dir,
      };
    });
}

export function getPlatformLabel(platform: PlatformInfo): string {
  const known = KNOWN_PLATFORMS.find(p => p.name === platform.name);
  return known?.label ?? `${platform.name} 🔧`;
}

export function getKnownPlatformNames(): string[] {
  return KNOWN_PLATFORMS.map(p => p.name);
}
