import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from 'typeorm';

@Entity('leave_balance')
@Index(['employeeId', 'locationId', 'leaveType'], { unique: true })
export class LeaveBalanceEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'employee_id' })
  employeeId!: string;

  @Column({ name: 'location_id' })
  locationId!: string;

  @Column({ name: 'leave_type' })
  leaveType!: string;

  @Column({ name: 'balance_days', type: 'real' })
  balanceDays!: number;

  @Column({ name: 'hcm_balance_days', type: 'real' })
  hcmBalanceDays!: number;

  @Column({ name: 'last_synced_at', type: 'datetime' })
  lastSyncedAt!: Date;

  @Column({ type: 'integer', default: 1 })
  version!: number;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt!: Date;
}
