import chalk from 'chalk';
import { detectPlatform, detectAllPlatforms, getPlatformLabel, getKnownPlatformNames } from '../utils/platform.js';
import { getConfig } from '../utils/config.js';

export async function platformCommand(): Promise<void> {
  const active = detectPlatform(process.env.CLAWSOULS_PLATFORM);
  const all = detectAllPlatforms();
  const config = getConfig();

  console.log(chalk.bold('\n🔍 Agent Platform Detection\n'));

  // Active platform
  console.log(chalk.green('▶ Active:'), getPlatformLabel(active));
  console.log(`  Workspace: ${chalk.cyan(config.workspace)}`);
  console.log(`  Souls dir: ${chalk.cyan(config.soulsDir)}`);
  console.log(`  Restart:   ${chalk.dim(active.restartCommand)}`);

  // All detected platforms
  if (all.length > 1) {
    console.log(chalk.bold('\n📦 All detected platforms:'));
    for (const p of all) {
      const isActive = p.name === active.name;
      const marker = isActive ? chalk.green(' ◀ active') : '';
      console.log(`  ${getPlatformLabel(p)}${marker}`);
      console.log(`    ${chalk.dim(p.workspace)}`);
    }
  } else if (all.length === 0) {
    console.log(chalk.yellow('\n⚠ No agent platforms detected.'));
    console.log(chalk.dim('  Defaulting to OpenClaw (~/.openclaw/workspace)'));
  }

  // Help
  console.log(chalk.bold('\n💡 Override:'));
  console.log(`  ${chalk.dim('clawsouls --platform zeroclaw use <soul>')}   # use ZeroClaw workspace`);
  console.log(`  ${chalk.dim('clawsouls --workspace /path/to use <soul>')}  # use custom workspace`);
  console.log(`  ${chalk.dim('CLAWSOULS_PLATFORM=clawdbot clawsouls use')} # env var override`);

  console.log(chalk.bold('\n🤝 Supported platforms:'));
  console.log(`  ${getKnownPlatformNames().join(', ')}, or any custom path`);
  console.log();
}
