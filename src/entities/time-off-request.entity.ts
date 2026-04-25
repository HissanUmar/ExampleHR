import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn
} from 'typeorm';
import { RequestStatus } from '../common/enums';

@Entity('time_off_request')
export class TimeOffRequestEntity {
  @PrimaryColumn({ type: 'text' })
  id!: string;

  @Column({ name: 'employee_id' })
  employeeId!: string;

  @Column({ name: 'location_id' })
  locationId!: string;

  @Column({ name: 'leave_type' })
  leaveType!: string;

  @Column({ name: 'start_date', type: 'date' })
  startDate!: string;

  @Column({ name: 'end_date', type: 'date' })
  endDate!: string;

  @Column({ name: 'days_requested', type: 'real' })
  daysRequested!: number;

  @Column({
    type: 'text',
    default: RequestStatus.PENDING
  })
  status!: RequestStatus;

  @Column({ name: 'manager_id', type: 'text', nullable: true })
  managerId!: string | null;

  @Column({ name: 'manager_note', type: 'text', nullable: true })
  managerNote!: string | null;

  @Column({ name: 'hcm_ref_id', type: 'text', nullable: true })
  hcmRefId!: string | null;

  @Column({ name: 'hcm_submitted_at', type: 'datetime', nullable: true })
  hcmSubmittedAt!: Date | null;

  @Column({ name: 'failure_reason', type: 'text', nullable: true })
  failureReason!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt!: Date;
}
