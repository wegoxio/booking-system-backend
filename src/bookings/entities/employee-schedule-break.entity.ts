import { TenantBaseEntity } from 'src/common/entities/tenant-base-entity';
import { Employee } from 'src/employees/entities/employee.entity';
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  Unique,
} from 'typeorm';

@Entity('employee_schedule_breaks')
@Unique('UQ_employee_schedule_break', [
  'tenant_id',
  'employee_id',
  'day_of_week',
  'start_time_local',
  'end_time_local',
])
export class EmployeeScheduleBreak extends TenantBaseEntity {
  @Index('IDX_employee_schedule_breaks_employee_id')
  @Column({ type: 'uuid' })
  employee_id: string;

  @ManyToOne(() => Employee, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;

  @Column({ type: 'smallint' })
  day_of_week: number;

  @Column({ type: 'time without time zone' })
  start_time_local: string;

  @Column({ type: 'time without time zone' })
  end_time_local: string;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;
}
