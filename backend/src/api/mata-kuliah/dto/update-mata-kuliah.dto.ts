import { PartialType } from '@nestjs/swagger';
import { CreateMataKuliahDto } from './create-mata-kuliah.dto';

export class UpdateMataKuliahDto extends PartialType(CreateMataKuliahDto) {}
