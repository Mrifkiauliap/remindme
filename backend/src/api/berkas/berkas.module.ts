import { Module } from '@nestjs/common';
import { BerkasController } from './berkas.controller';

@Module({
  controllers: [BerkasController],
})
export class BerkasModule {}
