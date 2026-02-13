import { z } from 'zod';

export const ClawSoulSchema = z.object({
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
  repository: z.string().url().optional(),
});

export type ClawSoul = z.infer<typeof ClawSoulSchema>;

export function validateClawSoul(data: unknown): ClawSoul {
  return ClawSoulSchema.parse(data);
}
