import { BaseEntity } from '../../common/entities/base.entity';
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
    default: true,
  })
  is_active: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  address_line: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  city: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  state: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  country: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  postal_code: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  public_email: string | null;
}
