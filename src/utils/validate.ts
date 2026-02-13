import { z } from 'zod';

// ─── v0.1 Schema ───────────────────────────────────────────
export const ClawSoulSchemaV01 = z.object({
  name: z.string().regex(/^[a-z0-9-]+$/, 'Must be kebab-case'),
  displayName: z.string().min(1),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, 'Must be semver'),
  description: z.string().max(160),
  author: z.object({
    name: z.string(),
    github: z.string().optional(),
  }),
  license: z.string(),
  tags: z.array(z.string()).max(10),
  category: z.string(),
  compatibility: z.object({
    openclaw: z.string().optional(),
    models: z.array(z.string()).optional(),
  }).optional(),
  files: z.object({
    soul: z.string(),
    identity: z.string().optional(),
    agents: z.string().optional(),
    heartbeat: z.string().optional(),
    userTemplate: z.string().optional(),
    avatar: z.string().optional(),
  }),
  repository: z.string().url().optional(),
});

// ─── v0.2 Schema (extends v0.1 with STYLE.md, modes, interpolation, examples, skills) ───
export const ClawSoulSchemaV02 = ClawSoulSchemaV01.extend({
  files: z.object({
    soul: z.string(),
    identity: z.string().optional(),
    agents: z.string().optional(),
    heartbeat: z.string().optional(),
    style: z.string().optional(),
    userTemplate: z.string().optional(),
    avatar: z.string().optional(),
  }),
  examples: z.object({
    good: z.string().optional(),
    bad: z.string().optional(),
  }).optional(),
  modes: z.array(z.string()).optional(),
  interpolation: z.enum(['bold', 'cautious', 'strict']).optional(),
  skills: z.array(z.string()).optional(),
});

// ─── Version Registry ──────────────────────────────────────
export const SPEC_VERSIONS = {
  '0.1': ClawSoulSchemaV01,
  '0.2': ClawSoulSchemaV02,
} as const;

export type SpecVersion = keyof typeof SPEC_VERSIONS;
export const LATEST_SPEC: SpecVersion = '0.2';

// Default export = latest
export const ClawSoulSchema = SPEC_VERSIONS[LATEST_SPEC];
export type ClawSoul = z.infer<typeof ClawSoulSchemaV02>;

export function getSchema(version?: string): z.ZodType {
  if (!version) return ClawSoulSchema;
  const v = version.replace(/^v/, '') as SpecVersion;
  const schema = SPEC_VERSIONS[v];
  if (!schema) {
    const available = Object.keys(SPEC_VERSIONS).join(', ');
    throw new Error(`Unknown spec version "${version}". Available: ${available}`);
  }
  return schema;
}

export function validateClawSoul(data: unknown, version?: string): ClawSoul {
  const schema = getSchema(version);
  return schema.parse(data) as ClawSoul;
}
