import chalk from 'chalk';
import { LocalStorage } from '../storage/local.js';

export async function listCommand(): Promise<void> {
  const storage = new LocalStorage();
  const souls = storage.listInstalled();

  if (souls.length === 0) {
    console.log(chalk.yellow('No souls installed.'));
    console.log(`  Run: ${chalk.cyan('clawsouls install <name>')}`);
    return;
  }

  console.log();
  console.log(chalk.bold(`  Installed Souls (${souls.length})`));
  console.log();

  // 테이블 헤더
  const nameWidth = Math.max(20, ...souls.map(s => s.name.length + 2));
  const verWidth = 10;

  console.log(
    chalk.gray('  ' +
      'Name'.padEnd(nameWidth) +
      'Version'.padEnd(verWidth) +
      'Description'
    )
  );
  console.log(chalk.gray('  ' + '─'.repeat(nameWidth + verWidth + 40)));

  for (const soul of souls) {
    const emoji = getEmoji(soul.category);
    console.log(
      '  ' +
      chalk.cyan(`${emoji} ${soul.name}`.padEnd(nameWidth)) +
      chalk.white(soul.version.padEnd(verWidth)) +
      chalk.gray(truncate(soul.description, 50))
    );
  }
  console.log();
}

function getEmoji(category: string): string {
  if (category.includes('devops')) return '🔧';
  if (category.includes('gamedev')) return '🎮';
  if (category.includes('engineering')) return '💻';
  if (category.includes('education')) return '📚';
  if (category.includes('writing')) return '📝';
  if (category.includes('data')) return '📊';
  if (category.includes('creative')) return '✍️';
  if (category.includes('lifestyle') || category.includes('assistant')) return '📋';
  return '🧠';
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 3) + '...' : str;
}
