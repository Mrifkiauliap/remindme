import { AppConfigModule } from '@/common/config/config.module';
import { ApiKeyGuard } from '@/common/guards/api-key.guard';
import { DrizzleModule } from '@/db/drizzle.module';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { IndexModule } from './api/index.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { WorkerModule } from './worker/worker.module';

@Module({
  imports: [
    AppConfigModule,
    DrizzleModule,
    IndexModule,
    ScheduleModule.forRoot(),
    WorkerModule,
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'public'),
      serveRoot: '/public',
      exclude: ['/api*', '/public/uploads*'],
    }),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ApiKeyGuard,
    },
  ],
})
export class AppModule {}
