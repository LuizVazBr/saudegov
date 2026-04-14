const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  password: 'De}s98}p.Ji9GuVbr97C@',
  host: 'localhost',
  port: 5432,
  database: 'anamnex',
});

async function createTable() {
  const sql = `
    CREATE TABLE IF NOT EXISTS usuarios_perfil_saude (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE UNIQUE,
        raca_cor TEXT,
        fumante BOOLEAN DEFAULT false,
        consumo_alcool TEXT,
        necessidades_especiais BOOLEAN DEFAULT false,
        historia_familia_diabetes BOOLEAN DEFAULT false,
        grau_familia_diabetes TEXT,
        historia_familia_cancer BOOLEAN DEFAULT false,
        grau_familia_cancer TEXT,
        tipo_cancer TEXT,
        atividades_fisicas TEXT,
        alergias TEXT,
        medicamentos_continuos TEXT,
        tipo_sanguineo TEXT,
        peso DECIMAL(5,2),
        altura DECIMAL(5,2),
        sono TEXT,
        agua TEXT,
        criado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;

  try {
    const res = await pool.query(sql);
    console.log("Tabela usuarios_perfil_saude verificada/criada com sucesso!");
  } catch (error) {
    console.error("Erro ao criar tabela:", error);
  } finally {
    await pool.end();
  }
}

createTable();
