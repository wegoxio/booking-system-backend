import { Column, Entity, Index, ManyToOne, JoinColumn } from 'typeorm';
import { Tenant } from '../../tenant/entities/tenant.entity';
import { BaseEntity } from 'src/common/entities/base.entity';

export type UserRole = 'SUPER_ADMIN' | 'TENANT_ADMIN';

@Entity('users')
export class User extends BaseEntity {

  @Column()
  name: string;

  @Index({ unique: true })
  @Column()
  email: string;

  @Column({ type: 'varchar', nullable: true })
  password_hash: string | null;

  @Column({
    type: 'varchar'
  })
  role: UserRole;

  @Column({ type: 'uuid', nullable: true })
  tenant_id: string | null;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant | null;

  @Column({ default: true })
  is_active: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  email_verified_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  invited_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  onboarding_completed_at: Date | null;

  @Column({ type: 'integer', default: 0 })
  token_version: number;

  @Column({ type: 'integer', default: 0 })
  failed_login_attempts: number;

  @Column({ type: 'timestamptz', nullable: true })
  last_failed_login_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  locked_until: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  last_login_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  tenant_dashboard_tour_completed_at: Date | null;
}
