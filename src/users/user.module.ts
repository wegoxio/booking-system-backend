import { Module } from '@nestjs/common';
import { UsersController } from './user.controller';
import { UserService } from './user.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Tenant } from '../tenant/entities/tenant.entity';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { AuthSession } from '../auth/entities/auth-session.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Tenant, AuthSession]),
    AuditModule,
    AuthModule,
  ],
  controllers: [UsersController],
  providers: [UserService],
})
export class UsersModule {}
