import { Body, Controller, Get, Post, Put, UseGuards } from '@nestjs/common';
import { SyncService } from './sync.service';
import { InternalApiKeyGuard } from '../auth/internal-api-key.guard';
import { BatchBalanceDto } from '../balances/dto/batch-balance.dto';

@Controller('api')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post('sync/trigger')
  @UseGuards(InternalApiKeyGuard)
  trigger() {
    return this.syncService.reconcile();
  }

  @Get('sync/failed-jobs')
  @UseGuards(InternalApiKeyGuard)
  listFailedJobs() {
    return this.syncService.runFailedJobs();
  }

  @Put('balances/batch')
  @UseGuards(InternalApiKeyGuard)
  processBatch(@Body() payload: BatchBalanceDto) {
    return this.syncService.processBatch(payload);
  }
}
