import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const schema = await fs.readFile(path.join(scriptDirectory, 'schema.sql'), 'utf8');

if (!process.env.POSTGRES_URL) {
  throw new Error('POSTGRES_URL is required. Add it to .env.local.');
}

const sql = postgres(process.env.POSTGRES_URL, { ssl: 'require' });

try {
  await sql.unsafe(schema);
  console.log('Database schema initialized successfully.');
} finally {
  await sql.end();
}
