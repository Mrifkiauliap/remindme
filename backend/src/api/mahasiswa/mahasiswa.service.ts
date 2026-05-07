import { Injectable } from '@nestjs/common';
import { CreateMahasiswaDto } from './dto/create-mahasiswa.dto';
import { UpdateMahasiswaDto } from './dto/update-mahasiswa.dto';

@Injectable()
export class MahasiswaService {
  create(createMahasiswaDto: CreateMahasiswaDto) {
    return 'This action adds a new mahasiswa';
  }

  findAll() {
    return `This action returns all mahasiswa`;
  }

  findOne(id: number) {
    return `This action returns a #${id} mahasiswa`;
  }

  update(id: number, updateMahasiswaDto: UpdateMahasiswaDto) {
    return `This action updates a #${id} mahasiswa`;
  }

  remove(id: number) {
    return `This action removes a #${id} mahasiswa`;
  }
}
