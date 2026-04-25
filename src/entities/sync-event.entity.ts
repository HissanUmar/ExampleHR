import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('sync_event')
export class SyncEventEntity {
  @PrimaryColumn({ type: 'text' })
  id!: string;

  @Column({ type: 'text' })
  type!: string;

  @Column({ type: 'text' })
  status!: string;

  @Column({ name: 'records_total', type: 'integer', nullable: true })
  recordsTotal!: number | null;

  @Column({ name: 'records_ok', type: 'integer', nullable: true })
  recordsOk!: number | null;

  @Column({ name: 'records_failed', type: 'integer', nullable: true })
  recordsFailed!: number | null;

  @Column({ name: 'error_summary', type: 'text', nullable: true })
  errorSummary!: string | null;

  @Column({ name: 'started_at', type: 'datetime' })
  startedAt!: Date;

  @Column({ name: 'finished_at', type: 'datetime', nullable: true })
  finishedAt!: Date | null;
}
