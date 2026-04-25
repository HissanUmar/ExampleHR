import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const initSqlJs = require('sql.js');
import configuration from './configuration';
import { AuthModule } from './auth/auth.module';
import { BalancesModule } from './balances/balances.module';
import { RequestsModule } from './requests/requests.module';
import { SyncModule } from './sync/sync.module';
import { HcmModule } from './hcm/hcm.module';
import { AppController } from './app.controller';
import { LeaveBalanceEntity } from './entities/leave-balance.entity';
import { TimeOffRequestEntity } from './entities/time-off-request.entity';
import { BalanceAuditLogEntity } from './entities/balance-audit-log.entity';
import { SyncEventEntity } from './entities/sync-event.entity';
import { FailedHcmJobEntity } from './entities/failed-hcm-job.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const SQL = await initSqlJs({
          locateFile: (fileName: string) =>
            require.resolve(`sql.js/dist/${fileName}`)
        });

        return {
          type: 'sqljs',
          driver: SQL,
          autoSave: false,
          entities: [
            LeaveBalanceEntity,
            TimeOffRequestEntity,
            BalanceAuditLogEntity,
            SyncEventEntity,
            FailedHcmJobEntity
          ],
          synchronize: true,
          logging: false,
          useLocalForage: false
        };
      }
    }),
    AuthModule,
    HcmModule,
    BalancesModule,
    RequestsModule,
    SyncModule
  ],
  controllers: [AppController]
})
export class AppModule {}
