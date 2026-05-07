import { Module } from '@nestjs/common';
import { DosenModule } from './dosen/dosen.module';
import { GrupModule } from './grup/grup.module';
import { IndexController } from './index.controller';
import { JadwalMatakuliahModule } from './jadwal-matakuliah/jadwal-matakuliah.module';
import { MahasiswaModule } from './mahasiswa/mahasiswa.module';
import { MataKuliahModule } from './mata-kuliah/mata-kuliah.module';

@Module({
  imports: [
    MahasiswaModule,
    GrupModule,
    DosenModule,
    MataKuliahModule,
    JadwalMatakuliahModule,
  ],
  controllers: [IndexController],
  providers: [],
})
export class IndexModule {}
