import 'dotenv/config';
import { DataSource } from 'typeorm';

import { AuditLog } from 'src/audit/entities/audit-log.entity';
import { Tenant } from 'src/tenant/entities/tenant.entity';
import { User } from 'src/users/entities/user.entity';

function envBool(name: string, defaultValue = false): boolean {
    const v = process.env[name];
    if (v === undefined) return defaultValue;
    return ['true', '1', 'yes'].includes(v.trim().toLowerCase());
}

function envNumber(name: string, defaultValue?: number): number {
    const v = process.env[name];
    if (v === undefined || v.trim() === '') {
        if (defaultValue === undefined) throw new Error(`Missing env: ${name}`);
        return defaultValue;
    }
    const n = Number(v);
    if (Number.isNaN(n)) throw new Error(`Invalid number env ${name}: "${v}"`);
    return n;
}

export const AppDataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST ?? 'localhost',
    port: envNumber('DB_PORT', 5432),
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,

    // SSL: solo si DB_SSL=true
    ssl: envBool('DB_SSL', false) ? { rejectUnauthorized: false } : false,

    logging: envBool('DB_LOGGING', false),

    entities: [User, Tenant, AuditLog],
    migrations: ['src/database/migrations/*.ts'],
    synchronize: false,
});