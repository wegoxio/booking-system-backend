import { BaseEntity } from 'src/common/entities/base.entity';
import { Column, Entity, Index, Unique } from 'typeorm';

@Entity('platform_settings')
@Unique('UQ_platform_settings_scope', ['scope'])
export class PlatformSetting extends BaseEntity {
  @Index('IDX_platform_settings_scope')
  @Column({ type: 'varchar', default: 'WEGOX' })
  scope: string;

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
