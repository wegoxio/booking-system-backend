import 'dotenv/config';
import { DataSource } from 'typeorm';

import { AuditLog } from '../audit/entities/audit-log.entity';
import { Tenant } from '../tenant/entities/tenant.entity';
import { User } from '../users/entities/user.entity';
import { Service } from '../services/entity/service.entity';
import { Employee } from '../employees/entities/employee.entity';
import { TenantSetting } from '../tenant-settings/entities/tenant-setting.entity';
import { PlatformSetting } from '../tenant-settings/entities/platform-setting.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { BookingItem } from '../bookings/entities/booking-item.entity';
import { EmployeeScheduleRule } from '../bookings/entities/employee-schedule-rule.entity';
import { EmployeeScheduleBreak } from '../bookings/entities/employee-schedule-break.entity';
import { EmployeeTimeOff } from '../bookings/entities/employee-time-off.entity';
import { AuthSession } from '../auth/entities/auth-session.entity';
import { UserAccessToken } from '../auth/entities/user-access-token.entity';
import { BookingReminder } from '../reminders/entities/booking-reminder.entity';

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

function resolvePoolMax(): number {
  if (process.env.DB_POOL_MAX?.trim()) {
    return envNumber('DB_POOL_MAX', 1);
  }

  const isProduction = (process.env.NODE_ENV ?? 'development') === 'production';
  const isServerlessRuntime = envBool('VERCEL', false) || !!process.env.AWS_LAMBDA_FUNCTION_NAME;

  return isProduction && isServerlessRuntime ? 1 : 10;
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
  extra: {
    max: resolvePoolMax(),
    idleTimeoutMillis: envNumber('DB_POOL_IDLE_TIMEOUT_MS', 10_000),
    connectionTimeoutMillis: envNumber('DB_POOL_CONNECTION_TIMEOUT_MS', 10_000),
    keepAlive: envBool('DB_POOL_KEEP_ALIVE', true),
  },

  entities: [
    User,
    Tenant,
    AuditLog,
    Service,
    Employee,
    Booking,
    BookingItem,
    EmployeeScheduleRule,
    EmployeeScheduleBreak,
    EmployeeTimeOff,
    AuthSession,
    UserAccessToken,
    BookingReminder,
    TenantSetting,
    PlatformSetting,
  ],
  migrations: ['src/database/migrations/*.ts'],
  synchronize: false,
});
