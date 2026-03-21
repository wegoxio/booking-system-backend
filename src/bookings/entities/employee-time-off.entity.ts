import { TenantBaseEntity } from '../../common/entities/tenant-base-entity';
import { Employee } from '../../employees/entities/employee.entity';
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
} from 'typeorm';

@Entity('employee_time_off')
@Index('IDX_employee_time_off_range', ['tenant_id', 'employee_id', 'start_at_utc', 'end_at_utc'])
export class EmployeeTimeOff extends TenantBaseEntity {
  @Index('IDX_employee_time_off_employee_id')
  @Column({ type: 'uuid' })
  employee_id: string;

  @ManyToOne(() => Employee, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;

  @Column({ type: 'timestamptz' })
  start_at_utc: Date;

  @Column({ type: 'timestamptz' })
  end_at_utc: Date;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;
}
