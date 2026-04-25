import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LeaveBalanceEntity } from '../entities/leave-balance.entity';
import { BalanceAuditLogEntity } from '../entities/balance-audit-log.entity';
import { BalancesService } from './balances.service';
import { BalancesController } from './balances.controller';
import { HcmModule } from '../hcm/hcm.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([LeaveBalanceEntity, BalanceAuditLogEntity]),
    HcmModule
  ],
  providers: [BalancesService],
  controllers: [BalancesController],
  exports: [BalancesService]
})
export class BalancesModule {}
