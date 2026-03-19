import {
  Column,
  Entity,
  Index,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Tenant } from '../../tenant/entities/tenant.entity';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Quién ejecutó la acción (superadmin o tenant admin)
  @Index()
  @Column({ type: 'uuid', nullable: true })
  actor_user_id: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'actor_user_id' })
  actor?: User;

  // Sobre qué tenant aplica (nullable porque superadmin puede hacer acciones globales)
  @Index()
  @Column({ type: 'uuid', nullable: true })
  tenant_id: string | null;

  @ManyToOne(() => Tenant, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'tenant_id' })
  tenant?: Tenant | null;

  // Acción: "TENANT_DISABLED", "RESOURCE_CREATED", etc.
  @Index()
  @Column({ type: 'varchar' })
  action: string;

  // Mensaje legible para usuario final
  @Column({ type: 'varchar', length: 240, nullable: true })
  message: string | null;

  // Opcional: entidad afectada y su id
  @Column({ type: 'varchar', nullable: true })
  entity: string | null;

  @Column({ type: 'varchar', nullable: true })
  entity_id: string | null;

  // Detalles extra (cambios, payload, etc.)
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  // Contexto técnico (opcional pero útil)
  @Column({ type: 'varchar', nullable: true })
  ip: string | null;

  @Column({ type: 'varchar', nullable: true })
  user_agent: string | null;

  // Solo created_at (logs no se “editan”)
  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
