import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export interface PlatformInfo {
  name: 'openclaw' | 'zeroclaw';
  workspace: string;
  restartCommand: string;
  configDir: string;
}

const OPENCLAW_DIR = join(homedir(), '.openclaw');
const ZEROCLAW_DIR = join(homedir(), '.zeroclaw');
const OPENCLAW_WORKSPACE = join(OPENCLAW_DIR, 'workspace');
const ZEROCLAW_WORKSPACE = join(ZEROCLAW_DIR, 'workspace');

export function detectPlatform(override?: string): PlatformInfo {
  if (override === 'zeroclaw') {
    return {
      name: 'zeroclaw',
      workspace: ZEROCLAW_WORKSPACE,
      restartCommand: 'zeroclaw gateway restart',
      configDir: ZEROCLAW_DIR,
    };
  }

  if (override === 'openclaw') {
    return {
      name: 'openclaw',
      workspace: OPENCLAW_WORKSPACE,
      restartCommand: 'openclaw gateway restart',
      configDir: OPENCLAW_DIR,
    };
  }

  // Auto-detect
  const hasOpenClaw = existsSync(OPENCLAW_DIR);
  const hasZeroClaw = existsSync(ZEROCLAW_DIR);

  if (hasOpenClaw && !hasZeroClaw) {
    return {
      name: 'openclaw',
      workspace: OPENCLAW_WORKSPACE,
      restartCommand: 'openclaw gateway restart',
      configDir: OPENCLAW_DIR,
    };
  }

  if (hasZeroClaw && !hasOpenClaw) {
    return {
      name: 'zeroclaw',
      workspace: ZEROCLAW_WORKSPACE,
      restartCommand: 'zeroclaw gateway restart',
      configDir: ZEROCLAW_DIR,
    };
  }

  if (hasOpenClaw && hasZeroClaw) {
    // Both exist — prefer OpenClaw (default), user can override with --platform
    return {
      name: 'openclaw',
      workspace: OPENCLAW_WORKSPACE,
      restartCommand: 'openclaw gateway restart',
      configDir: OPENCLAW_DIR,
    };
  }

  // Neither — default to OpenClaw
  return {
    name: 'openclaw',
    workspace: OPENCLAW_WORKSPACE,
    restartCommand: 'openclaw gateway restart',
    configDir: OPENCLAW_DIR,
  };
}

export function getPlatformLabel(platform: PlatformInfo): string {
  return platform.name === 'zeroclaw' ? 'ZeroClaw 🦀' : 'OpenClaw 🦞';
}
