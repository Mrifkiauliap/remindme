import { Injectable } from '@nestjs/common';
import { CreateMataKuliahDto } from './dto/create-mata-kuliah.dto';
import { UpdateMataKuliahDto } from './dto/update-mata-kuliah.dto';

@Injectable()
export class MataKuliahService {
  create(createMataKuliahDto: CreateMataKuliahDto) {
    return 'This action adds a new mataKuliah';
  }

  findAll() {
    return `This action returns all mataKuliah`;
  }

  findOne(id: number) {
    return `This action returns a #${id} mataKuliah`;
  }

  update(id: number, updateMataKuliahDto: UpdateMataKuliahDto) {
    return `This action updates a #${id} mataKuliah`;
  }

  remove(id: number) {
    return `This action removes a #${id} mataKuliah`;
  }
}
