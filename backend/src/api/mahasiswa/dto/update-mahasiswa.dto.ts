import { PartialType } from '@nestjs/swagger';
import { CreateMahasiswaDto } from './create-mahasiswa.dto';

export class UpdateMahasiswaDto extends PartialType(CreateMahasiswaDto) {}
