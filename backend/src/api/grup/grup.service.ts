import { Injectable } from '@nestjs/common';
import { CreateGrupDto } from './dto/create-grup.dto';
import { UpdateGrupDto } from './dto/update-grup.dto';

@Injectable()
export class GrupService {
  create(createGrupDto: CreateGrupDto) {
    return 'This action adds a new grup';
  }

  findAll() {
    return `This action returns all grup`;
  }

  findOne(id: number) {
    return `This action returns a #${id} grup`;
  }

  update(id: number, updateGrupDto: UpdateGrupDto) {
    return `This action updates a #${id} grup`;
  }

  remove(id: number) {
    return `This action removes a #${id} grup`;
  }
}
