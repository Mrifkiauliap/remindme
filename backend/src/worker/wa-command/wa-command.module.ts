import { Module } from '@nestjs/common';
import { WaSenderModule } from '../wa-sender/wa-sender.module';
import { AdminHandler } from './handlers/admin.handler';
import { FileHandler } from './handlers/file.handler';
import { GroupHandler } from './handlers/group.handler';
import { MediaHandler } from './handlers/media.handler';
import { PengaturanHandler } from './handlers/pengaturan.handler';
import { ProfileHandler } from './handlers/profile.handler';
import { ScheduleHandler } from './handlers/schedule.handler';
import { WaCommandService } from './wa-command.service';

@Module({
  imports: [WaSenderModule],
  providers: [
    WaCommandService,
    AdminHandler,
    FileHandler,
    GroupHandler,
    ScheduleHandler,
    ProfileHandler,
    MediaHandler,
    PengaturanHandler,
  ],
  exports: [WaCommandService],
})
export class WaCommandModule {}
