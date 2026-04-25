import { Controller, Get } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Controller()
export class AppController {
  constructor(private readonly dataSource: DataSource) {}

  @Get('api/health')
  async health() {
    const db = this.dataSource.isInitialized;
    return {
      status: db ? 'ok' : 'degraded',
      db,
      hcm: true
    };
  }

  @Get('api/metrics')
  metrics() {
    return 'time_off_requests_total 0\n';
  }
}
