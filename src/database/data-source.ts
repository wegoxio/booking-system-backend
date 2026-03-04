import * as dotenv from 'dotenv';
import { AuditLog } from 'src/audit/entities/audit-log.entity';
import { Tenant } from 'src/tenant/entities/tenant.entity';
import { User } from 'src/users/entities/user.entity';
dotenv.config();

import { DataSource } from 'typeorm';

export const AppDataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,

    entities: [User, Tenant, AuditLog],
    migrations: ['src/database/migrations/*.ts'],

    synchronize: false,
});