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

  @Column({ name: 'primary_color', type: 'varchar', length: 9 })
  primary_color: string;

  @Column({ name: 'secondary_color', type: 'varchar', length: 9 })
  secondary_color: string;

  @Column({ name: 'tertiary_color', type: 'varchar', length: 9 })
  tertiary_color: string;

  @Column({ name: 'primary_hover_color', type: 'varchar', length: 9 })
  primary_hover_color: string;

  @Column({ name: 'secondary_hover_color', type: 'varchar', length: 9 })
  secondary_hover_color: string;

  @Column({ name: 'tertiary_hover_color', type: 'varchar', length: 9 })
  tertiary_hover_color: string;

  @Column({ name: 'text_primary_color', type: 'varchar', length: 9 })
  text_primary_color: string;

  @Column({ name: 'text_secondary_color', type: 'varchar', length: 9 })
  text_secondary_color: string;

  @Column({ name: 'text_tertiary_color', type: 'varchar', length: 9 })
  text_tertiary_color: string;

  @Column({ name: 'theme_mode', type: 'varchar', length: 16, default: 'AUTO' })
  theme_mode: string;

  @Column({ name: 'theme_overrides', type: 'jsonb', default: () => "'{}'" })
  theme_overrides: Record<string, string>;

  @Column({ name: 'app_name', type: 'varchar', length: 120 })
  app_name: string;

  @Column({ name: 'window_title', type: 'varchar', length: 160 })
  window_title: string;

  @Column({ name: 'logo_url', type: 'varchar', length: 2048 })
  logo_url: string;

  @Column({ name: 'favicon_url', type: 'varchar', length: 2048 })
  favicon_url: string;

  @Column({ type: 'varchar', nullable: true })
  logo_key: string | null;

  @Column({ type: 'varchar', nullable: true })
  favicon_key: string | null;
}
