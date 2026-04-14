const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Load .env.local
const envPath = path.resolve(__dirname, '../../.env.local');
const envConfig = dotenv.parse(fs.readFileSync(envPath));
for (const k in envConfig) {
  process.env[k] = envConfig[k];
}

const pool = new Pool({
  host: process.env.PG_HOST,
  port: Number(process.env.PG_PORT),
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  database: process.env.PG_DATABASE,
});

async function check() {
  const client = await pool.connect();
  try {
    console.log("--- TABLES ---");
    const tables = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
    console.log(tables.rows.map(r => r.table_name).join(', '));

    console.log("\n--- HISTORICOS COUNT ---");
    const count = await client.query("SELECT COUNT(*) FROM historicos");
    console.log("Count:", count.rows[0].count);

    console.log("\n--- HISTORICOS SAMPLE ---");
    const sample = await client.query("SELECT id, paciente_id FROM historicos LIMIT 5");
    console.log(sample.rows);

    console.log("\n--- USUARIOS COUNT ---");
    const uCount = await client.query("SELECT COUNT(*) FROM usuarios");
    console.log("Count:", uCount.rows[0].count);

    console.log("\n--- SEARCHING SPECIFIC ID FROM USER DUMP (ece6551c...) ---");
    const findId = await client.query("SELECT id, nome FROM usuarios WHERE id::text = 'ece6551c-71ff-4033-92d8-d995b61d1a4d'");
    console.log("Result:", findId.rows);

    console.log("\n--- SEARCHING PARTIAL ID (af6902b0...) ---");
    const findUid = await client.query("SELECT id, nome FROM usuarios WHERE id::text LIKE 'af6902b0%'");
    console.log("Result:", findUid.rows);

  } finally {
    client.release();
    await pool.end();
  }
}

check().catch(console.error);
