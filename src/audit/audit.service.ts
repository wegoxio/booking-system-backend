import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';

export type CreateAuditLogInput = {
  actor_user_id: string;
  tenant_id: string | null;
  action: string;
  entity?: string | null;
  entity_id?: string | null;
  metadata?: Record<string, any> | null;
  ip?: string | null;
  user_agent?: string | null;
};

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
  ) {}

  async log(input: CreateAuditLogInput): Promise<AuditLog> {
    const auditLog = this.auditLogRepository.create({
      actor_user_id: input.actor_user_id,
      tenant_id: input.tenant_id,
      action: input.action,
      entity: input.entity ?? null,
      entity_id: input.entity_id ?? null,
      metadata: input.metadata ?? null,
      ip: input.ip ?? null,
      user_agent: input.user_agent ?? null,
    });

    return this.auditLogRepository.save(auditLog);
  }
}