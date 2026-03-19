import { BaseEntity } from 'src/common/entities/base.entity';
import { Service } from 'src/services/entity/service.entity';
import { Tenant } from 'src/tenant/entities/tenant.entity';
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToMany,
  ManyToOne,
  Unique,
} from 'typeorm';

@Entity('employees')
@Unique('UQ_employees_tenant_email', ['tenant_id', 'email'])
export class Employee extends BaseEntity {
  @Index('IDX_employees_tenant_id')
  @Column({ type: 'uuid' })
  tenant_id: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'varchar', length: 255 })
  email: string;

  @Column({ type: 'varchar', length: 30, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 2, nullable: true })
  phone_country_iso2: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone_national_number: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone_e164: string | null;

  @Column({ type: 'varchar', length: 2048, nullable: true })
  avatar_url: string | null;

  @Column({ type: 'varchar', length: 512, nullable: true })
  avatar_key: string | null;

  @Column({ type: 'varchar', length: 64, default: 'UTC' })
  schedule_timezone: string;

  @Column({ type: 'int', default: 15 })
  slot_interval_minutes: number;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @ManyToMany(() => Service, (service) => service.employees)
  services: Service[];
}
