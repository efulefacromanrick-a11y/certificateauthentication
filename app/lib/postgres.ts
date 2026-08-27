import postgres from 'postgres';

const POSTGRES_URL = process.env.POSTGRES_URL;
if (!POSTGRES_URL) {
  throw new Error('POSTGRES_URL environment variable is required.');
}

const sql = postgres(POSTGRES_URL, {
  // Neon requires encrypted connections in local development as well as production.
  // This also works with any Postgres URL that already contains sslmode=require.
  ssl: 'require',
});

export default sql;
