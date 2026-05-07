import { Module } from '@nestjs/common';
import { WaSenderModule } from '../wa-sender/wa-sender.module';
import { ReminderController } from './reminder.controller';
import { ReminderService } from './reminder.service';

@Module({
  imports: [WaSenderModule],
  controllers: [ReminderController],
  providers: [ReminderService],
})
export class ReminderModule {}
