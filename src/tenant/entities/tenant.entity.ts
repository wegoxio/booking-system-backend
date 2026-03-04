import { BaseEntity } from 'src/common/entities/base.entity';
import { Column, Entity, Index } from 'typeorm';

export type TenantStatus = 'ACTIVE' | 'DISABLED';

@Entity('tenants')
export class Tenant extends BaseEntity {

  @Column()
  name: string;

  @Index({ unique: true })
  @Column()
  slug: string;

  @Column({
    type: 'varchar',
    default: 'ACTIVE'
  })
  status: TenantStatus;
}