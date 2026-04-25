import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('balance_audit_log')
export class BalanceAuditLogEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'employee_id' })
  employeeId!: string;

  @Column({ name: 'location_id' })
  locationId!: string;

  @Column({ name: 'leave_type' })
  leaveType!: string;

  @Column({ name: 'delta_days', type: 'real' })
  deltaDays!: number;

  @Column({ name: 'balance_after', type: 'real' })
  balanceAfter!: number;

  @Column({ type: 'text' })
  source!: string;

  @Column({ name: 'reference_id', type: 'text', nullable: true })
  referenceId!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;
}
