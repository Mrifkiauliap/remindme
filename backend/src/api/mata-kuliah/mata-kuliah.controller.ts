import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { MataKuliahService } from './mata-kuliah.service';
import { CreateMataKuliahDto } from './dto/create-mata-kuliah.dto';
import { UpdateMataKuliahDto } from './dto/update-mata-kuliah.dto';

@Controller('mata-kuliah')
export class MataKuliahController {
  constructor(private readonly mataKuliahService: MataKuliahService) {}

  @Post()
  create(@Body() createMataKuliahDto: CreateMataKuliahDto) {
    return this.mataKuliahService.create(createMataKuliahDto);
  }

  @Get()
  findAll() {
    return this.mataKuliahService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.mataKuliahService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateMataKuliahDto: UpdateMataKuliahDto) {
    return this.mataKuliahService.update(+id, updateMataKuliahDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.mataKuliahService.remove(+id);
  }
}
