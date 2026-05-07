import { Module } from '@nestjs/common';
import { WaSenderService } from './wa-sender.service';

@Module({
  providers: [WaSenderService],
  exports: [WaSenderService],
})
export class WaSenderModule {}
