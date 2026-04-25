export class BatchSyncResultDto {
  success!: boolean;
  batchId!: string;
  recordsTotal!: number;
  recordsOk!: number;
  recordsFailed!: number;
}
