import { Injectable } from '@nestjs/common';
import { CreateJadwalMatakuliahDto } from './dto/create-jadwal-matakuliah.dto';
import { UpdateJadwalMatakuliahDto } from './dto/update-jadwal-matakuliah.dto';

@Injectable()
export class JadwalMatakuliahService {
  create(createJadwalMatakuliahDto: CreateJadwalMatakuliahDto) {
    return 'This action adds a new jadwalMatakuliah';
  }

  findAll() {
    return `This action returns all jadwalMatakuliah`;
  }

  findOne(id: number) {
    return `This action returns a #${id} jadwalMatakuliah`;
  }

  update(id: number, updateJadwalMatakuliahDto: UpdateJadwalMatakuliahDto) {
    return `This action updates a #${id} jadwalMatakuliah`;
  }

  remove(id: number) {
    return `This action removes a #${id} jadwalMatakuliah`;
  }
}
