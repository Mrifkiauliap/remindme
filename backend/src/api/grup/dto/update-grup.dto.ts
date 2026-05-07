import { PartialType } from '@nestjs/swagger';
import { CreateGrupDto } from './create-grup.dto';

export class UpdateGrupDto extends PartialType(CreateGrupDto) {}
