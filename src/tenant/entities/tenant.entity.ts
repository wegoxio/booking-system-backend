import { BaseEntity } from 'src/common/entities/base.entity';
import { Column, Entity, Index } from 'typeorm';


@Entity('tenants')
export class Tenant extends BaseEntity {

  @Column()
  name: string;

  @Index({ unique: true })
  @Column()
  slug: string;

  @Column({
    type: 'boolean',
    default: true
  })
  is_active: boolean;
}