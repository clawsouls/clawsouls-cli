# 🧠 ClawSouls CLI

**Give your AI a soul.** Install, manage, and switch AI agent personas — works with any SOUL.md-compatible agent.

[![npm](https://img.shields.io/npm/v/clawsouls)](https://www.npmjs.com/package/clawsouls)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue)](LICENSE)

## What is ClawSouls?

ClawSouls is a persona sharing platform for AI agents. A **Soul** is a personality package — a set of markdown files that define how your AI thinks, talks, and behaves. Same LLM, completely different personality.

Browse available souls at [clawsouls.ai](https://clawsouls.ai).

## Multi-Platform Support

ClawSouls works with **any SOUL.md-compatible agent framework**. The CLI auto-detects your installed platform and applies souls to the correct workspace.

| Platform | Directory | Status |
|----------|-----------|--------|
| **OpenClaw** | `~/.openclaw/workspace/` | ✅ Auto-detected |
| **ZeroClaw** | `~/.zeroclaw/workspace/` | ✅ Auto-detected |
| **Clawdbot** | `~/.clawdbot/workspace/` | ✅ Auto-detected |
| **Moltbot** | `~/.moltbot/workspace/` | ✅ Auto-detected |
| **Moldbot** | `~/.moldbot/workspace/` | ✅ Auto-detected |
| **Custom** | Any path | ✅ Via `--workspace` or `--platform` |

### How It Works

```
┌──────────────────────────────────────────────────┐
│  clawsouls install clawsouls/surgical-coder      │
│  clawsouls use surgical-coder                    │
└──────────────┬───────────────────────────────────┘
               │
               ▼  Auto-detect installed platform
      ┌────────────────────┐
      │  ~/.openclaw/ ?    │──yes──▶ Apply to ~/.openclaw/workspace/
      │  ~/.zeroclaw/ ?    │──yes──▶ Apply to ~/.zeroclaw/workspace/
      │  ~/.clawdbot/ ?    │──yes──▶ Apply to ~/.clawdbot/workspace/
      │  ~/.moltbot/ ?     │──yes──▶ Apply to ~/.moltbot/workspace/
      │  ~/.moldbot/ ?     │──yes──▶ Apply to ~/.moldbot/workspace/
      │  --workspace path  │──yes──▶ Apply to custom path
      └────────────────────┘
```

1. **Install** downloads soul files to `~/<platform>/souls/<owner>/<name>/`
2. **Use** copies soul files (SOUL.md, IDENTITY.md, etc.) to the workspace
3. **Protected files** (USER.md, MEMORY.md, TOOLS.md) are **never overwritten**
4. **Automatic backup** before every switch — revert with `clawsouls restore`

### Override Platform

```bash
# Explicit platform flag
clawsouls --platform zeroclaw use surgical-coder

# Custom workspace path
clawsouls --workspace ~/my-agent/workspace use surgical-coder

# Environment variable
CLAWSOULS_PLATFORM=clawdbot clawsouls use surgical-coder

# Check detection
clawsouls platform
```

## Quick Start

```bash
# Install a soul (owner/name format)
npx clawsouls install clawsouls/surgical-coder

# Activate it (backs up your current workspace)
npx clawsouls use surgical-coder

# Restart your agent session — done!
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

### `clawsouls platform`

Show detected agent platform(s) and workspace path.

```bash
clawsouls platform

# 🔍 Agent Platform Detection
#
# ▶ Active: OpenClaw 🦞
#   Workspace: /home/user/.openclaw/workspace
#   Souls dir: /home/user/.openclaw/souls
#   Restart:   openclaw gateway restart
```

### `clawsouls init [name]`

Scaffold a new soul package directory with template files.

```bash
clawsouls init my-soul
```

Creates a directory with `soul.json`, `SOUL.md`, `IDENTITY.md`, `AGENTS.md`, `HEARTBEAT.md`, and `README.md` — ready for customization and publishing.

### `clawsouls install <owner/name[@version]>`

Download and install a soul from the registry. Uses `owner/name` format (e.g., `clawsouls/surgical-coder`). Optionally specify a version with `@version` (e.g., `clawsouls/surgical-coder@0.1.0`). Without a version, installs the latest.

```bash
clawsouls install clawsouls/minimalist
clawsouls install clawsouls/devops-veteran
clawsouls install clawsouls/surgical-coder --force     # overwrite existing
clawsouls install clawsouls/surgical-coder@0.1.0       # specific version
```

### `clawsouls use <name>`

Activate an installed soul. Your current workspace files are automatically backed up before switching.

```bash
clawsouls use minimalist
```

**Automatic backup:** Before applying a new soul, the current workspace files (SOUL.md, IDENTITY.md, AGENTS.md, HEARTBEAT.md) are saved to `~/<platform>/souls/_backup/<timestamp>/`. You can always revert with `clawsouls restore`.

**Protected files** — these are never overwritten:
- `USER.md` (your personal data)
- `MEMORY.md` (your AI's memories)
- `TOOLS.md` (your tool configuration)

### `clawsouls restore`

Revert to your previous soul from the latest backup.

```bash
clawsouls restore
```

### `clawsouls list`

List installed souls.

```bash
clawsouls list
clawsouls ls
```

### `clawsouls validate [dir]`

Validate a soul package against the Soul Spec.

```bash
clawsouls validate              # validate current directory
clawsouls validate ./my-soul    # validate specific directory
clawsouls validate --soulscan   # include SoulScan security analysis
```

### `clawsouls soulscan [dir]`

Run SoulScan™ security and quality analysis on a soul package or active workspace.

```bash
clawsouls soulscan                # scan active workspace
clawsouls soulscan ./my-soul      # scan specific directory
clawsouls soulscan -q             # quiet mode (for cron)
clawsouls soulscan --init         # initialize baseline checksums
```

### `clawsouls publish <dir>`

Publish a soul package to the registry.

```bash
clawsouls login <token>           # authenticate first
clawsouls publish ./my-soul       # publish to clawsouls.ai
```

## Soul Spec

Souls follow the [Soul Spec](https://clawsouls.ai/spec) — an open specification for AI agent persona packages. A soul package contains:

```
my-soul/
├── soul.json       # Metadata (name, version, tags, compatibility)
├── SOUL.md         # Persona, tone, and boundaries
├── IDENTITY.md     # Name, avatar, and vibe
├── AGENTS.md       # Operating instructions
├── HEARTBEAT.md    # Periodic check behavior
└── README.md       # Human-readable description
```

## Security

All souls on [clawsouls.ai](https://clawsouls.ai) are automatically scanned by **SoulScan™** — our security engine that checks for prompt injection, data exfiltration, harmful content, and 50+ other patterns.

## Links

- 🌐 [clawsouls.ai](https://clawsouls.ai) — Browse souls
- 📖 [Soul Spec](https://clawsouls.ai/spec) — Open specification
- 🔒 [SoulScan](https://clawsouls.ai/soulscan) — Security scanner
- 📜 [Manifesto](https://clawsouls.ai/manifesto) — Our philosophy
- 📄 [Research Paper](https://doi.org/10.5281/zenodo.18678616) — Academic foundation

## License

Apache-2.0
