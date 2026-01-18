import type { Config } from 'drizzle-kit';

const isCloudflare = process.env.CF_PAGES === '1' || process.env.CLOUDFLARE === '1';

export default {
  schema: './src/lib/db/schema.ts',
  out: './drizzle/migrations',
  dialect: 'sqlite',
  ...(isCloudflare
    ? {
        driver: 'd1-http',
        dbCredentials: {
          accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
          databaseId: process.env.CLOUDFLARE_D1_ID!,
          token: process.env.CLOUDFLARE_API_TOKEN!,
        },
      }
    : {
        dbCredentials: {
          url: process.env.DATABASE_URL || 'file:./dev.db',
        },
      }),
} satisfies Config;
