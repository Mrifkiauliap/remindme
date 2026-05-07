import { AppConfigService } from '@/common/config/config.service';
import { Provider } from '@nestjs/common';
import { NodePgDatabase, drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { Schema, schema } from './schema/schema';

export const PG_CONNECTION = 'PG_CONNECTION';

export const DrizzleProvider: Provider = {
  provide: PG_CONNECTION,
  inject: [AppConfigService],
  useFactory(configService: AppConfigService) {
    const pool = new Pool({
      connectionString: configService.databaseUrl,
    });
    return drizzle(pool, { schema, logger: true }) as NodePgDatabase<Schema>;
  },
};
