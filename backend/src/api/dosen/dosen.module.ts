import { Module } from '@nestjs/common';
import { DosenService } from './dosen.service';
import { DosenController } from './dosen.controller';

@Module({
  controllers: [DosenController],
  providers: [DosenService],
})
export class DosenModule {}
