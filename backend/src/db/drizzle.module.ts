import { Global, Module } from '@nestjs/common';
import { DrizzleProvider } from './drizzle.provider';
import { DrizzleService } from './drizzle.service';

@Global()
@Module({
  providers: [DrizzleProvider, DrizzleService],
  exports: [DrizzleService],
})
export class DrizzleModule {}
