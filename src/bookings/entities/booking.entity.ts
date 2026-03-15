import { TenantBaseEntity } from 'src/common/entities/tenant-base-entity';
import { Employee } from 'src/employees/entities/employee.entity';
import { Tenant } from 'src/tenant/entities/tenant.entity';
import { User } from 'src/users/entities/user.entity';
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { BookingItem } from './booking-item.entity';

@Entity('bookings')
@Index('IDX_bookings_tenant_start', ['tenant_id', 'start_at_utc'])
@Index('IDX_bookings_tenant_employee_start', ['tenant_id', 'employee_id', 'start_at_utc'])
export class Booking extends TenantBaseEntity {
  @Index('IDX_bookings_employee_id')
  @Column({ type: 'uuid' })
  employee_id: string;

  @ManyToOne(() => Employee, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ type: 'timestamptz' })
  start_at_utc: Date;

  @Column({ type: 'timestamptz' })
  end_at_utc: Date;

  @Index('IDX_bookings_status')
  @Column({ type: 'varchar', length: 20 })
  status: string;

  @Column({ type: 'int' })
  total_duration_minutes: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  total_price: string;

  @Column({ type: 'varchar', length: 3, default: 'USD' })
  currency: string;

  @Column({ type: 'varchar', length: 120 })
  customer_name: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  customer_email: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  customer_phone: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'varchar', length: 20, default: 'ADMIN' })
  source: string;

  @Column({ type: 'uuid', nullable: true })
  created_by_user_id: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'created_by_user_id' })
  created_by_user: User | null;

  @OneToMany(() => BookingItem, (item) => item.booking, {
    cascade: ['insert', 'update'],
    eager: true,
  })
  items: BookingItem[];
}
