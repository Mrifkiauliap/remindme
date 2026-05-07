import { Inject, Injectable } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { PG_CONNECTION } from './drizzle.provider';
import type { Schema } from './schema/schema';

@Injectable()
export class DrizzleService {
  constructor(@Inject(PG_CONNECTION) readonly db: NodePgDatabase<Schema>) {}
}
