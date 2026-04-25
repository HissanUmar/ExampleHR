import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('failed_hcm_job')
export class FailedHcmJobEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'text' })
  requestId!: string;

  @Column({ type: 'integer', default: 0 })
  attempt!: number;

  @Column({ name: 'next_run_at', type: 'datetime' })
  nextRunAt!: Date;

  @Column({ type: 'text' })
  operation!: string;

  @Column({ type: 'text' })
  payload!: string;

  @Column({ type: 'text', default: 'PENDING' })
  status!: string;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt!: Date;
}
