import {
  Column,
  Entity,
  Index,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  Unique,
} from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Tenant } from '../../tenant/entities/tenant.entity';
import { Employee } from '../../employees/entities/employee.entity';

@Entity('services')
@Unique('UQ_services_tenant_name', ['tenant_id', 'name'])
export class Service extends BaseEntity {
  @Index('IDX_services_tenant_id')
  @Column({ type: 'uuid' })
  tenant_id: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'text', nullable: true })
  instructions: string | null;

  @Column({ type: 'int' })
  duration_minutes: number;

  @Column({ type: 'int', default: 0 })
  buffer_before_minutes: number;

  @Column({ type: 'int', default: 0 })
  buffer_after_minutes: number;

  @Column({ type: 'int', default: 1 })
  capacity: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  price: string;

  @Column({ type: 'varchar', length: 3, default: 'USD' })
  currency: string;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @Column({ type: 'int', default: 0 })
  sort_order: number;

  @Column({ type: 'boolean', default: false })
  requires_confirmation: boolean;

  @Column({ type: 'int', default: 0 })
  min_notice_minutes: number;

  @Column({ type: 'int', default: 60 })
  booking_window_days: number;

  @ManyToMany(() => Employee, (employee) => employee.services, { eager: true })
  @JoinTable({
    name: 'service_employees',
    joinColumn: { name: 'service_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'employee_id', referencedColumnName: 'id' },
  })
  employees: Employee[];
}
