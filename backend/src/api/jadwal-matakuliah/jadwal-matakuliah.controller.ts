import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { JadwalMatakuliahService } from './jadwal-matakuliah.service';
import { CreateJadwalMatakuliahDto } from './dto/create-jadwal-matakuliah.dto';
import { UpdateJadwalMatakuliahDto } from './dto/update-jadwal-matakuliah.dto';

@Controller('jadwal-matakuliah')
export class JadwalMatakuliahController {
  constructor(private readonly jadwalMatakuliahService: JadwalMatakuliahService) {}

  @Post()
  create(@Body() createJadwalMatakuliahDto: CreateJadwalMatakuliahDto) {
    return this.jadwalMatakuliahService.create(createJadwalMatakuliahDto);
  }

  @Get()
  findAll() {
    return this.jadwalMatakuliahService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.jadwalMatakuliahService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateJadwalMatakuliahDto: UpdateJadwalMatakuliahDto) {
    return this.jadwalMatakuliahService.update(+id, updateJadwalMatakuliahDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.jadwalMatakuliahService.remove(+id);
  }
}
