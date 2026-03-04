import { z } from 'zod';

export const envSchema = z.object({
  // App
  NODE_ENV: z.string().default('development'),
  PORT: z.coerce.number().default(3000),

  // Database
  DB_HOST: z.string(),
  DB_PORT: z.coerce.number(),
  DB_USER: z.string(),
  DB_PASSWORD: z.string(),
  DB_NAME: z.string(),
  DB_SSL: z.coerce.boolean().default(false),
  DB_LOGGING: z.coerce.boolean().default(false),

  // Auth (JWT)
  JWT_SECRET: z.string().min(10),
  JWT_EXPIRES_IN: z.string().default('3600s'),

  // Argon2
  ARGON2_MEMORY_COST: z.coerce.number().default(65536),
  ARGON2_TIME_COST: z.coerce.number().default(3),
  ARGON2_PARALLELISM: z.coerce.number().default(1),
});

export type EnvVars = z.infer<typeof envSchema>;