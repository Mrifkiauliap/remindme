import { Module } from '@nestjs/common';
import { GrupService } from './grup.service';
import { GrupController } from './grup.controller';

@Module({
  controllers: [GrupController],
  providers: [GrupService],
})
export class GrupModule {}
