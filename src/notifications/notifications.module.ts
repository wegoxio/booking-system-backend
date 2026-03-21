import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantSettingsModule } from '../tenant-settings/tenant-settings.module';
import { Tenant } from '../tenant/entities/tenant.entity';
import { User } from '../users/entities/user.entity';
import { NotificationsService } from './notifications.service';
import { EMAIL_PROVIDER } from './providers/email-provider.interface';
import { ResendEmailProvider } from './providers/resend-email.provider';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([User, Tenant]),
    TenantSettingsModule,
  ],
  providers: [
    NotificationsService,
    ResendEmailProvider,
    {
      provide: EMAIL_PROVIDER,
      useExisting: ResendEmailProvider,
    },
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
