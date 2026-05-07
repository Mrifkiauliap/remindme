import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { GrupService } from './grup.service';
import { CreateGrupDto } from './dto/create-grup.dto';
import { UpdateGrupDto } from './dto/update-grup.dto';

@Controller('grup')
export class GrupController {
  constructor(private readonly grupService: GrupService) {}

  @Post()
  create(@Body() createGrupDto: CreateGrupDto) {
    return this.grupService.create(createGrupDto);
  }

  @Get()
  findAll() {
    return this.grupService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.grupService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateGrupDto: UpdateGrupDto) {
    return this.grupService.update(+id, updateGrupDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.grupService.remove(+id);
  }
}
