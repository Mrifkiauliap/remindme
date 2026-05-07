import { Module } from '@nestjs/common';
import { WaWebhookController } from './wa-webhook.controller';
import { WaCommandModule } from '../wa-command/wa-command.module';

@Module({
  imports: [WaCommandModule],
  controllers: [WaWebhookController],
})
export class WaWebhookModule {}
