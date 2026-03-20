import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';
import { resolveAuditMessage } from './audit-message.utils';
import { AuditLogListItem, CreateAuditLogInput, ListAuditLogsInput } from './types';
import { CurrentJwtUser } from 'src/auth/types';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
  ) {}

  async log(input: CreateAuditLogInput): Promise<AuditLog> {
    const resolvedMessage = resolveAuditMessage({
      action: input.action,
      message: input.message,
      metadata: input.metadata,
    });

    const auditLog = this.auditLogRepository.create({
      actor_user_id: input.actor_user_id,
      tenant_id: input.tenant_id,
      action: input.action,
      message: resolvedMessage,
      entity: input.entity ?? null,
      entity_id: input.entity_id ?? null,
      metadata: input.metadata ?? null,
      ip: input.ip ?? null,
      user_agent: input.user_agent ?? null,
    });

    return this.auditLogRepository.save(auditLog);
  }

  async list(
    input: ListAuditLogsInput,
    currentUser: CurrentJwtUser,
  ): Promise<{
    data: AuditLogListItem[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      total_pages: number;
    };
  }> {
    const page = this.normalizePage(input.page);
    const limit = this.normalizeLimit(input.limit);

    const qb = this.auditLogRepository
      .createQueryBuilder('audit')
      .leftJoinAndSelect('audit.actor', 'actor')
      .leftJoinAndSelect('audit.tenant', 'tenant');

    if (currentUser.role === 'TENANT_ADMIN') {
      if (!currentUser.tenant_id) {
        throw new BadRequestException('El contexto del negocio es obligatorio.');
      }
      qb.andWhere('audit.tenant_id = :tenantId', {
        tenantId: currentUser.tenant_id,
      });
    } else if (input.tenant_id) {
      qb.andWhere('audit.tenant_id = :tenantId', {
        tenantId: input.tenant_id,
      });
    }

    if (input.actor_user_id) {
      qb.andWhere('audit.actor_user_id = :actorUserId', {
        actorUserId: input.actor_user_id,
      });
    }

    if (input.action?.trim()) {
      qb.andWhere('audit.action = :action', {
        action: input.action.trim().toUpperCase(),
      });
    }

    if (input.entity?.trim()) {
      qb.andWhere('audit.entity = :entity', {
        entity: input.entity.trim().toLowerCase(),
      });
    }

    if (input.employee_id?.trim()) {
      const employeeId = input.employee_id.trim();
      qb.andWhere(
        new Brackets((subQb) => {
          subQb
            .where(
              '(audit.entity = :employeeEntity AND audit.entity_id = :employeeId)',
              {
                employeeEntity: 'employee',
                employeeId,
              },
            )
            .orWhere(`audit.metadata ->> 'employee_id' = :employeeId`, {
              employeeId,
            });
        }),
      );
    }

    if (input.date?.trim()) {
      const { start, end } = this.getUtcRangeForDate(input.date.trim());
      qb.andWhere('audit.created_at >= :dateStart AND audit.created_at < :dateEnd', {
        dateStart: start,
        dateEnd: end,
      });
    } else {
      if (input.date_from?.trim()) {
        const { start } = this.getUtcRangeForDate(input.date_from.trim());
        qb.andWhere('audit.created_at >= :dateFrom', { dateFrom: start });
      }
      if (input.date_to?.trim()) {
        const { end } = this.getUtcRangeForDate(input.date_to.trim());
        qb.andWhere('audit.created_at < :dateTo', { dateTo: end });
      }
    }

    if (input.q?.trim()) {
      const queryText = `%${input.q.trim()}%`;
      qb.andWhere(
        new Brackets((subQb) => {
          subQb
            .where('audit.action ILIKE :queryText', { queryText })
            .orWhere('COALESCE(audit.message, \'\') ILIKE :queryText', { queryText })
            .orWhere('COALESCE(audit.entity, \'\') ILIKE :queryText', { queryText })
            .orWhere('COALESCE(audit.entity_id, \'\') ILIKE :queryText', { queryText })
            .orWhere('COALESCE(actor.name, \'\') ILIKE :queryText', { queryText })
            .orWhere('COALESCE(actor.email, \'\') ILIKE :queryText', { queryText })
            .orWhere('COALESCE(tenant.name, \'\') ILIKE :queryText', { queryText })
            .orWhere('CAST(COALESCE(audit.metadata, \'{}\') AS text) ILIKE :queryText', {
              queryText,
            });
        }),
      );
    }

    qb.orderBy('audit.created_at', 'DESC');
    qb.skip((page - 1) * limit).take(limit);

    const [rows, total] = await qb.getManyAndCount();

    const data = rows.map((row) => ({
      id: row.id,
      created_at: row.created_at,
      action: row.action,
      message: resolveAuditMessage({
        action: row.action,
        message: row.message,
        metadata: row.metadata,
      }),
      entity: row.entity,
      entity_id: row.entity_id,
      metadata: row.metadata,
      ip: row.ip,
      user_agent: row.user_agent,
      actor: row.actor
        ? {
            id: row.actor.id,
            name: row.actor.name,
            email: row.actor.email,
            role: row.actor.role,
          }
        : null,
      tenant: row.tenant
        ? {
            id: row.tenant.id,
            name: row.tenant.name,
            slug: row.tenant.slug,
            is_active: row.tenant.is_active,
          }
        : null,
    }));

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  private normalizePage(value?: number): number {
    if (!value || Number.isNaN(value)) return 1;
    return Math.max(1, Math.floor(value));
  }

  private normalizeLimit(value?: number): number {
    if (!value || Number.isNaN(value)) return 50;
    return Math.min(200, Math.max(10, Math.floor(value)));
  }

  private getUtcRangeForDate(value: string): { start: Date; end: Date } {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new BadRequestException('Formato de fecha inválido. Usa YYYY-MM-DD');
    }

    const start = new Date(`${value}T00:00:00.000Z`);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);

    return { start, end };
  }
}
