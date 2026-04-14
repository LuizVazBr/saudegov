import { pool } from '../src/lib/pgClient';

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
    await pool.query(sql);
    console.log("Tabela usuarios_perfil_saude criada com sucesso!");
  } catch (error) {
    console.error("Erro ao criar tabela:", error);
  } finally {
    await pool.end();
  }
}

createTable();
