import { BaseEntity } from 'src/common/entities/base.entity';
import { Tenant } from 'src/tenant/entities/tenant.entity';
import { Column, Entity, Index, JoinColumn, OneToOne, Unique } from 'typeorm';

@Entity('tenant_settings')
@Unique('UQ_tenant_settings_tenant_id', ['tenant_id'])
export class TenantSetting extends BaseEntity {
  @Index('IDX_tenant_settings_tenant_id')
  @Column({ type: 'uuid' })
  tenant_id: string;

  @OneToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({
    type: 'jsonb',
    default: () => "'{}'",
  })
  theme: Record<string, string>;

  @Column({
    type: 'jsonb',
    default: () => "'{}'",
  })
  branding: Record<string, string>;

  @Column({ type: 'varchar', nullable: true })
  logo_key: string | null;

  @Column({ type: 'varchar', nullable: true })
  favicon_key: string | null;
}
