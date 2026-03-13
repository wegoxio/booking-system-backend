import { BaseEntity } from 'src/common/entities/base.entity';
import { Column, Entity, Index, Unique } from 'typeorm';

@Entity('platform_settings')
@Unique('UQ_platform_settings_scope', ['scope'])
export class PlatformSetting extends BaseEntity {
  @Index('IDX_platform_settings_scope')
  @Column({ type: 'varchar', default: 'WEGOX' })
  scope: string;

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
