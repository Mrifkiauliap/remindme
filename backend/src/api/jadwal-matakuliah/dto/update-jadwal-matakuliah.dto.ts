import { PartialType } from '@nestjs/swagger';
import { CreateJadwalMatakuliahDto } from './create-jadwal-matakuliah.dto';

export class UpdateJadwalMatakuliahDto extends PartialType(CreateJadwalMatakuliahDto) {}
