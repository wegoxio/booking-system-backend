import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { TenantModule } from './tenant/tenant.module';
import { UsersModule } from './users/user.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { validateEnv } from './config/env.validation';
import { TypeOrmModule } from '@nestjs/typeorm';
import { makeTypeOrmConfig } from './database/typeorm.config';
import { AuditModule } from './audit/audit.module';
import { ServicesModule } from './services/services.module';
import { EmployeesModule } from './employees/employees.module';

@Module({
  imports: [
    AuthModule,
    TenantModule,
    UsersModule,
    AuditModule,
    ServicesModule,
    EmployeesModule,
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv
    }),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => makeTypeOrmConfig(config),
    }),
  ],
  controllers: [],
  providers: [],
})
export class AppModule { }
