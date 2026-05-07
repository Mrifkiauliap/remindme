import { Injectable } from '@nestjs/common';
import { CreateDosenDto } from './dto/create-dosen.dto';
import { UpdateDosenDto } from './dto/update-dosen.dto';

@Injectable()
export class DosenService {
  create(createDosenDto: CreateDosenDto) {
    return 'This action adds a new dosen';
  }

  findAll() {
    return `This action returns all dosen`;
  }

  findOne(id: number) {
    return `This action returns a #${id} dosen`;
  }

  update(id: number, updateDosenDto: UpdateDosenDto) {
    return `This action updates a #${id} dosen`;
  }

  remove(id: number) {
    return `This action removes a #${id} dosen`;
  }
}
