import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TimeOffRequestEntity } from '../entities/time-off-request.entity';
import { RequestsService } from './requests.service';
import { RequestsController } from './requests.controller';
import { BalancesModule } from '../balances/balances.module';
import { HcmModule } from '../hcm/hcm.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([TimeOffRequestEntity]),
    BalancesModule,
    HcmModule
  ],
  providers: [RequestsService],
  controllers: [RequestsController],
  exports: [RequestsService]
})
export class RequestsModule {}
