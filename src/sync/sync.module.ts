import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';
import { SyncEventEntity } from '../entities/sync-event.entity';
import { FailedHcmJobEntity } from '../entities/failed-hcm-job.entity';
import { LeaveBalanceEntity } from '../entities/leave-balance.entity';
import { BalancesModule } from '../balances/balances.module';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([SyncEventEntity, FailedHcmJobEntity, LeaveBalanceEntity]),
    BalancesModule
  ],
  providers: [SyncService],
  controllers: [SyncController],
  exports: [SyncService]
})
export class SyncModule {}
