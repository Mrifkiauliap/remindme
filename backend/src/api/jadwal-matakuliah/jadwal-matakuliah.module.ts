import { Module } from '@nestjs/common';
import { JadwalMatakuliahService } from './jadwal-matakuliah.service';
import { JadwalMatakuliahController } from './jadwal-matakuliah.controller';

@Module({
  controllers: [JadwalMatakuliahController],
  providers: [JadwalMatakuliahService],
})
export class JadwalMatakuliahModule {}
