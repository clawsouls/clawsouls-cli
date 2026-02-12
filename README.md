# 🧠 ClawSouls CLI

**Give your AI a soul.** Install, manage, and switch AI agent personas for [OpenClaw](https://github.com/openclaw/openclaw).

[![npm](https://img.shields.io/npm/v/clawsouls)](https://www.npmjs.com/package/clawsouls)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue)](LICENSE)

## What is ClawSouls?

ClawSouls is a persona sharing platform for AI agents. A **Soul** is a personality package — a set of markdown files that define how your AI thinks, talks, and behaves. Same LLM, completely different personality.

Browse available souls at [clawsouls.ai](https://clawsouls.ai).

## Quick Start

```bash
# Install a soul
npx clawsouls install brad

# Activate it (backs up your current workspace)
npx clawsouls use brad

# Restart your OpenClaw session — done!
```

## Installation

```bash
# Use directly with npx (no install needed)
npx clawsouls <command>

# Or install globally
npm install -g clawsouls
```

**Requirements:** Node.js 22+

## Commands

### `clawsouls install <name>`

Download and install a soul from the registry.

```bash
clawsouls install minimalist
clawsouls install devops-veteran
clawsouls install brad --force  # overwrite existing
```

### `clawsouls use <name>`

Activate an installed soul. Your current workspace files are automatically backed up before switching.

```bash
clawsouls use minimalist
```

**Automatic backup:** Before applying a new soul, the current workspace files (SOUL.md, IDENTITY.md, AGENTS.md, HEARTBEAT.md) are saved to `~/.openclaw/souls/_backup/<timestamp>/`. You can always revert with `clawsouls restore`.

**Protected files** — these are never overwritten:
- `USER.md` (your personal data)
- `MEMORY.md` (your AI's memories)
- `TOOLS.md` (your tool configuration)

### `clawsouls restore`

Revert to your previous soul from the latest backup (`~/.openclaw/souls/_backup/`).

```bash
clawsouls restore
```

Multiple backups are kept — each `use` creates a new timestamped backup, so you can safely switch between souls without losing any previous configuration.

### `clawsouls list`

Show all installed souls.

```bash
clawsouls list
```

## Available Souls

| Soul | Category | Description |
|------|----------|-------------|
| 🅱️ **Brad** | Engineering | Formal, project-focused development partner |
| 🔧 **DevOps Veteran** | DevOps | Battle-scarred infrastructure engineer |
| 🎮 **GameDev Mentor** | Game Dev | Experienced game developer and mentor |
| ⚡ **Minimalist** | Lifestyle | Extremely concise responses |
| 🔍 **Code Reviewer** | Engineering | Thorough, constructive code reviewer |
| 📚 **Coding Tutor** | Education | Patient programming teacher |
| 📋 **Personal Assistant** | Lifestyle | Proactive daily life assistant |
| 📝 **Tech Writer** | Writing | Clear technical documentation writer |
| 📊 **Data Analyst** | Data | Insight-driven data analyst |
| ✍️ **Storyteller** | Creative | Narrative crafter and worldbuilder |

Browse all at [clawsouls.ai](https://clawsouls.ai).

## What's in a Soul?

A soul is a directory with these files:

```
my-soul/
├── clawsoul.json    # Metadata (name, version, tags)
├── SOUL.md          # Personality & behavior
├── IDENTITY.md      # Name, emoji, avatar
├── AGENTS.md        # Workflow & rules
├── HEARTBEAT.md     # Periodic task config
└── README.md        # Documentation
```

The spec is open — see [Soul Spec](https://github.com/clawsouls/clawsouls/blob/main/docs/SOUL_SPEC.md).

## How It Works

```
┌─────────────┐     install     ┌──────────────┐
│  Registry    │ ──────────────→│ ~/.openclaw/  │
│  (GitHub)    │                │   souls/brad/ │
└─────────────┘                └──────┬───────┘
                                      │ use
                                      ▼
                               ┌──────────────┐
                               │ ~/.openclaw/  │
                               │  workspace/   │
                               │  ├ SOUL.md    │
                               │  ├ IDENTITY.md│
                               │  └ AGENTS.md  │
                               └──────────────┘
```

1. **Install** downloads soul files to `~/.openclaw/souls/<name>/`
2. **Use** backs up your workspace, then copies soul files in
3. **Restart** your OpenClaw session to load the new personality

## Links

- 🌐 [clawsouls.ai](https://clawsouls.ai) — Browse souls
- 📦 [npm](https://www.npmjs.com/package/clawsouls) — Package
- 📋 [Soul Spec](https://github.com/clawsouls/clawsouls/blob/main/docs/SOUL_SPEC.md) — Create your own
- 🐙 [GitHub Org](https://github.com/clawsouls) — Source code

## License

Apache 2.0 — see [LICENSE](LICENSE).
