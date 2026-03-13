import { Module } from '@nestjs/common';
import { UsersController } from './user.controller';
import { UserService } from './user.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Tenant } from 'src/tenant/entities/tenant.entity';
import { AuditModule } from 'src/audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Tenant]),
    AuditModule,
  ],
  controllers: [UsersController],
  providers: [UserService],
})
export class UsersModule {}
