import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

// Support DATABASE_URL langsung, atau rakit dari POSTGRES_* variables
const databaseUrl =
  process.env.DATABASE_URL ||
  `postgresql://${process.env.POSTGRES_USER ?? 'postgres'}:${
    process.env.POSTGRES_PASSWORD ?? 'secret'
  }@${process.env.POSTGRES_HOST ?? 'db'}:${
    process.env.POSTGRES_PORT ?? '5432'
  }/${process.env.POSTGRES_DB ?? 'remindme'}`;

export default defineConfig({
  out: './drizzle',
  schema: './src/db/schema/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: databaseUrl,
  },
});
