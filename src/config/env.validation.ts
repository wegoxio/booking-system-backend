import { envSchema } from "./env.schema";

export function validateEnv(config: Record<string, unknown>) {
    const parsed = envSchema.safeParse(config);
    if (!parsed.success) {
        console.error('Configuracion incorrecta de las variables de entorno');
        console.error(parsed.error.format());
        throw new Error('Variables de entorno invalidas.');
    }
    return parsed.data;
}