import { PartialType } from '@nestjs/swagger';
import { CreateDosenDto } from './create-dosen.dto';

export class UpdateDosenDto extends PartialType(CreateDosenDto) {}
