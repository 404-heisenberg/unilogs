import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const start = Date.now();

pool
  .query('SELECT 1')
  .then((res) => {
    console.log('SUCCESS after', Date.now() - start, 'ms');
    process.exit(0);
  })
  .catch((err) => {
    console.log('FAILED after', Date.now() - start, 'ms');
    console.log('Full error:', err);
    process.exit(1);
  });
