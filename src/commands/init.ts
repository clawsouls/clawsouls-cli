import chalk from 'chalk';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

export async function initCommand(name?: string): Promise<void> {
  const soulName = name || 'my-soul';
  const dir = join(process.cwd(), soulName);

  if (existsSync(dir)) {
    console.log(chalk.red(`Directory "${soulName}" already exists.`));
    return;
  }

  mkdirSync(dir, { recursive: true });

  // clawsoul.json
  const meta = {
    name: soulName,
    displayName: soulName.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' '),
    version: '1.0.0',
    description: 'Describe your soul in one sentence.',
    author: {
      name: 'Your Name',
      github: 'your-github',
    },
    license: 'Apache-2.0',
    tags: [],
    category: 'work/engineering',
    compatibility: {
      openclaw: '>=2026.2.0',
    },
    files: {
      soul: 'SOUL.md',
      identity: 'IDENTITY.md',
      agents: 'AGENTS.md',
      heartbeat: 'HEARTBEAT.md',
    },
    skills: [],
  };
  writeFileSync(join(dir, 'clawsoul.json'), JSON.stringify(meta, null, 2));

  // SOUL.md
  writeFileSync(join(dir, 'SOUL.md'), `# ${meta.displayName}

Describe who this AI persona is.

## Personality

- **Tone**: 
- **Style**: 
- **Philosophy**: 

## Principles

1. ...
2. ...
3. ...

## Communication

- ...

## Boundaries

- ...
`);

  // IDENTITY.md
  writeFileSync(join(dir, 'IDENTITY.md'), `# ${meta.displayName}

- **Name:** 
- **Creature:** 
- **Vibe:** 
- **Emoji:** 
`);

  // AGENTS.md
  writeFileSync(join(dir, 'AGENTS.md'), `# ${meta.displayName} — Workflow

## Every Session
1. Read SOUL.md, USER.md, memory files
2. ...

## Work Rules
- ...

## Safety
- ...

## Heartbeats
- ...
`);

  // HEARTBEAT.md
  writeFileSync(join(dir, 'HEARTBEAT.md'), '# Heartbeat Checks\n# Add your periodic checks here\n');

  // README.md
  writeFileSync(join(dir, 'README.md'), `# ${meta.displayName}

Short description.

**Best for:** ...

**Personality:** ...

**Skills:** ...
`);

  console.log();
  console.log(chalk.green(`✅ Soul "${soulName}" created!`));
  console.log();
  console.log(`  ${chalk.cyan('Edit:')}     cd ${soulName} && edit SOUL.md`);
  console.log(`  ${chalk.cyan('Test:')}     clawsouls use ${soulName} (after install)`);
  console.log(`  ${chalk.cyan('Publish:')}  clawsouls publish (coming soon)`);
  console.log();
}
