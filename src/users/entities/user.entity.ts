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

  @Column()
  password_hash: string;

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
}