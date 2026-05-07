import { Module } from '@nestjs/common';
import { ReminderModule } from './reminder/reminder.module';
import { WaCommandModule } from './wa-command/wa-command.module';
import { WaSenderModule } from './wa-sender/wa-sender.module';
import { WaWebhookModule } from './wa-webhook/wa-webhook.module';

@Module({
  imports: [ReminderModule, WaCommandModule, WaSenderModule, WaWebhookModule],
})
export class WorkerModule {}
