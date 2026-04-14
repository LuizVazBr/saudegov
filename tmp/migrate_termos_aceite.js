const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Read .env.local manually since dotenv might not be available or working as expected
const envContent = fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const [key, ...value] = line.split('=');
  if (key && value.length > 0) {
    env[key.trim()] = value.join('=').trim();
  }
});

const pool = new Pool({
  host: env.PG_HOST,
  port: Number(env.PG_PORT),
  user: env.PG_USER,
  password: env.PG_PASSWORD,
  database: env.PG_DATABASE,
});

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS termos_aceite (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        paciente_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
        tipo VARCHAR(50) NOT NULL DEFAULT 'telemedicina',
        aceito_em TIMESTAMP NOT NULL DEFAULT NOW(),
        ip VARCHAR(45),
        user_agent TEXT
      );
    `);
    console.log('Table termos_aceite created/verified.');

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS termos_aceite_paciente_tipo_unique
        ON termos_aceite(paciente_id, tipo);
    `);
    console.log('Unique index created/verified.');

    const check = await client.query('SELECT COUNT(*) FROM termos_aceite');
    console.log('Rows in termos_aceite:', check.rows[0].count);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
